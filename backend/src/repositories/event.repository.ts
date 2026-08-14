import { eq, and, ilike, or, count, desc, SQL } from "drizzle-orm";
import { db } from "../db";
import { events } from "../db/schema";

export interface CreateEventInput {
  title: string;
  artistId: string;
  publisherName: string;
  venueId: string;
  dateTime: Date;
  endDateTime?: Date | null;
  description?: string | null;
  maxTicketsPerOrder?: number;
  tags?: string[];
  seatmapUrl?: string | null;
  sortOrder?: number;
  createdBy: string;
  status?: "open" | "closed";
  imageUrl?: string | null;
}

export interface UpdateEventInput {
  title?: string;
  artistId?: string;
  publisherName?: string;
  venueId?: string;
  dateTime?: Date;
  endDateTime?: Date | null;
  description?: string | null;
  maxTicketsPerOrder?: number;
  tags?: string[];
  seatmapUrl?: string | null;
  sortOrder?: number;
  status?: "open" | "closed";
  imageUrl?: string | null;
}

export interface EventQueryFilters {
  search?: string;
  artistId?: string;
  venueId?: string;
  status?: "open" | "closed";
  page?: number;
  limit?: number;
}

export async function createEvent(data: CreateEventInput) {
  const [newEvent] = await db
    .insert(events)
    .values({
      title: data.title.trim(),
      artistId: data.artistId,
      publisherName: data.publisherName.trim(),
      venueId: data.venueId,
      dateTime: data.dateTime,
      endDateTime: data.endDateTime || null,
      description: data.description ? data.description.trim() : null,
      maxTicketsPerOrder: data.maxTicketsPerOrder ?? 4,
      tags: data.tags || [],
      seatmapUrl: data.seatmapUrl ? data.seatmapUrl.trim() : null,
      sortOrder: data.sortOrder ?? 0,
      createdBy: data.createdBy,
      status: data.status || "open",
      imageUrl: data.imageUrl ? data.imageUrl.trim() : null,
    })
    .returning();
  return newEvent;
}

export async function findEventById(id: string) {
  const event = await db.query.events.findFirst({
    where: eq(events.id, id),
    with: {
      artist: true,
      venue: true,
      ticketCategories: true,
    },
  });
  return event || null;
}

export async function findEvents(filters: EventQueryFilters = {}) {
  const { search, artistId, venueId, status, page = 1, limit = 10 } = filters;
  const offset = (page - 1) * limit;

  const conditions: SQL[] = [];

  if (search && search.trim() !== "") {
    const term = `%${search.trim()}%`;
    conditions.push(
      or(
        ilike(events.title, term),
        ilike(events.publisherName, term)
      )!
    );
  }

  if (artistId) {
    conditions.push(eq(events.artistId, artistId));
  }

  if (venueId) {
    conditions.push(eq(events.venueId, venueId));
  }

  if (status) {
    conditions.push(eq(events.status, status));
  }

  const whereClause = conditions.length > 0 ? and(...conditions) : undefined;

  const items = await db.query.events.findMany({
    where: whereClause,
    orderBy: [events.sortOrder, desc(events.createdAt)],
    limit,
    offset,
    with: {
      artist: true,
      venue: true,
    },
  });

  const [{ total }] = await db
    .select({ total: count() })
    .from(events)
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

export async function updateEvent(id: string, data: UpdateEventInput) {
  const updateData: Record<string, any> = {};
  if (data.title !== undefined) updateData.title = data.title.trim();
  if (data.artistId !== undefined) updateData.artistId = data.artistId;
  if (data.publisherName !== undefined) updateData.publisherName = data.publisherName.trim();
  if (data.venueId !== undefined) updateData.venueId = data.venueId;
  if (data.dateTime !== undefined) updateData.dateTime = data.dateTime;
  if (data.endDateTime !== undefined) updateData.endDateTime = data.endDateTime;
  if (data.description !== undefined) updateData.description = data.description ? data.description.trim() : null;
  if (data.maxTicketsPerOrder !== undefined) updateData.maxTicketsPerOrder = data.maxTicketsPerOrder;
  if (data.tags !== undefined) updateData.tags = data.tags;
  if (data.seatmapUrl !== undefined) updateData.seatmapUrl = data.seatmapUrl ? data.seatmapUrl.trim() : null;
  if (data.sortOrder !== undefined) updateData.sortOrder = data.sortOrder;
  if (data.status !== undefined) updateData.status = data.status;
  if (data.imageUrl !== undefined)
    updateData.imageUrl = data.imageUrl ? data.imageUrl.trim() : null;

  if (Object.keys(updateData).length === 0) {
    return await findEventById(id);
  }

  const [updated] = await db
    .update(events)
    .set(updateData)
    .where(eq(events.id, id))
    .returning();

  return updated ?? null;
}

export async function updateEventStatus(id: string, status: "open" | "closed") {
  const [updated] = await db
    .update(events)
    .set({ status })
    .where(eq(events.id, id))
    .returning();
  return updated ?? null;
}

export async function deleteEvent(id: string) {
  const [deleted] = await db
    .delete(events)
    .where(eq(events.id, id))
    .returning();
  return deleted || null;
}
