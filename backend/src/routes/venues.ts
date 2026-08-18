import { Hono } from "hono";
import { zValidator } from "@hono/zod-validator";
import { z } from "zod";
import * as venueService from "../services/venue.service";
import { authMiddleware, superAdminOnly } from "../lib/middleware";

const venueRoute = new Hono();

const venueIdParamSchema = z.object({
  id: z.string().uuid("Invalid venue ID format"),
});

const listQuerySchema = z.object({
  q: z.string().optional(),
  page: z
    .string()
    .optional()
    .transform((val) => (val ? Math.max(1, parseInt(val, 10)) : 1)),
  limit: z
    .string()
    .optional()
    .transform((val) => (val ? Math.min(100, Math.max(1, parseInt(val, 10))) : 10)),
});

const createVenueSchema = z.object({
  name: z
    .string()
    .min(1, "Nama venue wajib diisi")
    .max(200, "Nama venue maksimum 200 karakter"),
  address: z.string().min(1, "Alamat wajib diisi"),
  city: z.string().min(1, "Kota wajib diisi").max(100, "Kota maksimum 100 karakter"),
  imageUrl: z.string().url("Invalid image URL format").optional().or(z.literal("")),
  sortOrder: z.number().int().optional(),
});

const updateVenueSchema = z.object({
  name: z
    .string()
    .min(1, "Nama venue wajib diisi")
    .max(200, "Nama venue maksimum 200 karakter")
    .optional(),
  address: z.string().min(1, "Alamat wajib diisi").optional(),
  city: z.string().min(1, "Kota wajib diisi").max(100, "Kota maksimum 100 karakter").optional(),
  imageUrl: z.string().url("Invalid image URL format").optional().or(z.literal("")),
  sortOrder: z.number().int().optional(),
});

// GET /api/venues — admin list (admin + staff read)
venueRoute.get("/", authMiddleware, superAdminOnly, zValidator("query", listQuerySchema), async (c) => {
  const query = c.req.valid("query");
  const result = await venueService.getAllVenues(query.q, query.page, query.limit);
  return c.json({
    data: result.items,
    pagination: result.pagination,
  });
});

// GET /api/venues/:id — admin detail
venueRoute.get("/:id", authMiddleware, superAdminOnly, zValidator("param", venueIdParamSchema), async (c) => {
  const { id } = c.req.valid("param");
  const data = await venueService.getVenueById(id);
  return c.json({ data });
});

// POST /api/venues — super admin only
venueRoute.post(
  "/",
  authMiddleware,
  superAdminOnly,
  zValidator("json", createVenueSchema),
  async (c) => {
    const body = c.req.valid("json");
    const data = await venueService.createVenue(body);
    return c.json(
      {
        message: "Venue created successfully",
        data,
      },
      201
    );
  }
);

// PUT /api/venues/:id — super admin only
venueRoute.put(
  "/:id",
  authMiddleware,
  superAdminOnly,
  zValidator("param", venueIdParamSchema),
  zValidator("json", updateVenueSchema),
  async (c) => {
    const { id } = c.req.valid("param");
    const body = c.req.valid("json");
    const data = await venueService.updateVenue(id, body);
    return c.json({
      message: "Venue updated successfully",
      data,
    });
  }
);

// DELETE /api/venues/:id — super admin only (+ B2 cleanup)
venueRoute.delete(
  "/:id",
  authMiddleware,
  superAdminOnly,
  zValidator("param", venueIdParamSchema),
  async (c) => {
    const { id } = c.req.valid("param");
    await venueService.deleteVenue(id);
    return c.json({
      message: "Venue deleted successfully",
    });
  }
);

export default venueRoute;