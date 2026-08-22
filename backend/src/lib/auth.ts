import { SignJWT, jwtVerify } from "jose";
import { AppError } from "./errors";

// Fail-fast: crash at boot if JWT_SECRET is missing or too short.
const rawSecret = process.env.JWT_SECRET;
if (!rawSecret || rawSecret.trim().length < 32) {
  console.error("FATAL: JWT_SECRET environment variable is required (min 32 characters)");
  throw new Error("FATAL: JWT_SECRET environment variable is required");
}

const JWT_SECRET = new TextEncoder().encode(rawSecret);

const ACCESS_TOKEN_TTL = process.env.JWT_ACCESS_TTL || "1h";
const REFRESH_TOKEN_TTL = process.env.JWT_REFRESH_TTL || "7d";

export interface TokenPayload {
  sub: string;
  role: "admin" | "customer";
  adminRole?: "super_admin" | "admin" | "gate_staff";
  email?: string;
  name?: string;
}

type TokenType = "access" | "refresh";

async function signTokenInternal(payload: TokenPayload, type: TokenType): Promise<string> {
  const exp = type === "refresh" ? REFRESH_TOKEN_TTL : ACCESS_TOKEN_TTL;
  return await new SignJWT({
    role: payload.role,
    type,
    ...(payload.adminRole ? { adminRole: payload.adminRole } : {}),
    ...(payload.email ? { email: payload.email } : {}),
    ...(payload.name ? { name: payload.name } : {}),
  })
    .setProtectedHeader({ alg: "HS256" })
    .setSubject(payload.sub)
    .setIssuedAt()
    .setExpirationTime(exp)
    .sign(JWT_SECRET);
}

export async function signToken(payload: TokenPayload): Promise<string> {
  return signTokenInternal(payload, "access");
}

export async function signRefreshToken(payload: TokenPayload): Promise<string> {
  return signTokenInternal(payload, "refresh");
}

async function verifyTokenInternal(token: string, expectedType: TokenType): Promise<TokenPayload> {
  try {
    const { payload } = await jwtVerify(token, JWT_SECRET);
    if (
      !payload.sub ||
      (payload.role !== "admin" && payload.role !== "customer") ||
      payload.type !== expectedType
    ) {
      throw new AppError("Invalid token payload", 401);
    }
    return {
      sub: payload.sub as string,
      role: payload.role as "admin" | "customer",
      ...(payload.adminRole ? { adminRole: payload.adminRole as "super_admin" | "admin" | "gate_staff" } : {}),
      ...(payload.email ? { email: payload.email as string } : {}),
      ...(payload.name ? { name: payload.name as string } : {}),
    };
  } catch (error) {
    if (error instanceof AppError) throw error;
    throw new AppError("Unauthorized or invalid token", 401);
  }
}

export async function verifyToken(token: string): Promise<TokenPayload> {
  return verifyTokenInternal(token, "access");
}

export async function verifyRefreshToken(token: string): Promise<TokenPayload> {
  return verifyTokenInternal(token, "refresh");
}
