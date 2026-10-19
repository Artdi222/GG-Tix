import { describe, expect, test } from "bun:test";
import { Hono } from "hono";
import { z } from "zod";
import { SignJWT } from "jose";
import { likeContains, limitQuery, pageQuery } from "../src/lib/pagination";
import { AppError, errorHandler } from "../src/lib/errors";
import { signRefreshToken, signToken, verifyRefreshToken, verifyToken } from "../src/lib/auth";

describe("pagination parsers", () => {
  const page = pageQuery();
  const limit = limitQuery(20, 100);

  test.each([
    [undefined, 1], ["", 1], ["abc", 1], ["0", 1], ["-5", 1], ["NaN", 1], ["3", 3], ["7.9", 7], ["2abc", 2],
  ])("page %p -> %p", (input, expected) => {
    expect(page.parse(input)).toBe(expected);
  });

  test.each([
    [undefined, 20], ["abc", 20], ["0", 1], ["-10", 1], ["50", 50], ["100", 100], ["101", 100], ["999999999999", 100],
  ])("limit %p -> %p", (input, expected) => {
    expect(limit.parse(input)).toBe(expected);
  });
});

describe("likeContains", () => {
  test.each([
    ["konser", "%konser%"],
    ["  spasi  ", "%spasi%"],
    ["100%", "%100\\%%"],
    ["a_b", "%a\\_b%"],
    ["back\\slash", "%back\\\\slash%"],
  ])("%p -> %p", (input, expected) => {
    expect(likeContains(input)).toBe(expected);
  });
});

describe("errorHandler", () => {
  const app = new Hono();
  app.onError(errorHandler);
  app.get("/app", () => { throw new AppError("Nope", 403, { field: "bad" }); });
  app.get("/zod", () => { z.object({ name: z.string() }).parse({}); return new Response(); });
  app.get("/fk", () => { throw Object.assign(new Error("fk"), { code: "23503" }); });
  app.get("/fk-wrapped", () => { throw new Error("wrapped", { cause: { code: "23503" } }); });
  app.get("/unique", () => { throw Object.assign(new Error("dup"), { code: "23505" }); });
  app.get("/boom", () => { throw new Error("secret internals: password=hunter2"); });

  const get = async (path: string) => {
    const res = await app.request(path);
    return { status: res.status, body: await res.json() as Record<string, unknown> };
  };

  test("AppError keeps status, message and fields", async () => {
    expect(await get("/app")).toEqual({ status: 403, body: { error: "Nope", fields: { field: "bad" } } });
  });
  test("ZodError becomes 422 with per-field messages", async () => {
    const r = await get("/zod");
    expect(r.status).toBe(422);
    expect(r.body.fields).toHaveProperty("name");
  });
  test("FK violation (direct or wrapped by drizzle) is a 409 conflict", async () => {
    expect((await get("/fk")).status).toBe(409);
    expect((await get("/fk-wrapped")).status).toBe(409);
  });
  test("unique violation is a 409 conflict", async () => {
    expect((await get("/unique")).status).toBe(409);
  });
  test("unknown errors are 500 and never leak internals", async () => {
    const r = await get("/boom");
    expect(r.status).toBe(500);
    expect(JSON.stringify(r.body)).not.toContain("hunter2");
  });
});

describe("JWT", () => {
  const payload = { sub: crypto.randomUUID(), role: "admin" as const, adminRole: "super_admin" as const, email: "a@b.c" };

  test("access token round-trips its claims", async () => {
    const claims = await verifyToken(await signToken(payload));
    expect(claims).toMatchObject({ sub: payload.sub, role: "admin", adminRole: "super_admin" });
  });

  test("a refresh token is not accepted as an access token, and vice versa", async () => {
    await expect(verifyToken(await signRefreshToken(payload))).rejects.toMatchObject({ statusCode: 401 });
    await expect(verifyRefreshToken(await signToken(payload))).rejects.toMatchObject({ statusCode: 401 });
  });

  test("a tampered payload is rejected", async () => {
    const [h, , s] = (await signToken(payload)).split(".");
    const forged = Buffer.from(JSON.stringify({ sub: payload.sub, role: "admin", adminRole: "super_admin", type: "access", exp: 9999999999 })).toString("base64url");
    await expect(verifyToken(`${h}.${forged}.${s}`)).rejects.toMatchObject({ statusCode: 401 });
  });

  test("a token signed with another secret is rejected", async () => {
    const other = await new SignJWT({ role: "admin", type: "access", adminRole: "super_admin" })
      .setProtectedHeader({ alg: "HS256" }).setSubject(payload.sub).setExpirationTime("1h")
      .sign(new TextEncoder().encode("x".repeat(64)));
    await expect(verifyToken(other)).rejects.toMatchObject({ statusCode: 401 });
  });

  test("alg=none tokens are rejected", async () => {
    const enc = (o: object) => Buffer.from(JSON.stringify(o)).toString("base64url");
    const none = `${enc({ alg: "none", typ: "JWT" })}.${enc({ sub: payload.sub, role: "admin", adminRole: "super_admin", type: "access" })}.`;
    await expect(verifyToken(none)).rejects.toMatchObject({ statusCode: 401 });
  });

  test("an expired token is rejected", async () => {
    const expired = await new SignJWT({ role: "admin", type: "access" })
      .setProtectedHeader({ alg: "HS256" }).setSubject(payload.sub).setExpirationTime(Math.floor(Date.now() / 1000) - 60)
      .sign(new TextEncoder().encode(process.env.JWT_SECRET!));
    await expect(verifyToken(expired)).rejects.toMatchObject({ statusCode: 401 });
  });

  test("garbage input is rejected", async () => {
    for (const t of ["", "abc", "a.b.c", "Bearer x"]) {
      await expect(verifyToken(t)).rejects.toMatchObject({ statusCode: 401 });
    }
  });
});
