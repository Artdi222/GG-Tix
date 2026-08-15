import * as orderRepo from "../repositories/order.repository";
import { AppError } from "../lib/errors";
import { isMidtransConfigured } from "../lib/midtrans";
import { createSnapToken } from "./payment.service";

export interface PlaceOrderDTO {
  eventId: string;
  categoryId: string;
  quantity: number;
}

export async function placeOrder(customerId: string, data: PlaceOrderDTO) {
  const result = await orderRepo.createOrder({
    customerId,
    eventId: data.eventId,
    categoryId: data.categoryId,
    quantity: data.quantity,
  });

  // Handle transaction-level errors
  if (result && typeof result === "object" && "error" in result) {
    switch (result.error) {
      case "EVENT_NOT_FOUND":
        throw new AppError("Event not found", 404);
      case "EVENT_CLOSED":
        throw new AppError("Ticket sales are closed for this event", 403);
      case "CATEGORY_NOT_FOUND":
        throw new AppError("Ticket category not found for this event", 404);
      case "INSUFFICIENT_QUOTA":
        throw new AppError("Not enough tickets remaining", 409, {
          available: String(result.available),
        });
    }
  }

  let payment:
    | { snapToken: string; redirectUrl: string; expiresAt: string }
    | undefined;

  if (isMidtransConfigured()) {
    try {
      const snapData = await createSnapToken(customerId, result.id);
      payment = {
        snapToken: snapData.snapToken,
        redirectUrl: snapData.redirectUrl,
        expiresAt: snapData.expiresAt,
      };
    } catch (err) {
      console.error("Failed to generate Midtrans Snap token on create order:", err);
    }
  }

  return {
    order: result,
    payment,
  };
}

export async function getCustomerOrders(
  customerId: string,
  page?: number,
  limit?: number
) {
  return await orderRepo.findOrdersByCustomerId(customerId, page ?? 1, limit ?? 10);
}

export async function listOrders(filters: orderRepo.OrderQueryFilters) {
  return await orderRepo.findOrders(filters);
}

export async function verifyOrder(
  orderId: string,
  decision: "verified" | "rejected",
  adminId: string
) {
  const result = await orderRepo.verifyOrder(orderId, decision, adminId);

  if (result && typeof result === "object" && "error" in result) {
    switch (result.error) {
      case "ORDER_NOT_FOUND":
        throw new AppError("Order not found", 404);
      case "ORDER_ALREADY_PROCESSED":
        throw new AppError(
          `Order has already been ${result.currentStatus}`,
          409
        );
    }
  }

  return result;
}
