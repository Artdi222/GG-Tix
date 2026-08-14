import { eq, ilike, desc, count, and } from "drizzle-orm";
import { db } from "../db";
import { venues } from "../db/schema";

export interface VenueQuery {
  q?: string;
  page?: number;
  limit?: number;
}

export async function findAllVenues(filters: VenueQuery = {}) {
  const { q, page = 1, limit = 10 } = filters;
  const offset = (page - 1) * limit;

  const conditions = q && q.trim() !== "" ? [ilike(venues.name, `%${q.trim()}%`)] : [];
  const whereClause = conditions.length > 0 ? and(...conditions) : undefined;

  const items = await db
    .select()
    .from(venues)
    .where(whereClause)
    .orderBy(venues.sortOrder, desc(venues.createdAt))
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

export async function createVenue(data: {
  name: string;
  address: string;
  city: string;
  imageUrl?: string | null;
  sortOrder?: number;
}) {
  const [venue] = await db
    .insert(venues)
    .values({
      name: data.name.trim(),
      address: data.address.trim(),
      city: data.city.trim(),
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
    imageUrl?: string | null;
    sortOrder?: number;
  }
) {
  const updateData: Record<string, any> = {};
  if (data.name !== undefined) updateData.name = data.name.trim();
  if (data.address !== undefined) updateData.address = data.address.trim();
  if (data.city !== undefined) updateData.city = data.city.trim();
  if (data.imageUrl !== undefined)
    updateData.imageUrl = data.imageUrl ? data.imageUrl.trim() : null;
  if (data.sortOrder !== undefined) updateData.sortOrder = data.sortOrder;

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