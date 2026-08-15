import { Hono } from "hono";
import { zValidator } from "@hono/zod-validator";
import { z } from "zod";
import * as ticketService from "../services/ticket.service";
import { authMiddleware, adminOnly } from "../lib/middleware";
import { AppError } from "../lib/errors";

const ticketRoute = new Hono();

const orderIdParamSchema = z.object({
  orderId: z.string().uuid("Invalid order ID format"),
});

const eventIdParamSchema = z.object({
  eventId: z.string().uuid("Invalid event ID format"),
});

const checkInSchema = z.object({
  qrCodeValue: z.string().min(1, "QR code value is required"),
  eventId: z.string().uuid("Invalid event ID format"),
});

// GET /api/tickets/order/:orderId
ticketRoute.get(
  "/order/:orderId",
  authMiddleware,
  zValidator("param", orderIdParamSchema),
  async (c) => {
    const { orderId } = c.req.valid("param");
    const user = c.get("user");

    const result = await ticketService.findTicketsByOrderId(orderId);
    if (!result) {
      throw new AppError("Order not found or has no tickets", 404);
    }

    // Auth check: Customer can only access their own order tickets unless Admin
    if (user.role === "customer" && result.order.customerId !== user.sub) {
      throw new AppError("Forbidden: Access denied to this order tickets", 403);
    }

    return c.json({ data: result });
  }
);

// POST /api/tickets/check-in
ticketRoute.post(
  "/check-in",
  authMiddleware,
  adminOnly,
  zValidator("json", checkInSchema),
  async (c) => {
    const { qrCodeValue, eventId } = c.req.valid("json");
    const result = await ticketService.checkInTicket(qrCodeValue, eventId);

    if ("error" in result) {
      switch (result.error) {
        case "TICKET_NOT_FOUND":
          return c.json({ error: "TICKET_NOT_FOUND", message: "QR code tidak dikenali" }, 404);
        case "WRONG_EVENT":
          return c.json({ error: "WRONG_EVENT", message: "Tiket ini bukan untuk event yang dipilih" }, 403);
        case "ALREADY_CHECKED_IN":
          return c.json(
            {
              error: "ALREADY_CHECKED_IN",
              message: "Tiket sudah digunakan",
              checkedInAt: result.checkedInAt,
            },
            409
          );
      }
    }

    return c.json({ data: result });
  }
);

// GET /api/tickets/stats/:eventId
ticketRoute.get(
  "/stats/:eventId",
  authMiddleware,
  adminOnly,
  zValidator("param", eventIdParamSchema),
  async (c) => {
    const { eventId } = c.req.valid("param");
    const result = await ticketService.getEventTicketStats(eventId);

    if (!result) {
      throw new AppError("Event not found", 404);
    }

    return c.json({ data: result });
  }
);

export default ticketRoute;

