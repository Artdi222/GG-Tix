// src/services/payment.service.ts
// Midtrans Snap token generation, webhook processing & auto-expiry

import { eq, and, sql, lte } from "drizzle-orm";
import { db } from "../db";
import {
  orders,
  paymentProofs,
  ticketCategories,
  tickets,
  vouchers,
  voucherUsages,
} from "../db/schema";
import { AppError } from "../lib/errors";
import {
  createSnapTransaction,
  getTransactionStatus,
  verifySignature,
  isMidtransConfigured,
  MidtransWebhookPayload,
  SnapTransactionParams,
} from "../lib/midtrans";
import { getSystemSettings } from "./settings.service";

export function extractOrderId(midtransOrderId: string): string {
  const uuidMatch = midtransOrderId.match(
    /[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/i
  );
  if (uuidMatch) return uuidMatch[0];
  return midtransOrderId.replace(/^GGTIX-/, "");
}

/**
 * Generate a Midtrans Snap Token for a pending order
 */
export async function createSnapToken(customerId: string, orderId: string, paymentReturnUrl?: string) {
  if (!isMidtransConfigured()) {
    throw new AppError("Payment gateway is not configured", 503);
  }

  return db.transaction(async tx => {
    await tx.select().from(orders).where(eq(orders.id, orderId)).for("update");
    const order = await tx.query.orders.findFirst({ where: eq(orders.id, orderId), with: { customer: true, category: true, event: true, paymentProofs: true } });
    if (!order) {
      throw new AppError("Order not found", 404);
    }

    if (order.customerId !== customerId) {
      throw new AppError("Forbidden: You do not own this order", 403);
    }

    if (order.status !== "pending") {
      throw new AppError(
        `Cannot initiate payment for order with status '${order.status}'`,
        409
      );
    }

    const existingProof = order.paymentProofs?.[0];
    const metadata = (existingProof?.midtransResponse ?? {}) as { snap?: { token: string; redirectUrl: string; expiresAt: string } };
    if (metadata.snap) {
      if (Date.parse(metadata.snap.expiresAt) <= Date.now()) throw new AppError('Waktu pembayaran habis. Periksa status pesanan.', 409);
      return { orderId: order.id, snapToken: metadata.snap.token, redirectUrl: metadata.snap.redirectUrl, expiresAt: metadata.snap.expiresAt };
    }
    const settings = await getSystemSettings();
    const expiresAt = new Date(order.createdAt.getTime() + settings.pendingOrderExpiryMinutes * 60000).toISOString();
    if (Date.parse(expiresAt) <= Date.now()) throw new AppError('Waktu pembayaran habis. Periksa status pesanan.', 409);
    const finishUrl = paymentReturnUrl ? `${paymentReturnUrl}/${order.id}` : undefined;
    const amount = Math.round(Number(order.totalPrice));
    if (amount <= 0) throw new AppError('Pembayaran tanpa biaya belum didukung.', 409);
    const snapParams: SnapTransactionParams = {
      transaction_details: {
        order_id: `GGTIX-${order.id}`,
        gross_amount: Math.round(parseFloat(order.totalPrice)),
      },
      customer_details: {
        first_name: order.customer.name,
        email: order.customer.email,
      },
      // Snap requires the item sum to match gross_amount, including voucher discounts.
      item_details: [{ id: order.categoryId, price: amount, quantity: 1,
        name: `${order.quantity}x ${order.category.name} - ${order.event.title}`.slice(0, 50) }],
      expiry: {
        start_time: order.createdAt.toISOString().replace('T', ' ').slice(0, 19) + ' +0000',
        unit: "minutes", duration: settings.pendingOrderExpiryMinutes,
      },
      ...(finishUrl ? {
        callbacks: { finish: finishUrl, error: finishUrl },
        gopay: { enable_callback: true, callback_url: finishUrl },
        shopeepay: { callback_url: finishUrl },
      } : {}),
      enabled_payments: [
        "bank_transfer",
        "echannel",
        "bca_va",
        "bni_va",
        "bri_va",
        "permata_va",
        "qris",
        "gopay",
        "shopeepay",
      ],
    };

    const snapRes = await createSnapTransaction(snapParams);
    const snap = { token: snapRes.token, redirectUrl: snapRes.redirect_url, expiresAt };

    // Save/update initial payment proof record
    if (existingProof) {
      await tx
        .update(paymentProofs)
        .set({
          midtransTransactionId: snapRes.token,
          transactionStatus: "pending",
          midtransResponse: { snap },
        })
        .where(eq(paymentProofs.id, existingProof.id));
    } else {
      await tx.insert(paymentProofs).values({
        orderId: order.id,
        midtransTransactionId: snapRes.token,
        transactionStatus: "pending",
        midtransResponse: { snap },
      });
    }

    return {
      orderId: order.id,
      snapToken: snapRes.token,
      redirectUrl: snapRes.redirect_url,
      expiresAt,
    };
  });
}

/** Shared gateway transition; callers must authenticate the payload first. */
async function applyGatewayStatus(orderId: string, payload: MidtransWebhookPayload) {
  return db.transaction(async (tx) => {
    const [order] = await tx.select().from(orders).where(eq(orders.id, orderId)).for("update").limit(1);
    if (!order) throw new AppError("Order not found", 404);
    if (payload.order_id !== `GGTIX-${order.id}` ||
        !Number.isFinite(Number(payload.gross_amount)) ||
        Number(payload.gross_amount) !== Math.round(Number(order.totalPrice)) ||
        (payload.currency && payload.currency !== "IDR")) {
      throw new AppError("Payment identity or amount does not match this order", 409);
    }
    const [proof] = await tx.select().from(paymentProofs).where(eq(paymentProofs.orderId, order.id)).limit(1);
    const settled = payload.transaction_status === "settlement" ||
      (payload.transaction_status === "capture" && payload.fraud_status === "accept");
    const failed = ["expire", "cancel", "deny"].includes(payload.transaction_status);
    let status = order.status;
    let requiresReview = settled && status === "rejected";

    // Expired orders have already released their reservation. Reacquire it under locks.
    if (settled && status === "expired") {
      const [category] = await tx.select().from(ticketCategories).where(eq(ticketCategories.id, order.categoryId)).for("update").limit(1);
      let voucherAvailable = true;
      if (order.voucherId) {
        const [voucher] = await tx.select().from(vouchers).where(eq(vouchers.id, order.voucherId)).for("update").limit(1);
        voucherAvailable = !!voucher && voucher.quotaRemaining > 0;
      }
      if (!category || category.quotaRemaining < order.quantity || !voucherAvailable) {
        requiresReview = true;
      } else {
        await tx.update(ticketCategories).set({ quotaRemaining: sql`${ticketCategories.quotaRemaining} - ${order.quantity}` }).where(eq(ticketCategories.id, order.categoryId));
        if (order.voucherId) {
          await tx.update(vouchers).set({ quotaRemaining: sql`${vouchers.quotaRemaining} - 1`, updatedAt: new Date() }).where(eq(vouchers.id, order.voucherId));
          await tx.update(voucherUsages).set({ status: "active" }).where(and(eq(voucherUsages.orderId, order.id), eq(voucherUsages.voucherId, order.voucherId)));
        }
      }
    }
    if (settled && !requiresReview && (status === "pending" || status === "expired")) {
      await tx.update(orders).set({ status: "verified", verifiedAt: new Date() }).where(eq(orders.id, order.id));
      status = "verified";
      const existing = await tx.select().from(tickets).where(eq(tickets.orderId, order.id));
      if (existing.length === 0) {
        await tx.insert(tickets).values(Array.from({ length: order.quantity }, () => ({ orderId: order.id, qrCodeValue: `tix_${crypto.randomUUID()}`, checkedIn: false })));
      }
    } else if (failed && status === "pending") {
      await tx.update(orders).set({ status: "expired" }).where(eq(orders.id, order.id));
      status = "expired";
      await tx.update(ticketCategories).set({ quotaRemaining: sql`${ticketCategories.quotaRemaining} + ${order.quantity}` }).where(eq(ticketCategories.id, order.categoryId));
      if (order.voucherId) {
        await tx.update(vouchers).set({ quotaRemaining: sql`${vouchers.quotaRemaining} + 1`, updatedAt: new Date() }).where(eq(vouchers.id, order.voucherId));
        await tx.update(voucherUsages).set({ status: "refunded" }).where(and(eq(voucherUsages.orderId, order.id), eq(voucherUsages.voucherId, order.voucherId)));
      }
    }
    // Older pending/expire notifications must not overwrite a settled payment's audit record.
    if (!(proof?.paidAt && !settled)) {
      const previous = (proof?.midtransResponse ?? {}) as Record<string, unknown>;
      const values = {
        midtransTransactionId: payload.transaction_id || proof?.midtransTransactionId,
        transactionStatus: payload.transaction_status,
        paymentType: payload.payment_type || proof?.paymentType,
        midtransResponse: { ...payload, snap: previous.snap, requiresReview },
        paidAt: settled ? proof?.paidAt ?? new Date() : proof?.paidAt,
      };
      if (proof) await tx.update(paymentProofs).set(values).where(eq(paymentProofs.id, proof.id));
      else await tx.insert(paymentProofs).values({ orderId: order.id, ...values });
    }
    return { orderId: order.id, status, paymentStatus: proof?.paidAt && !settled ? proof.transactionStatus : payload.transaction_status, requiresReview };
  });
}

export async function handleMidtransWebhook(payload: MidtransWebhookPayload) {
  if (!payload || ![payload.order_id, payload.status_code, payload.gross_amount, payload.signature_key].every(value => typeof value === 'string') ||
      !verifySignature(payload.order_id, payload.status_code, payload.gross_amount, payload.signature_key)) {
    throw new AppError("Invalid signature key", 403);
  }
  await applyGatewayStatus(extractOrderId(payload.order_id), payload);
  return { status: "ok" };
}

export async function getCustomerPayment(customerId: string, orderId: string) {
  const [order] = await db.select().from(orders).where(eq(orders.id, orderId)).limit(1);
  if (!order) throw new AppError("Order not found", 404);
  if (order.customerId !== customerId) throw new AppError("Forbidden: You do not own this order", 403);
  const [proof] = await db.select().from(paymentProofs).where(eq(paymentProofs.orderId, orderId)).limit(1);
  const metadata = (proof?.midtransResponse ?? {}) as { snap?: { token: string; redirectUrl: string; expiresAt: string }; requiresReview?: boolean };
  return {
    orderId, status: order.status, totalPrice: order.totalPrice, quantity: order.quantity,
    paymentStatus: proof?.transactionStatus ?? null,
    requiresReview: metadata.requiresReview ?? false,
    payment: order.status === 'pending' ? metadata.snap ?? null : null,
  };
}

export async function syncCustomerPayment(customerId: string, orderId: string) {
  const current = await getCustomerPayment(customerId, orderId);
  if (current.status === "verified") return current;
  if (!isMidtransConfigured()) return current;
  const payload = await getTransactionStatus(`GGTIX-${orderId}`);
  if (payload) await applyGatewayStatus(orderId, payload);
  return getCustomerPayment(customerId, orderId);
}

/** Never release a gateway reservation based only on the laptop's clock. */
export async function expireOverduePendingOrders(): Promise<{ expiredCount: number; orderIds: string[] }> {
  const settings = await getSystemSettings();
  const cutoff = new Date(Date.now() - settings.pendingOrderExpiryMinutes * 60000);
  const overdue = await db.select().from(orders).where(and(eq(orders.status, "pending"), lte(orders.createdAt, cutoff))).limit(100);
  const orderIds: string[] = [];
  for (const order of overdue) {
    try {
      if (isMidtransConfigured()) {
        const payload = await getTransactionStatus(`GGTIX-${order.id}`);
        if (payload) {
          const result = await applyGatewayStatus(order.id, payload);
          if (result.status === "expired") orderIds.push(order.id);
          continue;
        }
      }
      // No gateway charge exists. Wait for the original Snap deadline, if saved.
      const [proof] = await db.select().from(paymentProofs).where(eq(paymentProofs.orderId, order.id)).limit(1);
      const metadata = proof?.midtransResponse as { snap?: { expiresAt: string } } | null;
      if (metadata?.snap && Date.parse(metadata.snap.expiresAt) > Date.now()) continue;
      const result = await applyGatewayStatus(order.id, {
        order_id: `GGTIX-${order.id}`, gross_amount: String(Math.round(Number(order.totalPrice))),
        transaction_status: "expire", transaction_id: "", transaction_time: "", status_code: "", signature_key: "", payment_type: "",
      });
      if (result.status === 'expired') orderIds.push(order.id);
    } catch {
      // A timeout/auth/outage must not be mistaken for payment failure.
      console.warn(`[Payment sync] Deferred expiry for order ${order.id}; gateway status unavailable.`);
    }
  }
  return { expiredCount: orderIds.length, orderIds };
}
