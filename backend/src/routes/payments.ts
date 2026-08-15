// src/routes/payments.ts
// Payment routes — Midtrans Snap tokens, Webhook notifications, Auto-expire

import { Hono } from "hono";
import { zValidator } from "@hono/zod-validator";
import { z } from "zod";
import * as paymentService from "../services/payment.service";
import {
  authMiddleware,
  adminOnly,
  customerOnly,
} from "../lib/middleware";

const paymentRoute = new Hono();

const createTokenSchema = z.object({
  orderId: z.string().uuid("Invalid order ID format"),
});

// POST /api/payments/midtrans/token — (Customer initiates Midtrans Snap payment)
paymentRoute.post(
  "/midtrans/token",
  authMiddleware,
  customerOnly,
  zValidator("json", createTokenSchema),
  async (c) => {
    const user = c.get("user");
    const { orderId } = c.req.valid("json");
    const data = await paymentService.createSnapToken(user.sub, orderId);
    return c.json({ data }, 201);
  }
);

// POST /api/payments/midtrans/notification — (Public Midtrans Webhook)
paymentRoute.post("/midtrans/notification", async (c) => {
  const payload = await c.req.json();
  const result = await paymentService.handleMidtransWebhook(payload);
  return c.json(result, 200);
});

// POST /api/payments/expire-pending — (Admin triggers overdue order sweep)
paymentRoute.post(
  "/expire-pending",
  authMiddleware,
  adminOnly,
  async (c) => {
    const result = await paymentService.expireOverduePendingOrders();
    return c.json({
      message: "Expired pending orders processed",
      ...result,
    });
  }
);

export default paymentRoute;
