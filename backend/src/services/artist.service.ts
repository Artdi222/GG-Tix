import * as artistRepo from "../repositories/artist.repository";
import { AppError } from "../lib/errors";
import { deleteAssetsByUrl } from "../lib/storage";

export interface CreateArtistDTO {
  name: string;
  bio?: string;
  photoUrl?: string;
}

export interface UpdateArtistDTO {
  name?: string;
  bio?: string;
  photoUrl?: string;
}

export async function getAllArtists(search?: string, page?: number, limit?: number) {
  return await artistRepo.findAllArtists({ search, page: page ?? 1, limit: limit ?? 10 });
}

export async function getArtistById(id: string) {
  const artist = await artistRepo.findArtistById(id);
  if (!artist) {
    throw new AppError("Artist not found", 404);
  }
  return artist;
}

export async function createArtist(data: CreateArtistDTO) {
  return await artistRepo.createArtist(data);
}

export async function updateArtist(id: string, data: UpdateArtistDTO) {
  const existing = await artistRepo.findArtistById(id);
  if (!existing) {
    throw new AppError("Artist not found", 404);
  }

  const updated = await artistRepo.updateArtist(id, data);

  // UPL-09: foto lama diganti → hapus aset B2 lama (best-effort)
  if (data.photoUrl !== undefined && existing.photoUrl && data.photoUrl !== existing.photoUrl) {
    await deleteAssetsByUrl(existing.photoUrl);
  }

  return updated;
}

export async function deleteArtist(id: string) {
  const existing = await artistRepo.findArtistById(id);
  if (!existing) {
    throw new AppError("Artist not found", 404);
  }

  const linkedEventsCount = await artistRepo.countEventsByArtistId(id);
  if (linkedEventsCount > 0) {
    throw new AppError("Cannot delete artist with associated events", 400);
  }

  const deleted = await artistRepo.deleteArtist(id);

  // UPL-09: hapus artis → hapus foto B2 (best-effort)
  if (existing.photoUrl) {
    await deleteAssetsByUrl(existing.photoUrl);
  }

  return deleted;
}
