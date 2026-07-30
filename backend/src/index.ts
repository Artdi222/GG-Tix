import { Hono } from "hono";
import { logger } from "hono/logger";
import { cors } from "hono/cors";
import { errorHandler } from "./lib/errors";
import healthRoute from "./routes/health";
import authRoute from "./routes/auth";
import eventRoute from "./routes/event";

const app = new Hono();

// Global Middlewares
app.use("*", logger());
app.use("*", cors());

// Global Error Handler
app.onError(errorHandler);

// Base API Route Group
const api = new Hono();
api.route("/health", healthRoute);
api.route("/auth", authRoute);
api.route("/events", eventRoute);

// Mount under /api prefix
app.route("/api", api);

app.get("/", (c) => {
  return c.text("GG Tix API Server - Running");
});

export default {
  port: process.env.PORT ? parseInt(process.env.PORT) : 3000,
  fetch: app.fetch,
};
