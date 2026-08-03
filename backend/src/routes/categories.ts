import { Hono } from "hono";
import { zValidator } from "@hono/zod-validator";
import { z } from "zod";
import * as categoryService from "../services/category.service";
import { authMiddleware, adminOnly } from "../lib/middleware";

const categoryRoute = new Hono();

const createCategorySchema = z.object({
  name: z
    .string()
    .min(1, "Name is required")
    .max(50, "Name max length is 50 characters"),
  price: z
    .string()
    .regex(/^\d+(\.\d{1,2})?$/, "Price must be a valid decimal (e.g. 500000.00)"),
  quotaTotal: z
    .number()
    .int("Quota must be a whole number")
    .min(1, "Quota must be at least 1"),
});

const updateCategorySchema = z.object({
  name: z
    .string()
    .min(1, "Name is required")
    .max(50, "Name max length is 50 characters")
    .optional(),
  price: z
    .string()
    .regex(/^\d+(\.\d{1,2})?$/, "Price must be a valid decimal (e.g. 500000.00)")
    .optional(),
  quotaTotal: z
    .number()
    .int("Quota must be a whole number")
    .min(1, "Quota must be at least 1")
    .optional(),
});

const eventIdParamSchema = z.object({
  eventId: z.string().uuid("Invalid event ID format"),
});

const categoryIdParamSchema = z.object({
  id: z.string().uuid("Invalid category ID format"),
});

// GET /api/events/:eventId/categories - List categories for an event (public)
categoryRoute.get(
  "/events/:eventId/categories",
  zValidator("param", eventIdParamSchema),
  async (c) => {
    const { eventId } = c.req.valid("param");
    const data = await categoryService.getCategoriesByEventId(eventId);
    return c.json({ data });
  }
);

// POST /api/events/:eventId/categories - Admin create category for event
categoryRoute.post(
  "/events/:eventId/categories",
  authMiddleware,
  adminOnly,
  zValidator("param", eventIdParamSchema),
  zValidator("json", createCategorySchema),
  async (c) => {
    const { eventId } = c.req.valid("param");
    const body = c.req.valid("json");
    const data = await categoryService.createCategory(eventId, body);
    return c.json(
      {
        message: "Category created successfully",
        data,
      },
      201
    );
  }
);

// PUT /api/categories/:id - Admin update category
categoryRoute.put(
  "/categories/:id",
  authMiddleware,
  adminOnly,
  zValidator("param", categoryIdParamSchema),
  zValidator("json", updateCategorySchema),
  async (c) => {
    const { id } = c.req.valid("param");
    const body = c.req.valid("json");
    const data = await categoryService.updateCategory(id, body);
    return c.json({
      message: "Category updated successfully",
      data,
    });
  }
);

// DELETE /api/categories/:id - Admin delete category
categoryRoute.delete(
  "/categories/:id",
  authMiddleware,
  adminOnly,
  zValidator("param", categoryIdParamSchema),
  async (c) => {
    const { id } = c.req.valid("param");
    await categoryService.deleteCategory(id);
    return c.json({
      message: "Category deleted successfully",
    });
  }
);

export default categoryRoute;
