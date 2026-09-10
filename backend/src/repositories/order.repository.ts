import { eq, and, desc, count, SQL, sql } from "drizzle-orm";
import { db } from "../db";
import { orders, ticketCategories, events, customers, tickets, vouchers, voucherUsages } from "../db/schema";

export interface CreateOrderInput {
  customerId: string;
  eventId: string;
  categoryId: string;
  quantity: number;
  voucherCode?: string;
}

export interface OrderQueryFilters {
  status?: "pending" | "verified" | "rejected" | "expired";
  eventId?: string;
  page?: number;
  limit?: number;
}

/**
 * Place an order inside a transaction:
 * 1. Verify event is open
 * 2. Verify category exists and belongs to event (SELECT FOR UPDATE)
 * 3. If voucherCode provided, verify & lock voucher (SELECT FOR UPDATE)
 * 4. Deduct ticket quota and voucher quota atomically
 * 5. Compute subtotal, discount, and net totalPrice server-side
 * 6. Insert order row and voucher_usages row
 */
export async function createOrder(data: CreateOrderInput) {
  return await db.transaction(async (tx) => {
    // 1. Check event status
    const [event] = await tx
      .select({ id: events.id, status: events.status })
      .from(events)
      .where(eq(events.id, data.eventId))
      .limit(1);

    if (!event) {
      return { error: "EVENT_NOT_FOUND" as const };
    }
    if (event.status === "closed") {
      return { error: "EVENT_CLOSED" as const };
    }

    // 2. Check category exists and belongs to this event (with row-level lock)
    const [category] = await tx
      .select()
      .from(ticketCategories)
      .where(
        and(
          eq(ticketCategories.id, data.categoryId),
          eq(ticketCategories.eventId, data.eventId)
        )
      )
      .for("update")
      .limit(1);

    if (!category) {
      return { error: "CATEGORY_NOT_FOUND" as const };
    }

    // 3. Check category quota
    if (category.quotaRemaining < data.quantity) {
      return {
        error: "INSUFFICIENT_QUOTA" as const,
        available: category.quotaRemaining,
      };
    }

    const subtotal = parseFloat(category.price) * data.quantity;
    let discount = 0;
    let lockedVoucher: typeof vouchers.$inferSelect | null = null;

    // 4. If voucher code provided, lock and validate voucher
    if (data.voucherCode && data.voucherCode.trim()) {
      const normalizedCode = data.voucherCode.trim().toUpperCase();
      const [v] = await tx
        .select()
        .from(vouchers)
        .where(eq(sql`UPPER(${vouchers.code})`, normalizedCode))
        .for("update")
        .limit(1);

      if (!v || !v.isActive) {
        return { error: "VOUCHER_NOT_FOUND" as const };
      }

      const now = new Date();
      if (v.startDate && now < new Date(v.startDate)) {
        return { error: "VOUCHER_NOT_STARTED" as const };
      }
      if (now > new Date(v.endDate)) {
        return { error: "VOUCHER_EXPIRED" as const };
      }
      if (v.quotaRemaining <= 0) {
        return { error: "VOUCHER_QUOTA_EXCEEDED" as const };
      }
      if (v.eventId && v.eventId !== data.eventId) {
        return { error: "VOUCHER_EVENT_MISMATCH" as const };
      }

      const minOrder = parseFloat(v.minOrderAmount || "0");
      if (subtotal < minOrder) {
        return { error: "VOUCHER_MIN_SPEND_NOT_MET" as const, minOrder: v.minOrderAmount };
      }

      // Check customer usage limit
      const [usageRes] = await tx
        .select({ count: count() })
        .from(voucherUsages)
        .where(
          and(
            eq(voucherUsages.customerId, data.customerId),
            eq(voucherUsages.voucherId, v.id),
            eq(voucherUsages.status, "active")
          )
        );

      if (Number(usageRes?.count || 0) >= v.maxUsagePerCustomer) {
        return { error: "VOUCHER_CUSTOMER_LIMIT_REACHED" as const };
      }

      // Calculate discount
      if (v.discountType === "fixed") {
        discount = Math.min(parseFloat(v.discountValue), subtotal);
      } else if (v.discountType === "percentage") {
        const raw = (subtotal * parseFloat(v.discountValue)) / 100;
        discount = v.maxDiscountAmount && parseFloat(v.maxDiscountAmount) > 0
          ? Math.min(raw, parseFloat(v.maxDiscountAmount))
          : raw;
      }
      discount = Math.round(discount * 100) / 100;
      lockedVoucher = v;

      // Deduct voucher quota
      await tx
        .update(vouchers)
        .set({
          quotaRemaining: sql`${vouchers.quotaRemaining} - 1`,
          updatedAt: new Date(),
        })
        .where(eq(vouchers.id, v.id));
    }

    // 5. Deduct ticket quota atomically
    await tx
      .update(ticketCategories)
      .set({
        quotaRemaining: sql`${ticketCategories.quotaRemaining} - ${data.quantity}`,
      })
      .where(eq(ticketCategories.id, data.categoryId));

    // 6. Compute final net total
    const totalPrice = Math.max(0, subtotal - discount).toFixed(2);

    const [newOrder] = await tx
      .insert(orders)
      .values({
        customerId: data.customerId,
        eventId: data.eventId,
        categoryId: data.categoryId,
        quantity: data.quantity,
        subtotalPrice: subtotal.toFixed(2),
        discountAmount: discount.toFixed(2),
        totalPrice,
        voucherId: lockedVoucher ? lockedVoucher.id : null,
        voucherCode: lockedVoucher ? lockedVoucher.code : null,
        status: "pending",
      })
      .returning();

    // 7. If voucher applied, record usage
    if (lockedVoucher) {
      await tx.insert(voucherUsages).values({
        voucherId: lockedVoucher.id,
        customerId: data.customerId,
        orderId: newOrder.id,
        discountApplied: discount.toFixed(2),
        status: "active",
      });
    }

    return newOrder;
  });
}

/** Find a single order by ID with its relations */
export async function findOrderById(id: string) {
  const order = await db.query.orders.findFirst({
    where: eq(orders.id, id),
    with: {
      event: { columns: { id: true, title: true, dateTime: true } },
      category: { columns: { id: true, name: true, price: true } },
      customer: { columns: { id: true, name: true, email: true } },
      paymentProofs: true,
    },
  });
  return order || null;
}

/** Customer's own order history (with pagination) */
export async function findOrdersByCustomerId(
  customerId: string,
  page: number = 1,
  limit: number = 10
) {
  const offset = (page - 1) * limit;

  const items = await db.query.orders.findMany({
    where: eq(orders.customerId, customerId),
    orderBy: [desc(orders.createdAt)],
    limit,
    offset,
    with: {
      event: { columns: { title: true, dateTime: true } },
      category: { columns: { name: true } },
      paymentProofs: true,
    },
  });

  const [{ total }] = await db
    .select({ total: count() })
    .from(orders)
    .where(eq(orders.customerId, customerId));

  return {
    items,
    pagination: {
      page,
      limit,
      totalCount: Number(total),
      totalPages: Math.ceil(Number(total) / limit),
    },
  };
}

/** Admin: list all orders with filters + pagination */
export async function findOrders(filters: OrderQueryFilters = {}) {
  const { status, eventId, page = 1, limit = 10 } = filters;
  const offset = (page - 1) * limit;

  const conditions: SQL[] = [];
  if (status) conditions.push(eq(orders.status, status));
  if (eventId) conditions.push(eq(orders.eventId, eventId));

  const whereClause = conditions.length > 0 ? and(...conditions) : undefined;

  const items = await db.query.orders.findMany({
    where: whereClause,
    orderBy: [desc(orders.createdAt)],
    limit,
    offset,
    with: {
      event: { columns: { title: true, dateTime: true } },
      category: { columns: { name: true } },
      customer: { columns: { id: true, name: true, email: true } },
      paymentProofs: true,
    },
  });

  const [{ total }] = await db
    .select({ total: count() })
    .from(orders)
    .where(whereClause);

  return {
    items,
    pagination: {
      page,
      limit,
      totalCount: Number(total),
      totalPages: Math.ceil(Number(total) / limit),
    },
  };
}

/**
 * Admin verifies or rejects an order.
 * On rejection, refund the quota back to the category.
 */
export async function verifyOrder(
  orderId: string,
  decision: "verified" | "rejected",
  adminId: string
) {
  return await db.transaction(async (tx) => {
    const [order] = await tx
      .select()
      .from(orders)
      .where(eq(orders.id, orderId))
      .limit(1);

    if (!order) return { error: "ORDER_NOT_FOUND" as const };

    if (order.status !== "pending") {
      return { error: "ORDER_ALREADY_PROCESSED" as const, currentStatus: order.status };
    }

    // If rejecting, refund ticket and voucher quota
    if (decision === "rejected") {
      const [category] = await tx
        .select()
        .from(ticketCategories)
        .where(eq(ticketCategories.id, order.categoryId))
        .limit(1);

      if (category) {
        await tx
          .update(ticketCategories)
          .set({ quotaRemaining: category.quotaRemaining + order.quantity })
          .where(eq(ticketCategories.id, order.categoryId));
      }

      if (order.voucherId) {
        await tx
          .update(vouchers)
          .set({
            quotaRemaining: sql`${vouchers.quotaRemaining} + 1`,
            updatedAt: new Date(),
          })
          .where(eq(vouchers.id, order.voucherId));

        await tx
          .update(voucherUsages)
          .set({ status: "refunded" })
          .where(
            and(
              eq(voucherUsages.orderId, order.id),
              eq(voucherUsages.voucherId, order.voucherId)
            )
          );
      }
    }

    const now = new Date();
    const [updated] = await tx
      .update(orders)
      .set({
        status: decision,
        verifiedBy: adminId,
        verifiedAt: now,
      })
      .where(eq(orders.id, orderId))
      .returning();

    // If verified, auto-generate tickets
    if (decision === "verified") {
      // Check if tickets already exist (idempotent)
      const existingTickets = await tx
        .select()
        .from(tickets)
        .where(eq(tickets.orderId, orderId));

      if (existingTickets.length === 0) {
        const ticketValues = Array.from({ length: updated.quantity }).map(() => ({
          orderId: updated.id,
          qrCodeValue: `tix_${crypto.randomUUID()}`,
          checkedIn: false,
        }));
        await tx.insert(tickets).values(ticketValues);
      }
    }

    return updated;
  });
}
