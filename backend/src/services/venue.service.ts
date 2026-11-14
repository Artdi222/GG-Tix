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
  timezone?: string;
  imageUrl?: string | null;
  sortOrder?: number;
}

export interface UpdateVenueDTO {
  name?: string;
  address?: string;
  city?: string;
  timezone?: string;
  imageUrl?: string | null;
  sortOrder?: number;
  isActive?: boolean;
}

export async function getAllVenues(q?: string, page?: number, limit?: number, active?: boolean) {
  return await venueRepo.findAllVenues({ q, page, limit, active });
}

export async function getVenueCities() {
  return await venueRepo.findDistinctCities();
}

async function assertNotDuplicate(name: string, city: string, excludeId?: string) {
  const dup = await venueRepo.findDuplicateVenue(name, city, excludeId);
  if (dup) {
    throw new AppError(
      `Venue "${dup.name}" di ${dup.city} sudah terdaftar${dup.isActive ? "" : " (diarsipkan)"}.`,
      409
    );
  }
}

export async function getVenueById(id: string) {
  const venue = await venueRepo.findVenueById(id);
  if (!venue) {
    throw new AppError("Venue not found", 404);
  }
  return venue;
}

export async function createVenue(data: CreateVenueDTO) {
  await assertNotDuplicate(data.name, data.city);
  return await venueRepo.createVenue(data);
}

export async function updateVenue(id: string, data: UpdateVenueDTO) {
  const existing = await venueRepo.findVenueById(id);
  if (!existing) {
    throw new AppError("Venue not found", 404);
  }

  if (data.name !== undefined || data.city !== undefined) {
    await assertNotDuplicate(data.name ?? existing.name, data.city ?? existing.city, id);
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
      "Venue tidak dapat dihapus karena masih digunakan oleh event konser. Arsipkan saja agar tidak muncul di pilihan event baru.",
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