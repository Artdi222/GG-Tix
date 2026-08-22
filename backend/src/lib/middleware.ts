import { Context, Next } from "hono";
import { getConnInfo } from "hono/bun";
import { verifyToken, TokenPayload } from "./auth";
import { AppError } from "./errors";
import { createAuditLog } from "../services/settings.service";

declare module "hono" {
  interface ContextVariableMap {
    user: TokenPayload;
    requestId: string;
    startTime: number;
  }
}

// Request ID & Timing Middleware

export async function requestIdMiddleware(c: Context, next: Next) {
  const existingId = c.req.header("X-Request-ID") || c.req.header("x-request-id");
  const requestId = existingId && existingId.length < 128 ? existingId : `req_${crypto.randomUUID()}`;

  c.set("requestId", requestId);
  c.header("X-Request-ID", requestId);

  await next();
}

export async function timingMiddleware(c: Context, next: Next) {
  const start = performance.now();
  c.set("startTime", start);

  await next();

  const duration = performance.now() - start;
  c.header("X-Response-Time", `${duration.toFixed(2)}ms`);
}

// Security Headers

export async function securityHeadersMiddleware(c: Context, next: Next) {
  await next();

  // Prevent MIME type sniffing
  c.header("X-Content-Type-Options", "nosniff");
  // Clickjacking protection
  c.header("X-Frame-Options", "DENY");
  // Legacy XSS filter
  c.header("X-XSS-Protection", "1; mode=block");
  // Referrer policy
  c.header("Referrer-Policy", "strict-origin-when-cross-origin");
  // Restrict sensitive browser APIs
  c.header("Permissions-Policy", "camera=(self), microphone=(), geolocation=()");

  // HSTS on HTTPS/Production
  if (process.env.NODE_ENV === "production") {
    c.header("Strict-Transport-Security", "max-age=31536000; includeSubDomains");
  }
}

// Authentication Middleware

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

// Role-Based Access Control (RBAC)

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

export async function adminOrHigher(c: Context, next: Next) {
  const user = c.get("user");
  if (!user || user.role !== "admin" || (user.adminRole !== "super_admin" && user.adminRole !== "admin")) {
    throw new AppError("Access denied: Admin or Super Admin role required", 403);
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


// Sliding-Window Rate Limiter & Memory Sweeper GC

const RATE_LIMIT_WINDOW_MS = parseInt(process.env.RATE_LIMIT_WINDOW_MS || "900000", 10);
const RATE_LIMIT_AUTH_MAX = parseInt(process.env.RATE_LIMIT_AUTH_MAX || "10", 10);
const RATE_LIMIT_ORDER_MAX = parseInt(process.env.RATE_LIMIT_ORDER_MAX || "20", 10);
const RATE_LIMIT_CLEANUP_INTERVAL = parseInt(process.env.RATE_LIMIT_CLEANUP_INTERVAL || "180000", 10);

interface RateLimitOptions {
  windowMs?: number;
  max?: number;
  key?: string;
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
    // Fall through
  }
  return (
    c.req.header("x-forwarded-for")?.split(",")[0]?.trim() ||
    c.req.header("x-real-ip") ||
    "127.0.0.1"
  );
}

// Global bucket registry with automatic garbage collection
const globalBuckets = new Map<string, RateLimitBucket>();

// Periodic Memory Sweeper GC to eliminate memory leaks
setInterval(() => {
  const now = Date.now();
  for (const [key, bucket] of globalBuckets.entries()) {
    if (bucket.resetAt <= now) {
      globalBuckets.delete(key);
    }
  }
}, RATE_LIMIT_CLEANUP_INTERVAL);

export function rateLimit(options: RateLimitOptions = {}) {
  const windowMs = options.windowMs ?? RATE_LIMIT_WINDOW_MS;
  const max = options.max ?? 10;
  const keyPrefix = options.key;

  return async function rateLimitMiddleware(c: Context, next: Next) {
    const ip = getClientIp(c);
    const user = c.get("user");
    const identifier = user?.sub ? `user_${user.sub}` : `ip_${ip}`;
    const bucketKey = `${keyPrefix ?? c.req.routePath ?? c.req.path}:${identifier}`;
    const now = Date.now();

    let bucket = globalBuckets.get(bucketKey);
    if (!bucket || bucket.resetAt <= now) {
      bucket = { count: 0, resetAt: now + windowMs };
      globalBuckets.set(bucketKey, bucket);
    }

    bucket.count++;

    if (bucket.count > max) {
      const retryAfterSec = Math.max(1, Math.ceil((bucket.resetAt - now) / 1000));
      c.header("Retry-After", String(retryAfterSec));
      return c.json(
        {
          error: "TOO_MANY_REQUESTS",
          message: "Terlalu banyak percobaan. Silakan coba lagi nanti.",
          retryAfterSeconds: retryAfterSec,
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
  key: "auth",
});

export const orderRateLimiter = rateLimit({
  windowMs: RATE_LIMIT_WINDOW_MS,
  max: RATE_LIMIT_ORDER_MAX,
  key: "orders",
});



// Body Size & Payload Guard

const BODY_SIZE_LIMIT = parseInt(process.env.BODY_SIZE_LIMIT || "10485760", 10);

export function bodySizeLimit(bytes: number = BODY_SIZE_LIMIT) {
  return async function bodySizeLimitMiddleware(c: Context, next: Next) {
    // UPL-07: multipart upload endpoint bypasses the general JSON limit
    if (c.req.path.startsWith("/api/uploads")) {
      await next();
      return;
    }
    const contentLength = Number(c.req.header("content-length") || 0);
    if (contentLength > bytes) {
      return c.json(
        {
          error: "PAYLOAD_TOO_LARGE",
          message: "Request body terlalu besar. Batas ukuran terlampaui.",
          maxAllowedBytes: bytes,
        },
        413 as any
      );
    }
    await next();
  };
}

// Structured Audit Trail Middleware

const MUTATION_METHODS = new Set(["POST", "PUT", "PATCH", "DELETE"]);

export async function auditTrailMiddleware(c: Context, next: Next) {
  const method = c.req.method;

  await next();

  // Record audit trail for mutating administrative operations
  if (MUTATION_METHODS.has(method) && c.req.path.startsWith("/api/")) {
    const user = c.get("user");

    if (user?.role === "admin") {
      const startTime = c.get("startTime");
      createAuditLog({
        requestId: c.get("requestId"),
        userId: user.sub,
        userEmail: user.email,
        userRole: user.adminRole || user.role,
        method,
        path: c.req.path,
        statusCode: c.res.status,
        ip: getClientIp(c),
        userAgent: c.req.header("user-agent"),
        durationMs: startTime ? Math.round(performance.now() - startTime) : undefined,
      });
    }
  }
}
