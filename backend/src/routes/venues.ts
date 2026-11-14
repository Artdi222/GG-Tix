import { Hono } from "hono";
import { zValidator } from "@hono/zod-validator";
import { z } from "zod";
import { pageQuery, limitQuery } from "../lib/pagination";
import * as venueService from "../services/venue.service";
import { authMiddleware, adminOrHigher } from "../lib/middleware";

const venueRoute = new Hono();

const venueIdParamSchema = z.object({
  id: z.string().uuid("Invalid venue ID format"),
});

const listQuerySchema = z.object({
  q: z.string().optional(),
  active: z.enum(["true", "false"]).optional().transform((v) => (v === undefined ? undefined : v === "true")),
  page: pageQuery(),
  limit: limitQuery(10),
});

// Must be a zone the runtime knows, e.g. "Asia/Jakarta" or "Europe/Paris".
const timezoneSchema = z.string().max(64).refine((tz) => {
  try { new Intl.DateTimeFormat("en", { timeZone: tz }); return true; } catch { return false; }
}, "Zona waktu tidak dikenal");

const createVenueSchema = z.object({
  name: z
    .string()
    .min(1, "Nama venue wajib diisi")
    .max(200, "Nama venue maksimum 200 karakter"),
  address: z.string().min(1, "Alamat wajib diisi"),
  city: z.string().min(1, "Kota wajib diisi").max(100, "Kota maksimum 100 karakter"),
  timezone: timezoneSchema.optional(),
  imageUrl: z.string().url("Invalid image URL format").optional().nullable().or(z.literal("")),
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
  timezone: timezoneSchema.optional(),
  imageUrl: z.string().url("Invalid image URL format").optional().nullable().or(z.literal("")),
  sortOrder: z.number().int().optional(),
  isActive: z.boolean().optional(),
});

// GET /api/venues — admin list (admin + staff read)
venueRoute.get("/", authMiddleware, adminOrHigher, zValidator("query", listQuerySchema), async (c) => {
  const query = c.req.valid("query");
  const result = await venueService.getAllVenues(query.q, query.page, query.limit, query.active);
  return c.json({
    data: result.items,
    pagination: result.pagination,
  });
});

// GET /api/venues/cities — distinct cities for autocomplete (before /:id)
venueRoute.get("/cities", authMiddleware, adminOrHigher, async (c) => {
  const data = await venueService.getVenueCities();
  return c.json({ data });
});

// GET /api/venues/:id — admin detail
venueRoute.get("/:id", authMiddleware, adminOrHigher, zValidator("param", venueIdParamSchema), async (c) => {
  const { id } = c.req.valid("param");
  const data = await venueService.getVenueById(id);
  return c.json({ data });
});

// POST /api/venues — admin or higher
venueRoute.post(
  "/",
  authMiddleware,
  adminOrHigher,
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

// PUT /api/venues/:id — admin or higher
venueRoute.put(
  "/:id",
  authMiddleware,
  adminOrHigher,
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

// DELETE /api/venues/:id — admin or higher (+ B2 cleanup)
venueRoute.delete(
  "/:id",
  authMiddleware,
  adminOrHigher,
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