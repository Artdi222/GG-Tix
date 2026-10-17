import { eq, and, or, desc, count, ilike, SQL, sql, inArray } from "drizzle-orm";
import { db } from "../db";
import { AppError } from "../lib/errors";
import { orders, ticketCategories, events, customers, tickets, vouchers, voucherUsages, systemSettings } from "../db/schema";

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
  search?: string;
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
      .select({ id: events.id, status: events.status, maxTicketsPerOrder: events.maxTicketsPerOrder })
      .from(events)
      .where(eq(events.id, data.eventId))
      .limit(1);

    if (!event) {
      throw new AppError("Event not found", 404);
    }
    if (event.status === "closed") {
      throw new AppError("Ticket sales are closed for this event", 403);
    }

    const [settings] = await tx.select().from(systemSettings).where(eq(systemSettings.id, 'default')).limit(1);
    if (settings?.maintenanceMode) throw new AppError('Pemesanan sementara ditutup untuk pemeliharaan. Tiket yang sudah dibeli tetap dapat diakses.', 503);
    const maxTickets = event.maxTicketsPerOrder ?? settings?.defaultMaxTicketsPerOrder ?? 4;
    if (!Number.isInteger(data.quantity) || data.quantity < 1 || data.quantity > maxTickets) {
      throw new AppError(`Maksimal ${maxTickets} tiket per pesanan.`, 400);
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
      throw new AppError("Ticket category not found for this event", 404);
    }

    // 3. Check category quota
    if (category.quotaRemaining < data.quantity) {
      throw new AppError("Not enough tickets remaining", 409, {
        available: String(category.quotaRemaining),
      });
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
        .where(eq(vouchers.code, normalizedCode))
        .for("update")
        .limit(1);

      if (!v || !v.isActive) {
        throw new AppError("Kode promo tidak ditemukan atau sudah tidak aktif.", 404);
      }

      const now = new Date();
      if (v.startDate && now < new Date(v.startDate)) {
        throw new AppError("Masa berlaku kode promo ini belum dimulai.", 400);
      }
      if (now > new Date(v.endDate)) {
        throw new AppError("Masa berlaku kode promo ini telah berakhir.", 400);
      }
      if (v.quotaRemaining <= 0) {
        throw new AppError("Yah, kuota promo ini sudah habis terpakai.", 409);
      }
      if (v.eventId && v.eventId !== data.eventId) {
        throw new AppError("Kode promo ini tidak berlaku untuk konser yang dipilih.", 400);
      }

      const minOrder = parseFloat(v.minOrderAmount || "0");
      if (subtotal < minOrder) {
        throw new AppError("Total belanja belum mencapai batas minimum penggunaan promo.", 400);
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
        throw new AppError("Anda telah mencapai batas pemakaian untuk kode promo ini.", 400);
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
      discount = Math.min(subtotal, Math.round(discount * 100) / 100);
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
        status: Number(totalPrice) === 0 ? "verified" : "pending",
        verifiedAt: Number(totalPrice) === 0 ? new Date() : null,
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

    if (Number(totalPrice) === 0) {
      await tx.insert(tickets).values(Array.from({ length: data.quantity }, () => ({ orderId: newOrder.id, qrCodeValue: `tix_${crypto.randomUUID()}` })));
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
  limit: number = 10,
  status?: "pending" | "verified" | "failed" | "active"
) {
  const offset = (page - 1) * limit;
  const where = and(eq(orders.customerId, customerId), status === 'active'
    ? and(eq(orders.status, 'verified'), sql`exists (select 1 from tickets t join events e on e.id = ${orders.eventId} where t.order_id = ${orders.id} and not t.checked_in and e.date_time >= now())`) : status === 'failed'
    ? inArray(orders.status, ['rejected', 'expired']) : status ? eq(orders.status, status) : undefined);

  const items = await db.query.orders.findMany({
    where,
    orderBy: [desc(orders.createdAt), desc(orders.id)],
    limit,
    offset,
    with: {
      event: { columns: { id: true, title: true, dateTime: true, imageUrl: true }, with: { venue: { columns: { name: true, city: true } } } },
      category: { columns: { name: true } },
    },
  });

  const [{ total }] = await db
    .select({ total: count() })
    .from(orders)
    .where(where);

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
  const { status, eventId, search, page = 1, limit = 10 } = filters;
  const offset = (page - 1) * limit;

  const conditions: SQL[] = [];
  if (status) conditions.push(eq(orders.status, status));
  if (eventId) conditions.push(eq(orders.eventId, eventId));
  if (search?.trim()) {
    const term = `%${search.trim()}%`;
    conditions.push(or(
      sql`${orders.id}::text ilike ${term}`,
      inArray(orders.customerId, db.select({ id: customers.id }).from(customers).where(or(ilike(customers.name, term), ilike(customers.email, term)))),
      inArray(orders.eventId, db.select({ id: events.id }).from(events).where(ilike(events.title, term)))
    )!);
  }

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
      .for("update")
      .limit(1);

    if (!order) throw new AppError("Order not found", 404);

    if (order.status !== "pending") {
      throw new AppError(`Order has already been ${order.status}`, 409);
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
          .set({ quotaRemaining: sql`${ticketCategories.quotaRemaining} + ${order.quantity}` })
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

/** Admin KPIs across all orders (optionally one event), independent of table pagination. */
export async function orderStats(eventId?: string) {
  const rows = await db
    .select({
      status: orders.status,
      count: count(),
      revenue: sql<string>`coalesce(sum(${orders.totalPrice}), 0)`,
    })
    .from(orders)
    .where(eventId ? eq(orders.eventId, eventId) : undefined)
    .groupBy(orders.status);
  const counts = { pending: 0, verified: 0, rejected: 0, expired: 0 };
  let verifiedRevenue = 0;
  for (const row of rows) {
    counts[row.status] = Number(row.count);
    if (row.status === "verified") verifiedRevenue = Number(row.revenue);
  }
  return { ...counts, total: rows.reduce((sum, r) => sum + Number(r.count), 0), verifiedRevenue };
}

export async function customerOrderSummary(customerId: string) {
  const rows = await db.select({ status: orders.status, count: count() })
    .from(orders).where(eq(orders.customerId, customerId)).groupBy(orders.status);
  const counts = { pending: 0, verified: 0, rejected: 0, expired: 0 };
  for (const row of rows) counts[row.status] = Number(row.count);
  const [active] = await db.select({ count: count() }).from(tickets)
    .innerJoin(orders, eq(tickets.orderId, orders.id)).innerJoin(events, eq(orders.eventId, events.id))
    .where(and(eq(orders.customerId, customerId), eq(orders.status, 'verified'), eq(tickets.checkedIn, false), sql`${events.dateTime} >= now()`));
  return { ...counts, totalOrders: rows.reduce((sum, r) => sum + Number(r.count), 0), activeTickets: Number(active.count) };
}
