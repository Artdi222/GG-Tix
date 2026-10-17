import * as orderRepo from "../repositories/order.repository";
import { isMidtransConfigured } from "../lib/midtrans";
import { createSnapToken } from "./payment.service";

export interface PlaceOrderDTO {
  eventId: string;
  categoryId: string;
  quantity: number;
  voucherCode?: string;
  paymentReturnUrl?: string;
}

export async function placeOrder(customerId: string, data: PlaceOrderDTO) {
  const result = await orderRepo.createOrder({
    customerId,
    eventId: data.eventId,
    categoryId: data.categoryId,
    quantity: data.quantity,
    voucherCode: data.voucherCode,
  });

  let payment:
    | { snapToken: string; redirectUrl: string; expiresAt: string }
    | undefined;

  if (isMidtransConfigured() && result.status === "pending") {
    try {
      const snapData = await createSnapToken(customerId, result.id, data.paymentReturnUrl);
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
  limit?: number,
  status?: "pending" | "verified" | "failed" | "active"
) {
  return await orderRepo.findOrdersByCustomerId(customerId, page ?? 1, limit ?? 10, status);
}

export async function listOrders(filters: orderRepo.OrderQueryFilters) {
  return await orderRepo.findOrders(filters);
}

export async function verifyOrder(
  orderId: string,
  decision: "verified" | "rejected",
  adminId: string
) {
  return orderRepo.verifyOrder(orderId, decision, adminId);
}

export { customerOrderSummary, orderStats } from "../repositories/order.repository";
