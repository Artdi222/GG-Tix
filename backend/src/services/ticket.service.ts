import { eq, sql } from "drizzle-orm";
import { db } from "../db";
import { tickets, orders, events, ticketCategories, customers } from "../db/schema";
import QRCode from "qrcode";

export async function findTicketsByOrderId(orderId: string) {
  const order = await db.query.orders.findFirst({
    where: eq(orders.id, orderId),
    with: {
      event: {
        columns: { id: true, title: true, dateTime: true },
        with: {
          venue: { columns: { name: true } },
        },
      },
      category: { columns: { id: true, name: true } },
      customer: { columns: { id: true, name: true, email: true } },
      tickets: true,
    },
  });

  if (!order || order.status !== "verified") return null;

  const ticketsWithQR = await Promise.all(
    order.tickets.map(async (t) => {
      const qrCodeDataUrl = await QRCode.toDataURL(t.qrCodeValue, {
        type: "image/png",
        width: 400,
        margin: 2,
        color: { dark: "#000000", light: "#FFFFFF" },
      });
      return {
        id: t.id,
        qrCodeValue: t.qrCodeValue,
        qrCodeDataUrl,
        checkedIn: t.checkedIn,
        checkedInAt: t.checkedInAt,
      };
    })
  );

  return {
    order: {
      id: order.id,
      customerId: order.customerId,
      eventTitle: order.event.title,
      eventDate: order.event.dateTime,
      venueName: order.event.venue?.name ?? "",
      categoryName: order.category.name,
      quantity: order.quantity,
      status: order.status,
    },
    tickets: ticketsWithQR,
  };
}

export async function checkInTicket(qrCodeValue: string, eventId: string) {
  return await db.transaction(async (tx) => {
    // 1. Find ticket
    const [ticket] = await tx
      .select()
      .from(tickets)
      .where(eq(tickets.qrCodeValue, qrCodeValue))
      .limit(1);

    if (!ticket) {
      return { error: "TICKET_NOT_FOUND" as const };
    }

    // 2. Join order & event to verify eventId
    const [order] = await tx
      .select({
        id: orders.id,
        eventId: orders.eventId,
        quantity: orders.quantity,
        customerName: customers.name,
        categoryName: ticketCategories.name,
        eventTitle: events.title,
      })
      .from(orders)
      .innerJoin(events, eq(orders.eventId, events.id))
      .innerJoin(customers, eq(orders.customerId, customers.id))
      .innerJoin(ticketCategories, eq(orders.categoryId, ticketCategories.id))
      .where(eq(orders.id, ticket.orderId))
      .limit(1);

    if (!order || order.eventId !== eventId) {
      return { error: "WRONG_EVENT" as const };
    }

    // 3. Check if already checked in
    if (ticket.checkedIn) {
      return {
        error: "ALREADY_CHECKED_IN" as const,
        checkedInAt: ticket.checkedInAt,
      };
    }

    // 4. Update ticket
    const now = new Date();
    const [updatedTicket] = await tx
      .update(tickets)
      .set({
        checkedIn: true,
        checkedInAt: now,
      })
      .where(eq(tickets.id, ticket.id))
      .returning();

    return {
      status: "SUCCESS" as const,
      ticket: {
        id: updatedTicket.id,
        qrCodeValue: updatedTicket.qrCodeValue,
        checkedIn: updatedTicket.checkedIn,
        checkedInAt: updatedTicket.checkedInAt,
      },
      order: {
        customerName: order.customerName,
        categoryName: order.categoryName,
        quantity: order.quantity,
      },
      event: {
        title: order.eventTitle,
      },
    };
  });
}

export async function getEventTicketStats(eventId: string) {
  const [event] = await db
    .select({ id: events.id, title: events.title })
    .from(events)
    .where(eq(events.id, eventId))
    .limit(1);

  if (!event) return null;

  // Single SQL aggregation query for all categories
  const categoryStats = await db.execute<{
    categoryId: string;
    categoryName: string;
    total: number;
    checkedIn: number;
  }>(sql`
    SELECT 
      tc.id AS "categoryId",
      tc.name AS "categoryName",
      COUNT(t.id)::int AS "total",
      COUNT(t.id) FILTER (WHERE t.checked_in = true)::int AS "checkedIn"
    FROM ${ticketCategories} tc
    LEFT JOIN ${orders} o ON o.category_id = tc.id AND o.status = 'verified'
    LEFT JOIN ${tickets} t ON t.order_id = o.id
    WHERE tc.event_id = ${eventId}
    GROUP BY tc.id, tc.name, tc.sort_order
    ORDER BY tc.sort_order ASC
  `);

  let totalTickets = 0;
  let totalCheckedIn = 0;

  const byCategory = (categoryStats as unknown as Array<{
    categoryId: string;
    categoryName: string;
    total: number;
    checkedIn: number;
  }>).map((cat) => {
    const total = Number(cat.total) || 0;
    const checkedIn = Number(cat.checkedIn) || 0;
    const remaining = total - checkedIn;
    const checkedInPct = total > 0 ? Number(((checkedIn / total) * 100).toFixed(1)) : 0;

    totalTickets += total;
    totalCheckedIn += checkedIn;

    return {
      categoryName: cat.categoryName,
      total,
      checkedIn,
      remaining,
      checkedInPct,
    };
  });

  const remaining = totalTickets - totalCheckedIn;
  const checkedInPct = totalTickets > 0 ? Number(((totalCheckedIn / totalTickets) * 100).toFixed(1)) : 0;

  return {
    eventId: event.id,
    eventTitle: event.title,
    totalTickets,
    checkedIn: totalCheckedIn,
    remaining,
    checkedInPct,
    byCategory,
  };
}

