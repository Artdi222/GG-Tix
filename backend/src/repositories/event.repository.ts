import { eq, and, ilike, or, count, desc, SQL } from "drizzle-orm";
import { db } from "../db";
import { events } from "../db/schema";

export interface CreateEventInput {
  title: string;
  artistId: string;
  publisherName: string;
  venue: string;
  city: string;
  dateTime: Date;
  createdBy: string;
  status?: "open" | "closed";
}

export interface UpdateEventInput {
  title?: string;
  artistId?: string;
  publisherName?: string;
  venue?: string;
  city?: string;
  dateTime?: Date;
  status?: "open" | "closed";
}

export interface EventQueryFilters {
  search?: string;
  artistId?: string;
  city?: string;
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
      venue: data.venue.trim(),
      city: data.city.trim(),
      dateTime: data.dateTime,
      createdBy: data.createdBy,
      status: data.status || "open",
    })
    .returning();
  return newEvent;
}

export async function findEventById(id: string) {
  const event = await db.query.events.findFirst({
    where: eq(events.id, id),
    with: {
      artist: true,
      ticketCategories: true,
    },
  });
  return event || null;
}

export async function findEvents(filters: EventQueryFilters = {}) {
  const { search, artistId, city, status, page = 1, limit = 10 } = filters;
  const offset = (page - 1) * limit;

  const conditions: SQL[] = [];

  if (search && search.trim() !== "") {
    const term = `%${search.trim()}%`;
    conditions.push(
      or(
        ilike(events.title, term),
        ilike(events.venue, term),
        ilike(events.publisherName, term)
      )!
    );
  }

  if (artistId) {
    conditions.push(eq(events.artistId, artistId));
  }

  if (city) {
    conditions.push(ilike(events.city, city.trim()));
  }

  if (status) {
    conditions.push(eq(events.status, status));
  }

  const whereClause = conditions.length > 0 ? and(...conditions) : undefined;

  const items = await db.query.events.findMany({
    where: whereClause,
    orderBy: [desc(events.createdAt)],
    limit,
    offset,
    with: {
      artist: true,
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
  if (data.venue !== undefined) updateData.venue = data.venue.trim();
  if (data.city !== undefined) updateData.city = data.city.trim();
  if (data.dateTime !== undefined) updateData.dateTime = data.dateTime;
  if (data.status !== undefined) updateData.status = data.status;

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
