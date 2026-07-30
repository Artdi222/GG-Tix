import { eq } from "drizzle-orm";
import { db } from "../db";
import { artists } from "../db/schema";

export async function findArtistById(id: string) {
  const [artist] = await db
    .select()
    .from(artists)
    .where(eq(artists.id, id))
    .limit(1);
  return artist || null;
}
