import { Context, Next } from "hono";
import { getConnInfo } from "hono/bun";
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

// Rate Limiting

const RATE_LIMIT_WINDOW_MS = parseInt(
  process.env.RATE_LIMIT_WINDOW_MS || "900000",
  10
);
const RATE_LIMIT_AUTH_MAX = parseInt(
  process.env.RATE_LIMIT_AUTH_MAX || "10",
  10
);
const RATE_LIMIT_ORDER_MAX = parseInt(
  process.env.RATE_LIMIT_ORDER_MAX || "20",
  10
);

interface RateLimitOptions {
  windowMs?: number;
  max?: number;
}

interface RateLimitBucket {
  count: number;
  resetAt: number;
}

function getClientIp(c: Context): string {
  try {
    const info = getConnInfo(c);
    if (info?.remote?.address) {
      return info.remote.address;
    }
  } catch {
    // Fall through to header-based detection
  }
  return (
    c.req.header("x-forwarded-for")?.split(",")[0]?.trim() ||
    c.req.header("x-real-ip") ||
    "unknown"
  );
}

export function rateLimit(options: RateLimitOptions = {}) {
  const windowMs = options.windowMs ?? RATE_LIMIT_WINDOW_MS;
  const max = options.max ?? 10;
  const buckets = new Map<string, RateLimitBucket>();

  return async function rateLimitMiddleware(c: Context, next: Next) {
    const ip = getClientIp(c);
    const now = Date.now();

    let bucket = buckets.get(ip);
    if (!bucket || bucket.resetAt <= now) {
      bucket = { count: 0, resetAt: now + windowMs };
      buckets.set(ip, bucket);
    }

    bucket.count++;

    if (bucket.count > max) {
      const retryAfterSec = Math.max(1, Math.ceil((bucket.resetAt - now) / 1000));
      c.header("Retry-After", String(retryAfterSec));
      return c.json(
        {
          error: "Terlalu banyak percobaan. Silakan coba lagi nanti.",
        },
        429 as any
      );
    }

    await next();
  };
}

export const authRateLimiter = rateLimit({
  windowMs: RATE_LIMIT_WINDOW_MS,
  max: RATE_LIMIT_AUTH_MAX,
});

export const orderRateLimiter = rateLimit({
  windowMs: RATE_LIMIT_WINDOW_MS,
  max: RATE_LIMIT_ORDER_MAX,
});

// Body Size Limit

const BODY_SIZE_LIMIT = parseInt(
  process.env.BODY_SIZE_LIMIT || "1048576",
  10
);

export function bodySizeLimit(bytes: number = BODY_SIZE_LIMIT) {
  return async function bodySizeLimitMiddleware(c: Context, next: Next) {
    const contentLength = Number(c.req.header("content-length") || 0);
    if (contentLength > bytes) {
      return c.json(
        {
          error: "Request body terlalu besar. Maksimal 1 MB.",
        },
        413 as any
      );
    }
    await next();
  };
}
