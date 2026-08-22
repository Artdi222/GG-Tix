import { Hono } from "hono";
import { logger } from "hono/logger";
import { cors } from "hono/cors";
import { errorHandler } from "./lib/errors";
import {
  requestIdMiddleware,
  timingMiddleware,
  securityHeadersMiddleware,
  bodySizeLimit,
  auditTrailMiddleware,
} from "./lib/middleware";
import { assertB2Configured } from "./lib/storage";
import { assertMidtransConfigured } from "./lib/midtrans";
import { expireOverduePendingOrders } from "./services/payment.service";
import healthRoute from "./routes/health";
import authRoute from "./routes/auth";
import eventRoute from "./routes/event";
import artistsRoute from "./routes/artists";
import categoryRoute from "./routes/categories";
import orderRoute from "./routes/orders";
import dashboardRoute from "./routes/dashboard";
import uploadRoute from "./routes/uploads";
import venueRoute from "./routes/venues";
import usersRoute from "./routes/users";
import ticketRoute from "./routes/tickets";
import paymentRoute from "./routes/payments";

assertB2Configured();
assertMidtransConfigured();

// Auto-expire overdue pending orders every 5 minutes (30-min timeout)
setInterval(async () => {
  try {
    const res = await expireOverduePendingOrders();
    if (res.expiredCount > 0) {
      console.log(`[Auto-Expire] Swept ${res.expiredCount} overdue pending orders:`, res.orderIds);
    }
  } catch (err) {
    console.error("[Auto-Expire] Error sweeping overdue orders:", err);
  }
}, 5 * 60 * 1000);

const app = new Hono();

// CORS origin whitelist
const corsOrigins = (process.env.CORS_ORIGINS || "")
  .split(",")
  .map((o) => o.trim())
  .filter(Boolean);
if (process.env.NODE_ENV !== "production") {
  corsOrigins.push(
    "http://localhost:5173",
    "http://localhost:3001",
    "http://localhost:3000",
    "http://localhost:8081",
    "http://localhost:19006",
    "http://127.0.0.1:8081"
  );
}

// Global Middlewares Pipeline
// 1. Request ID injector & Response Time metrics
app.use("*", requestIdMiddleware);
app.use("*", timingMiddleware);

// 2. Security Headers (Helmet-Grade)
app.use("*", securityHeadersMiddleware);

// 3. Structured Request Logger
app.use("*", logger());

// 4. CORS Whitelist
app.use("*", cors({ origin: corsOrigins, credentials: true }));

// 5. Payload & Body Size Safety Guard
app.use("*", bodySizeLimit());

// 6. Administrative Audit Trail Logger
app.use("*", auditTrailMiddleware);

// Global Error Handler
app.onError(errorHandler);

// Base API Route Group
const api = new Hono();
api.route("/health", healthRoute);
api.route("/auth", authRoute);
api.route("/events", eventRoute);
api.route("/artists", artistsRoute);
api.route("/", categoryRoute);
api.route("/orders", orderRoute);
api.route("/dashboard", dashboardRoute);
api.route("/uploads", uploadRoute);
api.route("/venues", venueRoute);
api.route("/users", usersRoute);
api.route("/tickets", ticketRoute);
api.route("/payments", paymentRoute);

// Mount under /api prefix
app.route("/api", api);

app.get("/", (c) => {
  return c.text("GG Tix API Server - Running");
});

export { app };

export default {
  port: process.env.PORT ? parseInt(process.env.PORT) : 3000,
  fetch: app.fetch,
};
