import { Context, Next } from "hono";
import { verifyToken, TokenPayload } from "./auth";
import { AppError } from "./errors";

declare module "hono" {
  interface ContextVariableMap {
    user: TokenPayload;
  }
}

export async function authMiddleware(c: Context, next: Next) {
  const authHeader = c.req.header("Authorization");
  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    throw new AppError("Authorization token required", 401);
  }

  const token = authHeader.substring(7);
  const payload = await verifyToken(token);

  c.set("user", payload);
  await next();
}

export async function adminOnly(c: Context, next: Next) {
  const user = c.get("user");
  if (!user || user.role !== "admin") {
    throw new AppError("Access denied: Admin role required", 403);
  }
  await next();
}

export async function superAdminOnly(c: Context, next: Next) {
  const user = c.get("user");
  if (!user || user.role !== "admin" || user.adminRole !== "super_admin") {
    throw new AppError("Access denied: Super admin role required", 403);
  }
  await next();
}

export async function customerOnly(c: Context, next: Next) {
  const user = c.get("user");
  if (!user || user.role !== "customer") {
    throw new AppError("Access denied: Customer role required", 403);
  }
  await next();
}
