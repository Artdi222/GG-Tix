/**
 * Black-box HTTP tests: security (authn/authz, token abuse, IDOR, injection,
 * headers, CORS, payload limits, rate limiting) and API edge cases.
 *
 * Opt-in and destructive: point API_TEST_URL at a server backed by a disposable,
 * freshly seeded database (see `bun run test:api`). Never at dev or production.
 */
import { beforeAll, describe, expect, test } from "bun:test";

const BASE = process.env.API_TEST_URL;
const PASSWORD = "admin123";

type Json = Record<string, any>;
async function call(path: string, opts: { token?: string, method?: string, body?: unknown, headers?: Record<string, string> } = {}) {
  const res = await fetch(`${BASE}${path}`, {
    method: opts.method ?? (opts.body ? "POST" : "GET"),
    headers: {
      ...(opts.body !== undefined ? { "Content-Type": "application/json" } : {}),
      ...(opts.token ? { Authorization: `Bearer ${opts.token}` } : {}),
      ...opts.headers,
    },
    body: opts.body === undefined ? undefined : typeof opts.body === "string" ? opts.body : JSON.stringify(opts.body),
  });
  const text = await res.text();
  let json: Json = {};
  try { json = JSON.parse(text); } catch { /* non-JSON body */ }
  return { status: res.status, json, headers: res.headers, text };
}

async function login(email: string, password = PASSWORD, kind: "admin" | "customer" = "admin") {
  const r = await call(`/auth/${kind}/login`, { body: { email, password } });
  if (r.status !== 200) throw new Error(`login ${email} failed: ${r.status} ${r.text}`);
  return r.json.data as { token: string, refreshToken: string, user: Json };
}

describe.skipIf(!BASE)("API (black-box)", () => {
  const t: Record<string, string> = {};
  let superId = "";
  let refreshToken = "";
  let events: Json[] = [];

  beforeAll(async () => {
    const s = await login("budi@ggtix.com");
    t.super = s.token;
    superId = s.user.id;
    refreshToken = s.refreshToken;
    t.admin = (await login("maya@ggtix.com")).token;
    t.staff = (await login("siti@ggtix.com")).token;
    t.customerA = (await login("sari@example.com", "customer123", "customer")).token;
    t.customerB = (await login("andi@example.com", "customer123", "customer")).token;
    events = (await call("/events?limit=50", { token: t.super })).json.data;
  });

  describe("authentication", () => {
    const protectedRoutes = [
      "/auth/me", "/orders", "/orders/stats", "/dashboard/summary", "/vouchers", "/venues",
      "/users/customers", "/users/admins", "/settings/system", "/settings/audit-logs", "/orders/me",
    ];
    test.each(protectedRoutes)("GET %s without a token is 401", async (path) => {
      expect((await call(path)).status).toBe(401);
    });

    test("malformed Authorization headers are 401", async () => {
      for (const header of ["Bearer", "Bearer ", "Basic YWRtaW46YWRtaW4=", "bearer x.y.z", "Token abc"]) {
        expect((await call("/auth/me", { headers: { Authorization: header } })).status).toBe(401);
      }
    });

    test("a refresh token cannot be used as an access token", async () => {
      expect((await call("/auth/me", { token: refreshToken })).status).toBe(401);
    });

    test("a token whose payload was edited to escalate privileges is rejected", async () => {
      const [h, p, s] = t.staff.split(".");
      const claims = JSON.parse(Buffer.from(p!, "base64url").toString());
      const forged = Buffer.from(JSON.stringify({ ...claims, adminRole: "super_admin" })).toString("base64url");
      expect((await call("/users/admins", { token: `${h}.${forged}.${s}` })).status).toBe(401);
    });

    test("wrong password and unknown email give the same answer (no user enumeration)", async () => {
      const wrong = await call("/auth/admin/login", { body: { email: "budi@ggtix.com", password: "nope-nope" } });
      const unknown = await call("/auth/admin/login", { body: { email: "ghost@ggtix.com", password: "nope-nope" } });
      expect(wrong.status).toBe(401);
      expect(unknown.status).toBe(wrong.status);
      expect(unknown.json.error).toBe(wrong.json.error);
    });

    test("a customer account cannot log in to the admin console", async () => {
      expect((await call("/auth/admin/login", { body: { email: "sari@example.com", password: "customer123" } })).status).toBe(401);
    });

    test("refresh issues a working access token", async () => {
      const r = await call("/auth/refresh", { body: { refreshToken } });
      expect(r.status).toBe(200);
      expect((await call("/auth/me", { token: r.json.data.token })).status).toBe(200);
    });
  });

  describe("authorization (role gates)", () => {
    const cases: [string, string, string, number][] = [
      ["customer", "GET", "/orders", 403],
      ["customer", "GET", "/dashboard/summary", 403],
      ["customer", "GET", "/users/customers", 403],
      ["customer", "GET", "/vouchers", 403],
      ["staff", "GET", "/orders", 403],
      ["staff", "GET", "/vouchers", 403],
      ["staff", "GET", "/users/customers", 403],
      ["staff", "GET", "/settings/system", 403],
      ["admin", "GET", "/users/admins", 403],
      ["admin", "GET", "/settings/system", 403],
      ["admin", "GET", "/settings/audit-logs", 403],
      ["admin", "GET", "/orders", 200],
      ["admin", "GET", "/users/customers", 200],
      ["super", "GET", "/users/admins", 200],
      ["super", "GET", "/settings/system", 200],
    ];
    test.each(cases)("%s %s %s -> %d", async (role, method, path, expected) => {
      const token = role === "customer" ? t.customerA : t[role];
      expect((await call(path, { token, method })).status).toBe(expected);
    });

    test("an admin cannot delete vouchers (super admin only)", async () => {
      const v = (await call("/vouchers?limit=1", { token: t.admin })).json.data[0];
      expect((await call(`/vouchers/${v.id}`, { token: t.admin, method: "DELETE" })).status).toBe(403);
    });

    test("customers cannot create events", async () => {
      expect((await call("/events", { token: t.customerA, body: { title: "x" } })).status).toBe(403);
    });
  });

  describe("data exposure and IDOR", () => {
    test("password hashes never appear in admin or user payloads", async () => {
      for (const path of ["/auth/me", "/users/admins?limit=100", "/users/customers?limit=100"]) {
        const r = await call(path, { token: t.super });
        expect(r.status).toBe(200);
        expect(r.text).not.toMatch(/passwordHash|password_hash|\$argon2|\$2[aby]\$/);
      }
    });

    test("a customer cannot read another customer's tickets or payment", async () => {
      const orders = (await call("/orders/me?limit=50", { token: t.customerA })).json.data as Json[];
      expect(orders.length).toBeGreaterThan(0);
      const victim = orders[0]!.id;
      const tickets = await call(`/tickets/order/${victim}`, { token: t.customerB });
      expect([403, 404]).toContain(tickets.status);
      const payment = await call(`/payments/midtrans/${victim}`, { token: t.customerB });
      expect([403, 404]).toContain(payment.status);
    });

    test("customer order history only contains their own orders", async () => {
      const me = (await call("/auth/me", { token: t.customerA })).json.data;
      const orders = (await call("/orders/me?limit=100", { token: t.customerA })).json.data as Json[];
      for (const o of orders) if (o.customerId) expect(o.customerId).toBe(me.id);
    });
  });

  describe("injection and input hardening", () => {
    const payloads = ["' OR '1'='1", "'; DROP TABLE orders; --", "%", "_", "\\", "<script>alert(1)</script>", "😀".repeat(20)];
    test.each(payloads)("search %p is treated as data", async (q) => {
      const r = await call(`/orders?search=${encodeURIComponent(q)}`, { token: t.super });
      expect(r.status).toBe(200);
      const total = (await call("/orders?limit=1", { token: t.super })).json.pagination.totalCount;
      expect(r.json.pagination.totalCount).toBeLessThan(total);
    });

    test("orders table survives the injection attempts", async () => {
      expect((await call("/orders/stats", { token: t.super })).json.data.total).toBeGreaterThan(0);
    });

    test("invalid UUID params are rejected before reaching the database", async () => {
      for (const path of ["/events/not-a-uuid", "/vouchers/1%20OR%201=1", "/tickets/order/../../etc"]) {
        const r = await call(path, { token: t.super });
        expect(r.status).toBeGreaterThanOrEqual(400);
        expect(r.status).toBeLessThan(500);
      }
    });

    test("malformed JSON is a 4xx, not a 500", async () => {
      const r = await call("/vouchers", { token: t.super, method: "POST", body: "{not json" });
      expect(r.status).toBeGreaterThanOrEqual(400);
      expect(r.status).toBeLessThan(500);
    });

    test("oversized bodies are refused", async () => {
      const r = await call("/vouchers", { token: t.super, body: { name: "x".repeat(11 * 1024 * 1024) } });
      expect(r.status).toBe(413);
    });
  });

  describe("transport hardening", () => {
    test("security headers are set", async () => {
      const r = await call("/health");
      expect(r.headers.get("x-content-type-options")).toBe("nosniff");
      expect(r.headers.get("x-frame-options")).toBeTruthy();
    });

    test("CORS does not reflect arbitrary origins", async () => {
      const res = await fetch(`${BASE}/health`, { method: "OPTIONS", headers: { Origin: "https://evil.example", "Access-Control-Request-Method": "GET" } });
      expect(res.headers.get("access-control-allow-origin")).not.toBe("https://evil.example");
    });
  });

  describe("edge cases", () => {
    test("garbage pagination and ranges fall back to defaults", async () => {
      for (const path of ["/orders?page=-1&limit=abc", "/events?page=NaN&limit=99999", "/dashboard/summary?days=abc", "/dashboard/trend?days=-5", "/users/customers?page=0"]) {
        expect((await call(path, { token: t.super })).status).toBe(200);
      }
    });

    test("page past the end returns an empty list, not an error", async () => {
      const r = await call("/orders?page=99999", { token: t.super });
      expect(r.status).toBe(200);
      expect(r.json.data).toEqual([]);
    });

    test("event list reports capacity and sales", async () => {
      const e = events.find((x) => x.capacity > 0)!;
      expect(e.sold).toBeGreaterThanOrEqual(0);
      expect(e.sold).toBeLessThanOrEqual(e.capacity);
    });

    test("deleting an event that has orders is a 409 conflict", async () => {
      const withSales = events.find((x) => x.sold > 0)!;
      expect((await call(`/events/${withSales.id}`, { token: t.super, method: "DELETE" })).status).toBe(409);
    });

    test("deleting a venue in use is refused", async () => {
      const r = await call(`/venues/${events[0]!.venueId}`, { token: t.super, method: "DELETE" });
      expect([400, 409]).toContain(r.status);
    });

    describe("vouchers", () => {
      const code = `TEST${Date.now().toString(36).toUpperCase()}`;
      let id = "";
      const base = { name: "Test voucher", discountType: "fixed", discountValue: "10000.00", quotaTotal: 5, endDate: new Date(Date.now() + 86400000).toISOString() };

      test("percentage discount above 100 is rejected", async () => {
        const r = await call("/vouchers", { token: t.super, body: { ...base, code: `${code}P`, discountType: "percentage", discountValue: "150" } });
        expect(r.status).toBeGreaterThanOrEqual(400);
        expect(r.status).toBeLessThan(500);
      });

      test("end date before start date is rejected", async () => {
        const r = await call("/vouchers", { token: t.super, body: { ...base, code: `${code}D`, startDate: new Date(Date.now() + 5 * 86400000).toISOString() } });
        expect(r.status).toBeGreaterThanOrEqual(400);
        expect(r.status).toBeLessThan(500);
      });

      test("create, then a duplicate code is a conflict", async () => {
        const r = await call("/vouchers", { token: t.super, body: { ...base, code } });
        expect(r.status).toBe(201);
        id = r.json.data.id;
        const dup = await call("/vouchers", { token: t.super, body: { ...base, code } });
        expect([400, 409]).toContain(dup.status);
      });

      test("quota cannot drop below zero remaining; valid changes keep remaining in sync", async () => {
        const up = await call(`/vouchers/${id}`, { token: t.super, method: "PUT", body: { quotaTotal: 8 } });
        expect(up.status).toBe(200);
        expect(up.json.data.quotaRemaining).toBe(8);
        const bad = await call(`/vouchers/${id}`, { token: t.super, method: "PUT", body: { quotaTotal: -1 } });
        expect(bad.status).toBeGreaterThanOrEqual(400);
      });

      test("the code cannot be changed after creation", async () => {
        await call(`/vouchers/${id}`, { token: t.super, method: "PUT", body: { code: "HIJACK" } });
        expect((await call(`/vouchers/${id}`, { token: t.super })).json.data.code).toBe(code);
      });

      test("unused voucher can be deleted by a super admin", async () => {
        expect((await call(`/vouchers/${id}`, { token: t.super, method: "DELETE" })).status).toBe(200);
      });
    });

    describe("admin accounts", () => {
      test("a super admin cannot change their own role", async () => {
        const r = await call(`/users/admins/${superId}`, { token: t.super, method: "PUT", body: { role: "admin" } });
        expect(r.status).toBe(403);
      });

      test("passwords shorter than 8 characters are rejected", async () => {
        const r = await call("/users/admins", { token: t.super, body: { name: "Short", email: `short${Date.now()}@ggtix.com`, password: "1234567", role: "admin" } });
        expect(r.status).toBeGreaterThanOrEqual(400);
        expect(r.status).toBeLessThan(500);
      });

      test("duplicate admin email is a conflict", async () => {
        const r = await call("/users/admins", { token: t.super, body: { name: "Dup", email: "maya@ggtix.com", password: "password123", role: "admin" } });
        expect([400, 409]).toContain(r.status);
      });
    });

    describe("ordering", () => {
      test("ordering on a closed event is refused", async () => {
        const closed = events.find((e) => e.status === "closed")!;
        const cats = (await call(`/events/${closed.id}/categories`)).json.data as Json[];
        const r = await call("/orders", { token: t.customerA, body: { eventId: closed.id, categoryId: cats[0]!.id, quantity: 1 } });
        expect(r.status).toBeGreaterThanOrEqual(400);
        expect(r.status).toBeLessThan(500);
      });

      test("quantity above the per-order maximum is refused", async () => {
        const open = events.find((e) => e.status === "open" && e.capacity > e.sold)!;
        const cats = (await call(`/events/${open.id}/categories`)).json.data as Json[];
        const r = await call("/orders", { token: t.customerA, body: { eventId: open.id, categoryId: cats[0]!.id, quantity: 50 } });
        expect(r.status).toBeGreaterThanOrEqual(400);
        expect(r.status).toBeLessThan(500);
      });

      test("zero or fractional quantities are refused", async () => {
        const open = events.find((e) => e.status === "open")!;
        const cats = (await call(`/events/${open.id}/categories`)).json.data as Json[];
        for (const quantity of [0, -1, 1.5]) {
          const r = await call("/orders", { token: t.customerA, body: { eventId: open.id, categoryId: cats[0]!.id, quantity } });
          expect(r.status).toBeGreaterThanOrEqual(400);
          expect(r.status).toBeLessThan(500);
        }
      });

      test("a category from another event is refused", async () => {
        const [a, b] = events.filter((e) => e.status === "open");
        const catsB = (await call(`/events/${b!.id}/categories`)).json.data as Json[];
        const r = await call("/orders", { token: t.customerA, body: { eventId: a!.id, categoryId: catsB[0]!.id, quantity: 1 } });
        expect(r.status).toBeGreaterThanOrEqual(400);
        expect(r.status).toBeLessThan(500);
      });
    });
  });

  // Last: it exhausts the login bucket for this client IP.
  describe("rate limiting", () => {
    test("repeated failed logins are throttled with 429", async () => {
      let throttled = false;
      for (let i = 0; i < 60 && !throttled; i++) {
        const r = await call("/auth/admin/login", { body: { email: "budi@ggtix.com", password: `wrong-${i}` } });
        throttled = r.status === 429;
      }
      expect(throttled).toBe(true);
    }, 60_000);
  });
});
