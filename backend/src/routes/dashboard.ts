import { Hono } from "hono";
import { zValidator } from "@hono/zod-validator";
import { z } from "zod";
import * as dashboardService from "../services/dashboard.service";
import { authMiddleware, adminOnly } from "../lib/middleware";
import { AppError } from "../lib/errors";

const dashboardRoute = new Hono();

const rangeQuerySchema = z.object({
  days: z
    .string()
    .optional()
    .transform((val) => (val ? Math.min(90, Math.max(1, parseInt(val, 10))) : undefined)),
  from: z.string().optional(),
  to: z.string().optional(),
});

function rangeValidationHook(result: any) {
  if (!result.success) {
    throw new AppError("Rentang tanggal tidak valid. Silakan periksa tanggal awal dan akhir.", 400);
  }

  const { from, to } = result.data;
  if ((from && !to) || (!from && to)) {
    throw new AppError("Rentang tanggal tidak valid. Silakan periksa tanggal awal dan akhir.", 400);
  }

  if (from && to) {
    const fromDate = new Date(from);
    const toDate = new Date(to);
    if (
      isNaN(fromDate.getTime()) ||
      isNaN(toDate.getTime()) ||
      fromDate > toDate
    ) {
      throw new AppError("Rentang tanggal tidak valid. Silakan periksa tanggal awal dan akhir.", 400);
    }
  }
}

function buildQuery(query: z.infer<typeof rangeQuerySchema>) {
  return {
    days: query.days,
    from: query.from,
    to: query.to,
  };
}

// GET /api/dashboard/summary (admin dashboard)
dashboardRoute.get(
  "/summary",
  authMiddleware,
  adminOnly,
  zValidator("query", rangeQuerySchema, (result) => rangeValidationHook(result)),
  async (c) => {
    const query = c.req.valid("query");
    const data = await dashboardService.getSummary(buildQuery(query));
    return c.json(data);
  }
);

// GET /api/dashboard/events?eventId= (admin, per-event occupancy & check-in)
dashboardRoute.get(
  "/events",
  authMiddleware,
  adminOnly,
  zValidator("query", z.object({ eventId: z.string().uuid().optional() })),
  async (c) => {
    const { eventId } = c.req.valid("query");
    const data = await dashboardService.getEvents(eventId);
    return c.json({ data });
  }
);

// GET /api/dashboard/trend?days=30 (admin, daily sales trend)
dashboardRoute.get(
  "/trend",
  authMiddleware,
  adminOnly,
  zValidator("query", rangeQuerySchema, (result) => rangeValidationHook(result)),
  async (c) => {
    const query = c.req.valid("query");
    const data = await dashboardService.getTrend(buildQuery(query));
    return c.json(data);
  }
);

export default dashboardRoute;
