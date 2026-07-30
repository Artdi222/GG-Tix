import { Hono } from "hono";
import { zValidator } from "@hono/zod-validator";
import { z } from "zod";
import * as artistService from "../services/artist.service";
import { authMiddleware, adminOnly } from "../lib/middleware";

const artistsRoute = new Hono();

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

// GET /api/artists - Public list with optional search query (?q= or ?search=)
artistsRoute.get("/", async (c) => {
  const search = c.req.query("q") || c.req.query("search");
  const data = await artistService.getAllArtists(search);
  return c.json({
    data,
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
  adminOnly,
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
  adminOnly,
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
artistsRoute.delete("/:id", authMiddleware, adminOnly, async (c) => {
  const id = c.req.param("id")!;
  const data = await artistService.deleteArtist(id);
  return c.json({
    message: "Artist deleted successfully",
    data,
  });
});

export default artistsRoute;
