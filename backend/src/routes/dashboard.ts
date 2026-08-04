import { Hono } from "hono";
import * as dashboardService from "../services/dashboard.service";
import { authMiddleware, adminOnly } from "../lib/middleware";

const dashboardRoute = new Hono();

// GET /api/dashboard/summary (admin dashboard)
dashboardRoute.get(
  "/summary",
  authMiddleware,
  adminOnly,
  async (c) => {
    const data = await dashboardService.getSummary();
    return c.json(data);
  }
);

export default dashboardRoute;
