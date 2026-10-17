import { Hono } from "hono";
import { zValidator } from "@hono/zod-validator";
import { z } from "zod";
import { pageQuery, limitQuery } from "../lib/pagination";
import * as settingsService from "../services/settings.service";
import { authMiddleware, superAdminOnly } from "../lib/middleware";

const settingsRoute = new Hono();

const updateSettingsSchema = z.object({
  defaultMaxTicketsPerOrder: z.number().int().min(1).max(10).optional(),
  pendingOrderExpiryMinutes: z.number().int().min(5).max(120).optional(),
  supportEmail: z.string().email().optional(),
  supportWhatsapp: z.string().optional(),
  maintenanceMode: z.boolean().optional(),
});

const auditLogQuerySchema = z.object({
  search: z.string().optional(),
  method: z.string().optional(),
  statusCode: z.string().optional().transform((v) => { const n = parseInt(v ?? "", 10); return Number.isFinite(n) ? n : undefined; }),
  page: pageQuery(),
  limit: limitQuery(15),
});

settingsRoute.get('/public', async c => {
  const { defaultMaxTicketsPerOrder, maintenanceMode, supportEmail, supportWhatsapp } = await settingsService.getSystemSettings();
  return c.json({ data: { defaultMaxTicketsPerOrder, maintenanceMode, supportEmail, supportWhatsapp } });
});

// GET /api/settings/system
settingsRoute.get("/system", authMiddleware, superAdminOnly, async (c) => {
  const settings = await settingsService.getSystemSettings();
  return c.json({ data: settings });
});

// PATCH /api/settings/system
settingsRoute.patch("/system", authMiddleware, superAdminOnly, zValidator("json", updateSettingsSchema), async (c) => {
  const body = c.req.valid("json");
  const settings = await settingsService.updateSystemSettings(body);
  return c.json({
    message: "Pengaturan berhasil diperbarui.",
    data: settings,
  });
});

// GET /api/settings/audit-logs
settingsRoute.get("/audit-logs", authMiddleware, superAdminOnly, zValidator("query", auditLogQuerySchema), async (c) => {
  const query = c.req.valid("query");
  const result = await settingsService.getAuditLogs(query);
  return c.json({
    data: result.items,
    pagination: result.pagination,
  });
});

// GET /api/settings/diagnostics
settingsRoute.get("/diagnostics", authMiddleware, superAdminOnly, async (c) => {
  const diagnostics = await settingsService.getDiagnostics();
  return c.json({ data: diagnostics });
});

export default settingsRoute;
