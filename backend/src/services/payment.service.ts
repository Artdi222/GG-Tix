// src/services/payment.service.ts
// Midtrans Snap token generation, webhook processing & auto-expiry

import { eq, and, sql, lte } from "drizzle-orm";
import { db } from "../db";
import {
  orders,
  paymentProofs,
  ticketCategories,
  tickets,
} from "../db/schema";
import { AppError } from "../lib/errors";
import {
  createSnapTransaction,
  verifySignature,
  isMidtransConfigured,
  MidtransWebhookPayload,
  SnapTransactionParams,
} from "../lib/midtrans";
import * as orderRepo from "../repositories/order.repository";

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
export async function createSnapToken(customerId: string, orderId: string) {
  if (!isMidtransConfigured()) {
    throw new AppError("Payment gateway is not configured", 503);
  }

  const order = await orderRepo.findOrderById(orderId);
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

  const snapParams: SnapTransactionParams = {
    transaction_details: {
      order_id: `GGTIX-${order.id}`,
      gross_amount: Math.round(parseFloat(order.totalPrice)),
    },
    customer_details: {
      first_name: order.customer.name,
      email: order.customer.email,
    },
    item_details: [
      {
        id: order.categoryId,
        price: Math.round(parseFloat(order.category.price)),
        quantity: order.quantity,
        name: `${order.category.name} - ${order.event.title}`.slice(0, 50),
      },
    ],
    expiry: {
      unit: "minutes",
      duration: 30,
    },
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
  const expiresAt = new Date(Date.now() + 30 * 60 * 1000).toISOString();

  // Save/update initial payment proof record
  const existingProof = order.paymentProofs?.[0];
  if (existingProof) {
    await db
      .update(paymentProofs)
      .set({
        midtransTransactionId: snapRes.token,
        transactionStatus: "pending",
      })
      .where(eq(paymentProofs.id, existingProof.id));
  } else {
    await db.insert(paymentProofs).values({
      orderId: order.id,
      midtransTransactionId: snapRes.token,
      transactionStatus: "pending",
    });
  }

  return {
    orderId: order.id,
    snapToken: snapRes.token,
    redirectUrl: snapRes.redirect_url,
    expiresAt,
  };
}

/**
 * Handle incoming Midtrans Webhook Notification
 */
export async function handleMidtransWebhook(payload: MidtransWebhookPayload) {
  // 1. Verify signature
  const isValid = verifySignature(
    payload.order_id,
    payload.status_code,
    payload.gross_amount,
    payload.signature_key
  );

  if (!isValid) {
    throw new AppError("Invalid signature key", 403);
  }

  const orderId = extractOrderId(payload.order_id);

  return await db.transaction(async (tx) => {
    const [order] = await tx
      .select()
      .from(orders)
      .where(eq(orders.id, orderId))
      .for("update")
      .limit(1);

    if (!order) {
      return { status: "ORDER_NOT_FOUND" };
    }

    const txStatus = payload.transaction_status;
    const fraudStatus = payload.fraud_status;
    const isSettled =
      txStatus === "settlement" ||
      (txStatus === "capture" && fraudStatus === "accept");
    const isExpired = txStatus === "expire";
    const isCancelledOrDenied = txStatus === "cancel" || txStatus === "deny";

    // 2. Process status transition (idempotent)
    if (isSettled && order.status === "pending") {
      // Mark verified
      const paidDate = payload.transaction_time
        ? new Date(payload.transaction_time)
        : new Date();

      await tx
        .update(orders)
        .set({
          status: "verified",
          verifiedAt: paidDate,
        })
        .where(eq(orders.id, order.id));

      // Generate digital tickets (TIK-01 logic)
      const existingTickets = await tx
        .select()
        .from(tickets)
        .where(eq(tickets.orderId, order.id));

      if (existingTickets.length === 0) {
        const ticketValues = Array.from({ length: order.quantity }).map(() => ({
          orderId: order.id,
          qrCodeValue: `tix_${crypto.randomUUID()}`,
          checkedIn: false,
        }));
        await tx.insert(tickets).values(ticketValues);
      }
    } else if ((isExpired || isCancelledOrDenied) && order.status === "pending") {
      // Mark expired & refund category quota
      await tx
        .update(orders)
        .set({
          status: "expired",
        })
        .where(eq(orders.id, order.id));

      const [category] = await tx
        .select()
        .from(ticketCategories)
        .where(eq(ticketCategories.id, order.categoryId))
        .limit(1);

      if (category) {
        await tx
          .update(ticketCategories)
          .set({
            quotaRemaining: category.quotaRemaining + order.quantity,
          })
          .where(eq(ticketCategories.id, order.categoryId));
      }
    }

    // 3. Upsert payment_proofs record for audit trail
    const [existingProof] = await tx
      .select()
      .from(paymentProofs)
      .where(eq(paymentProofs.orderId, order.id))
      .limit(1);

    const paidAtValue = isSettled
      ? payload.transaction_time
        ? new Date(payload.transaction_time)
        : new Date()
      : null;

    if (existingProof) {
      await tx
        .update(paymentProofs)
        .set({
          midtransTransactionId:
            payload.transaction_id || existingProof.midtransTransactionId,
          paymentType: payload.payment_type || existingProof.paymentType,
          transactionStatus: payload.transaction_status,
          midtransResponse: payload,
          paidAt: paidAtValue || existingProof.paidAt,
        })
        .where(eq(paymentProofs.id, existingProof.id));
    } else {
      await tx.insert(paymentProofs).values({
        orderId: order.id,
        midtransTransactionId: payload.transaction_id,
        paymentType: payload.payment_type,
        transactionStatus: payload.transaction_status,
        midtransResponse: payload,
        paidAt: paidAtValue,
      });
    }

    return { status: "ok" };
  });
}

/**
 * Sweeper job to auto-expire pending orders older than 30 minutes
 */
export async function expireOverduePendingOrders(): Promise<{
  expiredCount: number;
  orderIds: string[];
}> {
  const cutoff = new Date(Date.now() - 30 * 60 * 1000);

  return await db.transaction(async (tx) => {
    const overdueOrders = await tx
      .select()
      .from(orders)
      .where(and(eq(orders.status, "pending"), lte(orders.createdAt, cutoff)))
      .for("update");

    if (overdueOrders.length === 0) {
      return { expiredCount: 0, orderIds: [] };
    }

    for (const order of overdueOrders) {
      // 1. Mark expired
      await tx
        .update(orders)
        .set({ status: "expired" })
        .where(eq(orders.id, order.id));

      // 2. Refund quota
      await tx
        .update(ticketCategories)
        .set({
          quotaRemaining: sql`${ticketCategories.quotaRemaining} + ${order.quantity}`,
        })
        .where(eq(ticketCategories.id, order.categoryId));

      // 3. Update payment proofs
      const [existingProof] = await tx
        .select()
        .from(paymentProofs)
        .where(eq(paymentProofs.orderId, order.id))
        .limit(1);

      if (existingProof) {
        await tx
          .update(paymentProofs)
          .set({ transactionStatus: "expire" })
          .where(eq(paymentProofs.id, existingProof.id));
      } else {
        await tx.insert(paymentProofs).values({
          orderId: order.id,
          transactionStatus: "expire",
        });
      }
    }

    const orderIds = overdueOrders.map((o) => o.id);
    return {
      expiredCount: orderIds.length,
      orderIds,
    };
  });
}
