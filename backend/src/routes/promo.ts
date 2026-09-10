import { Hono } from "hono";
import { zValidator } from "@hono/zod-validator";
import { z } from "zod";
import * as promoService from "../services/promo.service";
import {
  authMiddleware,
  adminOrHigher,
  superAdminOnly,
  customerOnly,
  orderRateLimiter,
} from "../lib/middleware";

const promoRoute = new Hono();

const validatePromoSchema = z.object({
  code: z.string().min(1, "Kode promo wajib diisi"),
  eventId: z.string().uuid("Invalid event ID format"),
  categoryId: z.string().uuid("Invalid category ID format"),
  quantity: z.number().int().min(1, "Quantity minimal 1"),
});

const createVoucherSchema = z.object({
  code: z
    .string()
    .min(3, "Kode promo minimal 3 karakter")
    .max(50, "Kode promo maksimal 50 karakter")
    .regex(/^[a-zA-Z0-9_-]+$/, "Kode promo hanya boleh mengandung huruf, angka, tanda strip, dan underscore"),
  name: z.string().min(2, "Nama promo minimal 2 karakter").max(150),
  description: z.string().optional(),
  discountType: z.enum(["fixed", "percentage"], {
    errorMap: () => ({ message: "Tipe diskon harus 'fixed' atau 'percentage'" }),
  }),
  discountValue: z
    .string()
    .regex(/^\d+(\.\d{1,2})?$/, "Nilai diskon harus berupa angka desimal valid"),
  maxDiscountAmount: z
    .string()
    .regex(/^\d+(\.\d{1,2})?$/, "Maksimal diskon harus berupa angka desimal valid")
    .optional()
    .nullable(),
  minOrderAmount: z
    .string()
    .regex(/^\d+(\.\d{1,2})?$/, "Minimal order harus berupa angka desimal valid")
    .default("0.00"),
  quotaTotal: z.number().int().min(1, "Kuota total minimal 1"),
  maxUsagePerCustomer: z.number().int().min(1, "Maksimal pemakaian minimal 1").default(1),
  eventId: z.string().uuid("Invalid event ID format").optional().nullable(),
  startDate: z.string().datetime().optional().transform((v) => (v ? new Date(v) : undefined)),
  endDate: z.string().datetime("Tanggal berakhir harus format ISO 8601 valid").transform((v) => new Date(v)),
  isActive: z.boolean().default(true),
});

const updateVoucherSchema = createVoucherSchema.partial();

const voucherQuerySchema = z.object({
  search: z.string().optional(),
  status: z.enum(["active", "inactive"]).optional(),
  eventId: z.string().uuid().optional(),
  page: z.string().optional().transform((v) => (v ? Math.max(1, parseInt(v, 10)) : 1)),
  limit: z.string().optional().transform((v) => (v ? Math.min(100, Math.max(1, parseInt(v, 10))) : 15)),
});

// 1. Customer endpoint: Validate promo code
promoRoute.post(
  "/validate",
  authMiddleware,
  customerOnly,
  orderRateLimiter,
  zValidator("json", validatePromoSchema),
  async (c) => {
    const user = c.get("user");
    const body = c.req.valid("json");
    const result = await promoService.validatePromo({
      ...body,
      customerId: user.sub,
    });
    return c.json({ data: result });
  }
);

// 2. Admin endpoints: Voucher Management
export const vouchersRoute = new Hono();

// GET /api/vouchers/stats - KPI statistics
vouchersRoute.get("/stats", authMiddleware, adminOrHigher, async (c) => {
  const stats = await promoService.getVoucherStats();
  return c.json({ data: stats });
});

// GET /api/vouchers - List all vouchers with pagination & filters
vouchersRoute.get("/", authMiddleware, adminOrHigher, zValidator("query", voucherQuerySchema), async (c) => {
  const query = c.req.valid("query");
  const result = await promoService.listVouchers(query);
  return c.json({
    data: result.items,
    pagination: result.pagination,
  });
});

// GET /api/vouchers/:id - Detail voucher
vouchersRoute.get("/:id", authMiddleware, adminOrHigher, async (c) => {
  const id = c.req.param("id")!;
  const voucher = await promoService.getVoucherById(id);
  return c.json({ data: voucher });
});

// POST /api/vouchers - Create voucher
vouchersRoute.post("/", authMiddleware, adminOrHigher, zValidator("json", createVoucherSchema), async (c) => {
  const user = c.get("user");
  const body = c.req.valid("json");
  const newVoucher = await promoService.createVoucher(user.sub, body);
  return c.json(
    {
      message: "Voucher berhasil dibuat.",
      data: newVoucher,
    },
    201
  );
});

// PUT /api/vouchers/:id - Update voucher
vouchersRoute.put("/:id", authMiddleware, adminOrHigher, zValidator("json", updateVoucherSchema), async (c) => {
  const id = c.req.param("id")!;
  const body = c.req.valid("json");
  const updated = await promoService.updateVoucher(id, body);
  return c.json({
    message: "Voucher berhasil diperbarui.",
    data: updated,
  });
});

// PATCH /api/vouchers/:id/toggle - Toggle active status
vouchersRoute.patch("/:id/toggle", authMiddleware, adminOrHigher, async (c) => {
  const id = c.req.param("id")!;
  const updated = await promoService.toggleVoucher(id);
  return c.json({
    message: `Voucher status diubah menjadi ${updated.isActive ? "aktif" : "nonaktif"}.`,
    data: updated,
  });
});

// DELETE /api/vouchers/:id - Delete voucher (Super Admin only, only if never used)
vouchersRoute.delete("/:id", authMiddleware, superAdminOnly, async (c) => {
  const id = c.req.param("id")!;
  const result = await promoService.deleteVoucher(id);
  return c.json(result);
});

// GET /api/vouchers/:id/usages - View transactions that used this voucher
vouchersRoute.get("/:id/usages", authMiddleware, adminOrHigher, async (c) => {
  const id = c.req.param("id")!;
  const page = parseInt(c.req.query("page") || "1", 10);
  const limit = parseInt(c.req.query("limit") || "20", 10);
  const result = await promoService.getVoucherUsages(id, page, limit);
  return c.json({
    data: result.items,
    pagination: result.pagination,
  });
});

export default promoRoute;
