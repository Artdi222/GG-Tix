import * as venueRepo from "../repositories/venue.repository";
import { AppError } from "../lib/errors";
import { deleteAssetsByUrl } from "../lib/storage";
import { db } from "../db";
import { events } from "../db/schema";
import { eq, count } from "drizzle-orm";

export interface CreateVenueDTO {
  name: string;
  address: string;
  city: string;
  imageUrl?: string | null;
  sortOrder?: number;
}

export interface UpdateVenueDTO {
  name?: string;
  address?: string;
  city?: string;
  imageUrl?: string | null;
  sortOrder?: number;
}

export async function getAllVenues(q?: string, page?: number, limit?: number) {
  return await venueRepo.findAllVenues({ q, page, limit });
}

export async function getVenueById(id: string) {
  const venue = await venueRepo.findVenueById(id);
  if (!venue) {
    throw new AppError("Venue not found", 404);
  }
  return venue;
}

export async function createVenue(data: CreateVenueDTO) {
  return await venueRepo.createVenue(data);
}

export async function updateVenue(id: string, data: UpdateVenueDTO) {
  const existing = await venueRepo.findVenueById(id);
  if (!existing) {
    throw new AppError("Venue not found", 404);
  }

  const updated = await venueRepo.updateVenue(id, data);

  // UPL-09: gambar lama diganti → hapus aset B2 lama (best-effort)
  if (
    data.imageUrl !== undefined &&
    existing.imageUrl &&
    data.imageUrl !== existing.imageUrl
  ) {
    await deleteAssetsByUrl(existing.imageUrl);
  }

  return updated;
}

export async function deleteVenue(id: string) {
  const existing = await venueRepo.findVenueById(id);
  if (!existing) {
    throw new AppError("Venue not found", 404);
  }

  // Check if any event is linked to this venue
  const [eventCount] = await db
    .select({ total: count() })
    .from(events)
    .where(eq(events.venueId, id));

  if (Number(eventCount?.total || 0) > 0) {
    throw new AppError(
      "Venue tidak dapat dihapus karena masih digunakan oleh event konser.",
      400
    );
  }

  const deleted = await venueRepo.deleteVenue(id);

  // UPL-09: hapus venue → hapus gambar B2 (best-effort)
  if (existing.imageUrl) {
    await deleteAssetsByUrl(existing.imageUrl);
  }

  return deleted;
}