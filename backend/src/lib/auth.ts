import { SignJWT, jwtVerify } from "jose";
import { AppError } from "./errors";

const JWT_SECRET = new TextEncoder().encode(
  process.env.JWT_SECRET || "super-secret-key-gg-tix-dev-2026"
);

export interface TokenPayload {
  sub: string;
  role: "admin" | "customer";
  adminRole?: "super_admin" | "staff";
}

export async function signToken(payload: TokenPayload): Promise<string> {
  return await new SignJWT({
    role: payload.role,
    ...(payload.adminRole ? { adminRole: payload.adminRole } : {}),
  })
    .setProtectedHeader({ alg: "HS256" })
    .setSubject(payload.sub)
    .setIssuedAt()
    .setExpirationTime("7d")
    .sign(JWT_SECRET);
}

export async function verifyToken(token: string): Promise<TokenPayload> {
  try {
    const { payload } = await jwtVerify(token, JWT_SECRET);
    if (!payload.sub || (payload.role !== "admin" && payload.role !== "customer")) {
      throw new AppError("Invalid token payload", 401);
    }
    return {
      sub: payload.sub as string,
      role: payload.role as "admin" | "customer",
      ...(payload.adminRole ? { adminRole: payload.adminRole as "super_admin" | "staff" } : {}),
    };
  } catch (error) {
    if (error instanceof AppError) throw error;
    throw new AppError("Unauthorized or invalid token", 401);
  }
}
