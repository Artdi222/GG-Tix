import * as artistRepo from "../repositories/artist.repository";
import { AppError } from "../lib/errors";

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

export async function getAllArtists(search?: string) {
  return await artistRepo.findAllArtists(search);
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
  return await artistRepo.updateArtist(id, data);
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

  return await artistRepo.deleteArtist(id);
}
