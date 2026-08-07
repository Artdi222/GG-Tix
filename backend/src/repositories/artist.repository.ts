import { eq, ilike, desc, count, and } from "drizzle-orm";
import { db } from "../db";
import { artists, events } from "../db/schema";

export interface ArtistQuery {
  search?: string;
  page?: number;
  limit?: number;
}

export async function findAllArtists(filters: ArtistQuery = {}) {
  const { search, page = 1, limit = 10 } = filters;
  const offset = (page - 1) * limit;

  const conditions = search && search.trim() !== "" ? [ilike(artists.name, `%${search.trim()}%`)] : [];
  const whereClause = conditions.length > 0 ? and(...conditions) : undefined;

  const items = await db
    .select()
    .from(artists)
    .where(whereClause)
    .orderBy(desc(artists.createdAt))
    .limit(limit)
    .offset(offset);

  const [{ total }] = await db
    .select({ total: count() })
    .from(artists)
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

export async function findArtistById(id: string) {
  const [artist] = await db
    .select()
    .from(artists)
    .where(eq(artists.id, id))
    .limit(1);
  return artist || null;
}

export async function createArtist(data: {
  name: string;
  bio?: string;
  photoUrl?: string;
}) {
  const [newArtist] = await db
    .insert(artists)
    .values({
      name: data.name.trim(),
      bio: data.bio ? data.bio.trim() : null,
      photoUrl: data.photoUrl ? data.photoUrl.trim() : null,
    })
    .returning();
  return newArtist;
}

export async function updateArtist(
  id: string,
  data: {
    name?: string;
    bio?: string;
    photoUrl?: string;
  }
) {
  const updateData: Record<string, any> = {};
  if (data.name !== undefined) updateData.name = data.name.trim();
  if (data.bio !== undefined) updateData.bio = data.bio ? data.bio.trim() : null;
  if (data.photoUrl !== undefined)
    updateData.photoUrl = data.photoUrl ? data.photoUrl.trim() : null;

  const [updatedArtist] = await db
    .update(artists)
    .set(updateData)
    .where(eq(artists.id, id))
    .returning();

  return updatedArtist;
}

export async function deleteArtist(id: string) {
  const [deletedArtist] = await db
    .delete(artists)
    .where(eq(artists.id, id))
    .returning();
  return deletedArtist;
}

export async function countEventsByArtistId(id: string) {
  const [result] = await db
    .select({ value: count() })
    .from(events)
    .where(eq(events.artistId, id));
  return Number(result?.value || 0);
}
