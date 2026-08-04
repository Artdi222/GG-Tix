import { eq, sum, count, desc, asc, and, gte, lt } from "drizzle-orm";
import { db } from "../db";
import { orders, events, ticketCategories } from "../db/schema";

export async function getDashboardSummary() {
  // Overall Ticket & Revenue Stats by Status
  const statusStats = await db
    .select({
      status: orders.status,
      tickets: sum(orders.quantity),
      revenue: sum(orders.totalPrice),
    })
    .from(orders)
    .groupBy(orders.status);

  const overallStats = {
    verified: { tickets: 0, revenue: 0 },
    pending: { tickets: 0, revenue: 0 },
    rejected: { tickets: 0, revenue: 0 },
  };

  statusStats.forEach((row) => {
    if (row.status in overallStats) {
      overallStats[row.status as keyof typeof overallStats] = {
        tickets: Number(row.tickets ?? 0),
        revenue: Number(row.revenue ?? 0),
      };
    }
  });

  // Event Stats: Open vs Closed Counts
  const eventCounts = await db
    .select({
      status: events.status,
      total: count(),
    })
    .from(events)
    .groupBy(events.status);

  const eventActivity = {
    openCount: 0,
    closedCount: 0,
    upcoming: [] as any[],
    recentClosed: [] as any[],
  };

  eventCounts.forEach((row) => {
    if (row.status === "open") eventActivity.openCount = Number(row.total);
    if (row.status === "closed") eventActivity.closedCount = Number(row.total);
  });

  // Upcoming Open Events (next 5)
  eventActivity.upcoming = await db
    .select({
      id: events.id,
      title: events.title,
      dateTime: events.dateTime,
      city: events.city,
    })
    .from(events)
    .where(eq(events.status, "open"))
    .orderBy(asc(events.dateTime))
    .limit(5);

  // Recently Closed Events (last 5)
  eventActivity.recentClosed = await db
    .select({
      id: events.id,
      title: events.title,
      dateTime: events.dateTime,
      city: events.city,
    })
    .from(events)
    .where(eq(events.status, "closed"))
    .orderBy(desc(events.dateTime))
    .limit(5);

  // Breakdowns by Event (for verified orders)
  const byEvent = await db
    .select({
      eventId: orders.eventId,
      title: events.title,
      ticketsSold: sum(orders.quantity),
      revenue: sum(orders.totalPrice),
    })
    .from(orders)
    .innerJoin(events, eq(orders.eventId, events.id))
    .where(eq(orders.status, "verified"))
    .groupBy(orders.eventId, events.title);

  // Breakdowns by Category (for verified orders)
  const byCategory = await db
    .select({
      categoryId: orders.categoryId,
      name: ticketCategories.name,
      ticketsSold: sum(orders.quantity),
      revenue: sum(orders.totalPrice),
    })
    .from(orders)
    .innerJoin(ticketCategories, eq(orders.categoryId, ticketCategories.id))
    .where(eq(orders.status, "verified"))
    .groupBy(orders.categoryId, ticketCategories.name);

  return {
    overallStats,
    eventActivity,
    byEvent: byEvent.map((row) => ({
      eventId: row.eventId,
      title: row.title,
      ticketsSold: Number(row.ticketsSold ?? 0),
      revenue: Number(row.revenue ?? 0),
    })),
    byCategory: byCategory.map((row) => ({
      categoryId: row.categoryId,
      name: row.name,
      ticketsSold: Number(row.ticketsSold ?? 0),
      revenue: Number(row.revenue ?? 0),
    })),
  };
}
