import * as eventRepository from "../repositories/event.repository";
import * as artistRepository from "../repositories/artist.repository";
import { AppError } from "../lib/errors";
import { deleteAssetsByUrl } from "../lib/storage";

export interface CreateEventParams {
  title: string;
  artistId: string;
  publisherName: string;
  venue: string;
  city: string;
  dateTime: string | Date;
  createdBy: string;
  status?: "open" | "closed";
  imageUrl?: string | null;
}

export interface UpdateEventParams {
  title?: string;
  artistId?: string;
  publisherName?: string;
  venue?: string;
  city?: string;
  dateTime?: string | Date;
  status?: "open" | "closed";
  imageUrl?: string | null;
}

export async function createEvent(params: CreateEventParams) {
  // Validate artist existence
  const artist = await artistRepository.findArtistById(params.artistId);
  if (!artist) {
    throw new AppError("Artist not found", 404);
  }

  const parsedDate = new Date(params.dateTime);
  if (isNaN(parsedDate.getTime())) {
    throw new AppError("Invalid event date/time format", 400);
  }

  return await eventRepository.createEvent({
    ...params,
    dateTime: parsedDate,
  });
}

export async function getEventById(id: string) {
  const event = await eventRepository.findEventById(id);
  if (!event) {
    throw new AppError("Event not found", 404);
  }
  return event;
}

export async function listEvents(filters: eventRepository.EventQueryFilters) {
  return await eventRepository.findEvents(filters);
}

export async function updateEvent(id: string, params: UpdateEventParams) {
  const existingEvent = await eventRepository.findEventById(id);
  if (!existingEvent) {
    throw new AppError("Event not found", 404);
  }

  if (params.artistId) {
    const artist = await artistRepository.findArtistById(params.artistId);
    if (!artist) {
      throw new AppError("Artist not found", 404);
    }
  }

  let parsedDate: Date | undefined;
  if (params.dateTime) {
    parsedDate = new Date(params.dateTime);
    if (isNaN(parsedDate.getTime())) {
      throw new AppError("Invalid event date/time format", 400);
    }
  }

  const updated = await eventRepository.updateEvent(id, {
    ...params,
    dateTime: parsedDate,
  });

  // UPL-09: gambar lama diganti → hapus aset B2 lama (best-effort)
  if (
    params.imageUrl !== undefined &&
    existingEvent.imageUrl &&
    params.imageUrl !== existingEvent.imageUrl
  ) {
    await deleteAssetsByUrl(existingEvent.imageUrl);
  }

  return updated;
}

export async function setEventStatus(id: string, status: "open" | "closed") {
  const existingEvent = await eventRepository.findEventById(id);
  if (!existingEvent) {
    throw new AppError("Event not found", 404);
  }

  return await eventRepository.updateEventStatus(id, status);
}

export async function deleteEvent(id: string) {
  const existingEvent = await eventRepository.findEventById(id);
  if (!existingEvent) {
    throw new AppError("Event not found", 404);
  }

  await eventRepository.deleteEvent(id);

  // UPL-09: hapus event → hapus banner B2 (best-effort)
  if (existingEvent.imageUrl) {
    await deleteAssetsByUrl(existingEvent.imageUrl);
  }
}
