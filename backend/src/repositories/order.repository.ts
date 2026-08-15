import { eq, and, desc, count, SQL, sql } from "drizzle-orm";
import { db } from "../db";
import { orders, ticketCategories, events, customers, tickets } from "../db/schema";

export interface CreateOrderInput {
  customerId: string;
  eventId: string;
  categoryId: string;
  quantity: number;
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
 * 2. Verify category exists and belongs to event
 * 3. Check + deduct quotaRemaining atomically
 * 4. Compute totalPrice server-side
 * 5. Insert order row
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

    // 3. Check quota
    if (category.quotaRemaining < data.quantity) {
      return {
        error: "INSUFFICIENT_QUOTA" as const,
        available: category.quotaRemaining,
      };
    }

    // 4. Deduct quota atomically (decrement in single SQL statement)
    await tx
      .update(ticketCategories)
      .set({
        quotaRemaining: sql`${ticketCategories.quotaRemaining} - ${data.quantity}`,
      })
      .where(eq(ticketCategories.id, data.categoryId));

    // 5. Compute total price and insert order
    const totalPrice = (
      parseFloat(category.price) * data.quantity
    ).toFixed(2);

    const [newOrder] = await tx
      .insert(orders)
      .values({
        customerId: data.customerId,
        eventId: data.eventId,
        categoryId: data.categoryId,
        quantity: data.quantity,
        totalPrice,
        status: "pending",
      })
      .returning();

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

    // If rejecting, refund quota
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
