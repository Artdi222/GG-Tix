// src/routes/payments.ts
// Payment routes — Midtrans Snap tokens, Webhook notifications, Auto-expire

import { Hono } from "hono";
import { zValidator } from "@hono/zod-validator";
import { z } from "zod";
import * as paymentService from "../services/payment.service";
import { paymentReturnUrlSchema } from '../lib/payment-return';
import {
  authMiddleware,
  adminOrHigher,
  customerOnly,
  rateLimit,
} from "../lib/middleware";

const paymentRoute = new Hono();
const paymentSyncLimit = rateLimit({ windowMs: 60000, max: 30, key: 'payment-sync' });
const paymentSessionLimit = rateLimit({ windowMs: 60000, max: 10, key: 'payment-session' });

const createTokenSchema = z.object({
  orderId: z.string().uuid("Invalid order ID format"),
  paymentReturnUrl: paymentReturnUrlSchema,
});

// POST /api/payments/midtrans/token — (Customer initiates Midtrans Snap payment)
paymentRoute.post(
  "/midtrans/token",
  authMiddleware,
  customerOnly,
  paymentSessionLimit,
  zValidator("json", createTokenSchema),
  async (c) => {
    const user = c.get("user");
    const { orderId, paymentReturnUrl } = c.req.valid("json");
    const data = await paymentService.createSnapToken(user.sub, orderId, paymentReturnUrl);
    return c.json({ data }, 201);
  }
);

const orderParam = z.object({ orderId: z.string().uuid() });
paymentRoute.get('/midtrans/:orderId', authMiddleware, customerOnly, zValidator('param', orderParam), async c => {
  return c.json({ data: await paymentService.getCustomerPayment(c.get('user').sub, c.req.valid('param').orderId) });
});
paymentRoute.post('/midtrans/:orderId/sync', authMiddleware, customerOnly, paymentSyncLimit, zValidator('param', orderParam), async c => {
  return c.json({ data: await paymentService.syncCustomerPayment(c.get('user').sub, c.req.valid('param').orderId) });
});

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
  adminOrHigher,
  async (c) => {
    const result = await paymentService.expireOverduePendingOrders();
    return c.json({
      message: "Expired pending orders processed",
      ...result,
    });
  }
);

export default paymentRoute;
