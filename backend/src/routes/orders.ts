import { Hono } from "hono";
import { zValidator } from "@hono/zod-validator";
import { z } from "zod";
import * as orderService from "../services/order.service";
import {
  authMiddleware,
  adminOnly,
  customerOnly,
  orderRateLimiter,
} from "../lib/middleware";

const orderRoute = new Hono();

const placeOrderSchema = z.object({
  eventId: z.string().uuid("Invalid event ID format"),
  categoryId: z.string().uuid("Invalid category ID format"),
  quantity: z
    .number()
    .int("Quantity must be a whole number")
    .min(1, "Quantity must be at least 1"),
});

const verifyOrderSchema = z.object({
  decision: z.enum(["verified", "rejected"], {
    errorMap: () => ({ message: "Decision must be 'verified' or 'rejected'" }),
  }),
});

const orderIdParamSchema = z.object({
  id: z.string().uuid("Invalid order ID format"),
});

const adminQuerySchema = z.object({
  status: z.enum(["pending", "verified", "rejected", "expired"]).optional(),
  eventId: z.string().uuid().optional(),
  page: z
    .string()
    .optional()
    .transform((val) => (val ? Math.max(1, parseInt(val, 10)) : 1)),
  limit: z
    .string()
    .optional()
    .transform((val) =>
      val ? Math.min(100, Math.max(1, parseInt(val, 10))) : 10
    ),
});

const customerQuerySchema = z.object({
  page: z
    .string()
    .optional()
    .transform((val) => (val ? Math.max(1, parseInt(val, 10)) : 1)),
  limit: z
    .string()
    .optional()
    .transform((val) =>
      val ? Math.min(100, Math.max(1, parseInt(val, 10))) : 10
    ),
});

// POST /api/orders — (customer places order)
orderRoute.post(
  "/",
  authMiddleware,
  customerOnly,
  orderRateLimiter,
  zValidator("json", placeOrderSchema),
  async (c) => {
    const user = c.get("user");
    const body = c.req.valid("json");
    const { order, payment } = await orderService.placeOrder(user.sub, body);
    return c.json(
      {
        message: "Order placed successfully",
        data: order,
        ...(payment ? { payment } : {}),
      },
      201
    );
  }
);

// GET /api/orders/me — (customer's own order history)
orderRoute.get(
  "/me",
  authMiddleware,
  customerOnly,
  zValidator("query", customerQuerySchema),
  async (c) => {
    const user = c.get("user");
    const query = c.req.valid("query");
    const result = await orderService.getCustomerOrders(user.sub, query.page, query.limit);
    return c.json({ data: result.items, pagination: result.pagination });
  }
);

// GET /api/orders — (admin sees all orders)
orderRoute.get(
  "/",
  authMiddleware,
  adminOnly,
  zValidator("query", adminQuerySchema),
  async (c) => {
    const query = c.req.valid("query");
    const result = await orderService.listOrders(query);
    return c.json({
      data: result.items,
      pagination: result.pagination,
    });
  }
);

// PATCH /api/orders/:id/verify — (admin verify/reject payment)
orderRoute.patch(
  "/:id/verify",
  authMiddleware,
  adminOnly,
  zValidator("param", orderIdParamSchema),
  zValidator("json", verifyOrderSchema),
  async (c) => {
    const { id } = c.req.valid("param");
    const { decision } = c.req.valid("json");
    const user = c.get("user");
    const data = await orderService.verifyOrder(id, decision, user.sub);
    return c.json({
      message: `Order ${decision} successfully`,
      data,
    });
  }
);

export default orderRoute;
