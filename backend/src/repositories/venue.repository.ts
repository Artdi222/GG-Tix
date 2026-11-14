import { likeContains } from "../lib/pagination";
import { eq, ilike, desc, count, and, or, ne, asc, sql, type SQL } from "drizzle-orm";
import { db } from "../db";
import { venues } from "../db/schema";

export interface VenueQuery {
  q?: string;
  active?: boolean;
  page?: number;
  limit?: number;
}

export async function findAllVenues(filters: VenueQuery = {}) {
  const { q, active, page = 1, limit = 10 } = filters;
  const offset = (page - 1) * limit;

  const conditions: SQL[] = [];
  if (q && q.trim() !== "") {
    const pattern = likeContains(q);
    conditions.push(
      or(ilike(venues.name, pattern), ilike(venues.address, pattern), ilike(venues.city, pattern))!
    );
  }
  if (active !== undefined) conditions.push(eq(venues.isActive, active));
  const whereClause = conditions.length > 0 ? and(...conditions) : undefined;

  const items = await db
    .select()
    .from(venues)
    .where(whereClause)
    .orderBy(desc(venues.isActive), venues.sortOrder, desc(venues.createdAt))
    .limit(limit)
    .offset(offset);

  const [{ total }] = await db
    .select({ total: count() })
    .from(venues)
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

export async function findVenueById(id: string) {
  const [venue] = await db
    .select()
    .from(venues)
    .where(eq(venues.id, id))
    .limit(1);
  return venue || null;
}

/** Distinct city names already in use, for the admin city autocomplete. */
export async function findDistinctCities() {
  const rows = await db
    .selectDistinct({ city: venues.city })
    .from(venues)
    .orderBy(asc(venues.city));
  return rows.map((r) => r.city);
}

/** Case-insensitive match on name + city, optionally excluding one venue (for edits). */
export async function findDuplicateVenue(name: string, city: string, excludeId?: string) {
  const conditions: SQL[] = [
    sql`lower(trim(${venues.name})) = lower(${name.trim()})`,
    sql`lower(trim(${venues.city})) = lower(${city.trim()})`,
  ];
  if (excludeId) conditions.push(ne(venues.id, excludeId));
  const [venue] = await db.select().from(venues).where(and(...conditions)).limit(1);
  return venue || null;
}

export async function createVenue(data: {
  name: string;
  address: string;
  city: string;
  timezone?: string;
  imageUrl?: string | null;
  sortOrder?: number;
}) {
  const [venue] = await db
    .insert(venues)
    .values({
      name: data.name.trim(),
      address: data.address.trim(),
      city: data.city.trim(),
      timezone: data.timezone ?? "Asia/Jakarta",
      imageUrl: data.imageUrl ? data.imageUrl.trim() : null,
      sortOrder: data.sortOrder ?? 0,
    })
    .returning();
  return venue;
}

export async function updateVenue(
  id: string,
  data: {
    name?: string;
    address?: string;
    city?: string;
    timezone?: string;
    imageUrl?: string | null;
    sortOrder?: number;
    isActive?: boolean;
  }
) {
  const updateData: Record<string, any> = { updatedAt: new Date() };
  if (data.name !== undefined) updateData.name = data.name.trim();
  if (data.address !== undefined) updateData.address = data.address.trim();
  if (data.city !== undefined) updateData.city = data.city.trim();
  if (data.timezone !== undefined) updateData.timezone = data.timezone;
  if (data.imageUrl !== undefined)
    updateData.imageUrl = data.imageUrl ? data.imageUrl.trim() : null;
  if (data.sortOrder !== undefined) updateData.sortOrder = data.sortOrder;
  if (data.isActive !== undefined) updateData.isActive = data.isActive;

  const [venue] = await db
    .update(venues)
    .set(updateData)
    .where(eq(venues.id, id))
    .returning();
  return venue;
}

export async function deleteVenue(id: string) {
  const [venue] = await db
    .delete(venues)
    .where(eq(venues.id, id))
    .returning();
  return venue || null;
}