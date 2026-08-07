import { eq, sum, count, desc, asc } from "drizzle-orm";
import { db } from "../db";
import { orders, events, ticketCategories } from "../db/schema";

export async function getDashboardSummary() {
  // Run all independent queries in parallel
  const [statusStats, eventCounts, upcoming, recentClosed, byEventRows, byCategoryRows] =
    await Promise.all([
      // Overall Ticket & Revenue Stats by Status
      db
        .select({
          status: orders.status,
          tickets: sum(orders.quantity),
          revenue: sum(orders.totalPrice),
        })
        .from(orders)
        .groupBy(orders.status),
      // Event Stats: Open vs Closed Counts
      db
        .select({
          status: events.status,
          total: count(),
        })
        .from(events)
        .groupBy(events.status),
      // Upcoming Open Events (next 5)
      db
        .select({
          id: events.id,
          title: events.title,
          dateTime: events.dateTime,
          city: events.city,
        })
        .from(events)
        .where(eq(events.status, "open"))
        .orderBy(asc(events.dateTime))
        .limit(5),
      // Recently Closed Events (last 5)
      db
        .select({
          id: events.id,
          title: events.title,
          dateTime: events.dateTime,
          city: events.city,
        })
        .from(events)
        .where(eq(events.status, "closed"))
        .orderBy(desc(events.dateTime))
        .limit(5),
      // Breakdown by Event (for verified orders)
      db
        .select({
          eventId: orders.eventId,
          title: events.title,
          ticketsSold: sum(orders.quantity),
          revenue: sum(orders.totalPrice),
        })
        .from(orders)
        .innerJoin(events, eq(orders.eventId, events.id))
        .where(eq(orders.status, "verified"))
        .groupBy(orders.eventId, events.title),
      // Breakdown by Category (for verified orders)
      db
        .select({
          categoryId: orders.categoryId,
          name: ticketCategories.name,
          ticketsSold: sum(orders.quantity),
          revenue: sum(orders.totalPrice),
        })
        .from(orders)
        .innerJoin(ticketCategories, eq(orders.categoryId, ticketCategories.id))
        .where(eq(orders.status, "verified"))
        .groupBy(orders.categoryId, ticketCategories.name),
    ]);

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

  const eventActivity = {
    openCount: 0,
    closedCount: 0,
    upcoming: upcoming as any[],
    recentClosed: recentClosed as any[],
  };

  eventCounts.forEach((row) => {
    if (row.status === "open") eventActivity.openCount = Number(row.total);
    if (row.status === "closed") eventActivity.closedCount = Number(row.total);
  });

  return {
    overallStats,
    eventActivity,
    byEvent: byEventRows.map((row) => ({
      eventId: row.eventId,
      title: row.title,
      ticketsSold: Number(row.ticketsSold ?? 0),
      revenue: Number(row.revenue ?? 0),
    })),
    byCategory: byCategoryRows.map((row) => ({
      categoryId: row.categoryId,
      name: row.name,
      ticketsSold: Number(row.ticketsSold ?? 0),
      revenue: Number(row.revenue ?? 0),
    })),
  };
}