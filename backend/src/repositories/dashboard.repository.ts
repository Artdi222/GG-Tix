import { eq, and, sum, count, sql, SQL, desc, asc } from "drizzle-orm";
import { db } from "../db";
import { orders, events, ticketCategories, tickets } from "../db/schema";

export interface DashboardRange {
  days?: number;
  from?: string; // yyyy-mm-dd
  to?: string; // yyyy-mm-dd
}

function parseLocalDate(value?: string): Date | null {
  if (!value) return null;
  const parts = value.split("-");
  if (parts.length !== 3) return null;
  const y = parseInt(parts[0], 10);
  const m = parseInt(parts[1], 10) - 1;
  const d = parseInt(parts[2], 10);
  if (isNaN(y) || isNaN(m) || isNaN(d)) return null;
  return new Date(y, m, d, 0, 0, 0, 0);
}

function formatDateKey(d: Date): string {
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function buildRangeCondition(range?: DashboardRange): SQL | undefined {
  if (!range) return undefined;

  if (range.from && range.to) {
    const from = parseLocalDate(range.from);
    const to = parseLocalDate(range.to);
    if (from && to) {
      const nextDayAfterTo = new Date(to.getTime() + 86400000);
      return and(
        sql`${orders.createdAt} >= ${from.toISOString()}`,
        sql`${orders.createdAt} < ${nextDayAfterTo.toISOString()}`
      );
    }
  }

  const days = Math.min(Math.max(range.days ?? 7, 1), 90);
  const start = new Date();
  start.setHours(0, 0, 0, 0);
  start.setDate(start.getDate() - (days - 1));
  return sql`${orders.createdAt} >= ${start.toISOString()}`;
}

export async function getDashboardSummary(range: DashboardRange = {}) {
  const rangeCond = buildRangeCondition(range);

  const [
    statusStats,
    eventCounts,
    upcoming,
    recentClosed,
    byEventRows,
    byCategoryRows,
    totalVerified,
    pendingVerifications,
  ] = await Promise.all([
    db
      .select({
        status: orders.status,
        tickets: sum(orders.quantity),
        revenue: sum(orders.totalPrice),
      })
      .from(orders)
      .where(rangeCond)
      .groupBy(orders.status),
    db
      .select({
        status: events.status,
        total: count(),
      })
      .from(events)
      .groupBy(events.status),
    db
      .select({
        id: events.id,
        title: events.title,
        city: events.city,
        venue: events.venue,
        dateTime: events.dateTime,
      })
      .from(events)
      .where(eq(events.status, "open"))
      .orderBy(asc(events.dateTime))
      .limit(5),
    db
      .select({
        id: events.id,
        title: events.title,
        city: events.city,
        venue: events.venue,
        dateTime: events.dateTime,
      })
      .from(events)
      .where(eq(events.status, "closed"))
      .orderBy(desc(events.dateTime))
      .limit(5),
    db
      .select({
        eventId: orders.eventId,
        title: events.title,
        ticketsSold: sum(orders.quantity),
        revenue: sum(orders.totalPrice),
      })
      .from(orders)
      .innerJoin(events, eq(orders.eventId, events.id))
      .where(and(eq(orders.status, "verified"), rangeCond))
      .groupBy(orders.eventId, events.title),
    db
      .select({
        categoryId: orders.categoryId,
        name: ticketCategories.name,
        ticketsSold: sum(orders.quantity),
        revenue: sum(orders.totalPrice),
      })
      .from(orders)
      .innerJoin(ticketCategories, eq(orders.categoryId, ticketCategories.id))
      .where(and(eq(orders.status, "verified"), rangeCond))
      .groupBy(orders.categoryId, ticketCategories.name),
    db
      .select({
        ticketsSold: sum(orders.quantity),
        revenue: sum(orders.totalPrice),
      })
      .from(orders)
      .where(and(eq(orders.status, "verified"), rangeCond)),
    db
      .select({ total: count() })
      .from(orders)
      .where(eq(orders.status, "pending")),
  ]);

  const overallStats: Record<
    "verified" | "pending" | "rejected",
    { tickets: number; revenue: number }
  > = {
    verified: { tickets: 0, revenue: 0 },
    pending: { tickets: 0, revenue: 0 },
    rejected: { tickets: 0, revenue: 0 },
  };

  statusStats.forEach((row) => {
    if (row.status in overallStats) {
      const key = row.status as keyof typeof overallStats;
      overallStats[key] = {
        tickets: Number(row.tickets ?? 0),
        revenue: Number(row.revenue ?? 0),
      };
    }
  });

  let openCount = 0;
  let closedCount = 0;
  eventCounts.forEach((row) => {
    if (row.status === "open") openCount = Number(row.total);
    if (row.status === "closed") closedCount = Number(row.total);
  });

  const totalRevenue = Number(totalVerified?.[0]?.revenue ?? 0);
  const totalTicketsSold = Number(totalVerified?.[0]?.ticketsSold ?? 0);
  const totalEvents = openCount + closedCount;

  const capacityRows = await db
    .select({
      eventId: ticketCategories.eventId,
      capacity: sum(ticketCategories.quotaTotal),
      sold: sql<number>`coalesce(sum(${ticketCategories.quotaTotal} - ${ticketCategories.quotaRemaining}), 0)`,
    })
    .from(ticketCategories)
    .groupBy(ticketCategories.eventId);

  const capacityMap = new Map<string, { capacity: number; sold: number }>();
  capacityRows.forEach((r) => {
    capacityMap.set(r.eventId, {
      capacity: Number(r.capacity ?? 0),
      sold: Number(r.sold ?? 0),
    });
  });

  const byEvent = byEventRows.map((row) => {
    const cap = capacityMap.get(row.eventId) || { capacity: 0, sold: 0 };
    return {
      eventId: row.eventId,
      title: row.title,
      ticketsSold: Number(row.ticketsSold ?? 0),
      revenue: Number(row.revenue ?? 0),
      capacity: cap.capacity,
      occupancyPct: cap.capacity > 0 ? Math.round((cap.sold / cap.capacity) * 100) : 0,
    };
  });

  const byCategory = byCategoryRows
    .map((row) => ({
      categoryId: row.categoryId,
      name: row.name,
      ticketsSold: Number(row.ticketsSold ?? 0),
      revenue: Number(row.revenue ?? 0),
      revenueShare:
        totalRevenue > 0
          ? Number(((Number(row.revenue ?? 0) / totalRevenue) * 100).toFixed(1))
          : 0,
    }))
    .sort((a, b) => b.revenue - a.revenue);

  return {
    overview: {
      totalEvents,
      totalTicketsSold,
      totalRevenue,
      pendingVerifications: Number(pendingVerifications?.[0]?.total ?? 0),
      upcomingShows: openCount,
      openCount,
      closedCount,
    },
    overallStats,
    eventActivity: {
      openCount,
      closedCount,
      upcoming,
      recentClosed,
    },
    byEvent: byEvent.sort((a, b) => b.revenue - a.revenue),
    byCategory,
  };
}

/** Daily sales trend (verified orders only) within range. */
export async function getDashboardTrend(range: DashboardRange = {}) {
  const rangeCond = buildRangeCondition(range);

  let startDate: Date;
  let numDays: number;

  if (range.from && range.to) {
    const from = parseLocalDate(range.from);
    const to = parseLocalDate(range.to);
    if (from && to) {
      startDate = from;
      numDays = Math.min(
        Math.max(Math.round((to.getTime() - from.getTime()) / 86400000) + 1, 1),
        90
      );
    } else {
      const days = Math.min(Math.max(range.days ?? 7, 1), 90);
      startDate = new Date();
      startDate.setHours(0, 0, 0, 0);
      startDate.setDate(startDate.getDate() - (days - 1));
      numDays = days;
    }
  } else {
    const days = Math.min(Math.max(range.days ?? 7, 1), 90);
    startDate = new Date();
    startDate.setHours(0, 0, 0, 0);
    startDate.setDate(startDate.getDate() - (days - 1));
    numDays = days;
  }

  const rows = await db
    .select({
      date: sql<string>`to_char(${orders.createdAt}, 'YYYY-MM-DD')`,
      tickets: sum(orders.quantity),
      revenue: sum(orders.totalPrice),
    })
    .from(orders)
    .where(and(eq(orders.status, "verified"), rangeCond))
    .groupBy(sql`to_char(${orders.createdAt}, 'YYYY-MM-DD')`)
    .orderBy(asc(sql`to_char(${orders.createdAt}, 'YYYY-MM-DD')`));

  const byDate = new Map<string, { tickets: number; revenue: number }>();
  rows.forEach((r) => {
    byDate.set(r.date, {
      tickets: Number(r.tickets ?? 0),
      revenue: Number(r.revenue ?? 0),
    });
  });

  const result: { date: string; tickets: number; revenue: number }[] = [];
  const cursor = new Date(startDate.getTime());

  for (let i = 0; i < numDays; i++) {
    const key = formatDateKey(cursor);
    const val = byDate.get(key) || { tickets: 0, revenue: 0 };
    result.push({ date: key, tickets: val.tickets, revenue: val.revenue });
    cursor.setDate(cursor.getDate() + 1);
  }

  return result;
}

/** Per-event detail: capacity, sold, checked-in, occupancy + attendance % */
export async function getDashboardEvents(eventId?: string) {
  const eventWhere = eventId ? eq(events.id, eventId) : undefined;
  const categoryWhere = eventId ? eq(ticketCategories.eventId, eventId) : undefined;

  const [eventRows, capacityRows, checkedInRows] = await Promise.all([
    db
      .select({
        id: events.id,
        title: events.title,
        city: events.city,
        venue: events.venue,
        dateTime: events.dateTime,
        status: events.status,
      })
      .from(events)
      .where(eventWhere)
      .orderBy(desc(events.dateTime)),
    db
      .select({
        eventId: ticketCategories.eventId,
        capacity: sum(ticketCategories.quotaTotal),
        sold: sql<number>`coalesce(sum(${ticketCategories.quotaTotal} - ${ticketCategories.quotaRemaining}), 0)`,
      })
      .from(ticketCategories)
      .where(categoryWhere)
      .groupBy(ticketCategories.eventId),
    db
      .select({
        eventId: orders.eventId,
        checkedIn: count(tickets.id),
      })
      .from(tickets)
      .innerJoin(orders, eq(tickets.orderId, orders.id))
      .innerJoin(events, eq(orders.eventId, events.id))
      .where(
        eventId
          ? and(eq(tickets.checkedIn, true), eq(orders.eventId, eventId))
          : eq(tickets.checkedIn, true)
      )
      .groupBy(orders.eventId),
  ]);

  const capacityMap = new Map<string, { capacity: number; sold: number }>();
  capacityRows.forEach((r) => {
    capacityMap.set(r.eventId, {
      capacity: Number(r.capacity ?? 0),
      sold: Number(r.sold ?? 0),
    });
  });

  const checkedInMap = new Map<string, number>();
  checkedInRows.forEach((r) => {
    checkedInMap.set(r.eventId, Number(r.checkedIn ?? 0));
  });

  return eventRows.map((ev) => {
    const cap = capacityMap.get(ev.id) || { capacity: 0, sold: 0 };
    const checkedIn = checkedInMap.get(ev.id) ?? 0;
    return {
      id: ev.id,
      title: ev.title,
      city: ev.city,
      venue: ev.venue,
      dateTime: ev.dateTime,
      status: ev.status,
      capacity: cap.capacity,
      sold: cap.sold,
      occupancyPct: cap.capacity > 0 ? Math.round((cap.sold / cap.capacity) * 100) : 0,
      checkedIn,
      attendancePct: cap.sold > 0 ? Math.round((checkedIn / cap.sold) * 100) : 0,
    };
  });
}
