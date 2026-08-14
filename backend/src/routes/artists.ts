import { Hono } from "hono";
import { zValidator } from "@hono/zod-validator";
import { z } from "zod";
import * as artistService from "../services/artist.service";
import { authMiddleware, adminOnly, superAdminOnly } from "../lib/middleware";

const artistsRoute = new Hono();

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

const createArtistSchema = z.object({
  name: z
    .string()
    .min(1, "Name is required")
    .max(150, "Name max length is 150 characters"),
  bio: z.string().optional(),
  photoUrl: z
    .string()
    .url("Invalid photo URL format")
    .optional()
    .or(z.literal("")),
});

const updateArtistSchema = z.object({
  name: z
    .string()
    .min(1, "Name is required")
    .max(150, "Name max length is 150 characters")
    .optional(),
  bio: z.string().optional(),
  photoUrl: z
    .string()
    .url("Invalid photo URL format")
    .optional()
    .or(z.literal("")),
});

// GET /api/artists - Public list with optional search (?q=) + pagination
artistsRoute.get("/", zValidator("query", listQuerySchema), async (c) => {
  const query = c.req.valid("query");
  const result = await artistService.getAllArtists(query.q, query.page, query.limit);
  return c.json({
    data: result.items,
    pagination: result.pagination,
  });
});

// GET /api/artists/:id - Public detail view
artistsRoute.get("/:id", async (c) => {
  const id = c.req.param("id");
  const data = await artistService.getArtistById(id);
  return c.json({
    data,
  });
});

// POST /api/artists - Admin only create
artistsRoute.post(
  "/",
  authMiddleware,
  superAdminOnly,
  zValidator("json", createArtistSchema),
  async (c) => {
    const body = c.req.valid("json");
    const data = await artistService.createArtist(body);
    return c.json(
      {
        message: "Artist created successfully",
        data,
      },
      201
    );
  }
);

// PUT /api/artists/:id - Admin only update
artistsRoute.put(
  "/:id",
  authMiddleware,
  superAdminOnly,
  zValidator("json", updateArtistSchema),
  async (c) => {
    const id = c.req.param("id")!;
    const body = c.req.valid("json");
    const data = await artistService.updateArtist(id, body);
    return c.json({
      message: "Artist updated successfully",
      data,
    });
  }
);

// DELETE /api/artists/:id - Admin only delete
artistsRoute.delete("/:id", authMiddleware, superAdminOnly, async (c) => {
  const id = c.req.param("id")!;
  const data = await artistService.deleteArtist(id);
  return c.json({
    message: "Artist deleted successfully",
    data,
  });
});

export default artistsRoute;
