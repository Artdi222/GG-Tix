import * as orderRepo from "../repositories/order.repository";
import { AppError } from "../lib/errors";
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

  // Handle transaction-level errors
  if (result && typeof result === "object" && "error" in result) {
    switch (result.error) {
      case 'MAINTENANCE': throw new AppError('Pemesanan sementara ditutup untuk pemeliharaan. Tiket yang sudah dibeli tetap dapat diakses.', 503);
      case 'ORDER_LIMIT': throw new AppError(`Maksimal ${result.maxTickets} tiket per pesanan.`, 400);
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
      case "VOUCHER_NOT_FOUND":
        throw new AppError("Kode promo tidak ditemukan atau sudah tidak aktif.", 404);
      case "VOUCHER_NOT_STARTED":
        throw new AppError("Masa berlaku kode promo ini belum dimulai.", 400);
      case "VOUCHER_EXPIRED":
        throw new AppError("Masa berlaku kode promo ini telah berakhir.", 400);
      case "VOUCHER_QUOTA_EXCEEDED":
        throw new AppError("Yah, kuota promo ini sudah habis terpakai.", 409);
      case "VOUCHER_EVENT_MISMATCH":
        throw new AppError("Kode promo ini tidak berlaku untuk konser yang dipilih.", 400);
      case "VOUCHER_MIN_SPEND_NOT_MET":
        throw new AppError("Total belanja belum mencapai batas minimum penggunaan promo.", 400);
      case "VOUCHER_CUSTOMER_LIMIT_REACHED":
        throw new AppError("Anda telah mencapai batas pemakaian untuk kode promo ini.", 400);
    }
  }

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

export { customerOrderSummary } from "../repositories/order.repository";
