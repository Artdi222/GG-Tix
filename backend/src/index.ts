import { Hono } from "hono";
import { logger } from "hono/logger";
import { cors } from "hono/cors";
import { errorHandler } from "./lib/errors";
import { bodySizeLimit } from "./lib/middleware";
import healthRoute from "./routes/health";
import authRoute from "./routes/auth";
import eventRoute from "./routes/event";
import artistsRoute from "./routes/artists";
import categoryRoute from "./routes/categories";
import orderRoute from "./routes/orders";
import dashboardRoute from "./routes/dashboard";

const app = new Hono();

// CORS origin whitelist
const corsOrigins = (process.env.CORS_ORIGINS || "")
  .split(",")
  .map((o) => o.trim())
  .filter(Boolean);
if (process.env.NODE_ENV !== "production") {
  corsOrigins.push("http://localhost:5173", "http://localhost:3001", "http://localhost:3000");
}

// Global Middlewares
app.use("*", logger());
app.use("*", cors({ origin: corsOrigins, credentials: true }));
app.use("*", bodySizeLimit());

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
