import * as eventRepository from "../repositories/event.repository";
import * as artistRepository from "../repositories/artist.repository";
import * as venueRepository from "../repositories/venue.repository";
import { db } from "../db";
import { orders } from "../db/schema";
import { eq, count } from "drizzle-orm";
import { AppError } from "../lib/errors";
import { deleteAssetsByUrl } from "../lib/storage";

/** Venue must exist; archived venues are only allowed when the event already uses them. */
async function assertUsableVenue(venueId: string, currentVenueId?: string | null) {
  const venue = await venueRepository.findVenueById(venueId);
  if (!venue) throw new AppError("Venue not found", 404);
  if (!venue.isActive && venueId !== currentVenueId) {
    throw new AppError(`Venue "${venue.name}" sudah diarsipkan dan tidak bisa dipakai untuk event baru.`, 400);
  }
}

export interface CreateEventParams {
  title: string;
  artistId: string;
  publisherName: string;
  venueId: string;
  dateTime: string | Date;
  endDateTime?: string | Date | null;
  description?: string | null;
  maxTicketsPerOrder?: number | null;
  tags?: string[];
  seatmapUrl?: string | null;
  sortOrder?: number;
  createdBy: string;
  status?: "open" | "closed";
  imageUrl?: string | null;
  posterUrl?: string | null;
}

export interface UpdateEventParams {
  title?: string;
  artistId?: string;
  publisherName?: string;
  venueId?: string;
  dateTime?: string | Date;
  endDateTime?: string | Date | null;
  description?: string | null;
  maxTicketsPerOrder?: number | null;
  tags?: string[];
  seatmapUrl?: string | null;
  sortOrder?: number;
  status?: "open" | "closed";
  imageUrl?: string | null;
  posterUrl?: string | null;
}

export async function createEvent(params: CreateEventParams) {
  const artist = await artistRepository.findArtistById(params.artistId);
  if (!artist) {
    throw new AppError("Artist not found", 404);
  }
  await assertUsableVenue(params.venueId);

  const parsedDate = new Date(params.dateTime);
  if (isNaN(parsedDate.getTime())) {
    throw new AppError("Invalid event date/time format", 400);
  }

  let parsedEndDate: Date | undefined;
  if (params.endDateTime) {
    parsedEndDate = new Date(params.endDateTime);
    if (isNaN(parsedEndDate.getTime())) {
      throw new AppError("Invalid event end date/time format", 400);
    }
  }

  return await eventRepository.createEvent({
    ...params,
    dateTime: parsedDate,
    endDateTime: parsedEndDate || null,
  });
}

export async function getEventById(id: string) {
  const event = await eventRepository.findEventById(id);
  if (!event) {
    throw new AppError("Event not found", 404);
  }
  const { getSystemSettings } = await import('./settings.service');
  const settings = await getSystemSettings();
  return { ...event, maxTicketsPerOrder: event.maxTicketsPerOrder ?? settings.defaultMaxTicketsPerOrder, maintenanceMode: settings.maintenanceMode };
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
  if (params.venueId) await assertUsableVenue(params.venueId, existingEvent.venueId);

  let parsedDate: Date | undefined;
  if (params.dateTime) {
    parsedDate = new Date(params.dateTime);
    if (isNaN(parsedDate.getTime())) {
      throw new AppError("Invalid event date/time format", 400);
    }
  }

  let parsedEndDate: Date | null | undefined;
  if (params.endDateTime !== undefined) {
    if (params.endDateTime === null) {
      parsedEndDate = null;
    } else {
      parsedEndDate = new Date(params.endDateTime);
      if (isNaN(parsedEndDate.getTime())) {
        throw new AppError("Invalid event end date/time format", 400);
      }
    }
  }

  const updated = await eventRepository.updateEvent(id, {
    ...params,
    dateTime: parsedDate,
    endDateTime: parsedEndDate,
  });

  // UPL-09: gambar lama diganti → hapus aset B2 lama (best-effort)
  if (
    params.imageUrl !== undefined &&
    existingEvent.imageUrl &&
    params.imageUrl !== existingEvent.imageUrl
  ) {
    await deleteAssetsByUrl(existingEvent.imageUrl);
  }
  if (params.posterUrl !== undefined && existingEvent.posterUrl && params.posterUrl !== existingEvent.posterUrl) {
    await deleteAssetsByUrl(existingEvent.posterUrl);
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

  // Orders reference the event (no cascade): deleting would fail at the DB and lose sales history.
  const [{ total }] = await db.select({ total: count() }).from(orders).where(eq(orders.eventId, id));
  if (Number(total) > 0) {
    throw new AppError(
      `Event tidak dapat dihapus karena sudah punya ${Number(total)} pesanan. Tutup penjualan saja agar riwayat transaksi tetap ada.`,
      409
    );
  }

  await eventRepository.deleteEvent(id);

  // UPL-09: hapus event → hapus banner B2 (best-effort)
  if (existingEvent.imageUrl) {
    await deleteAssetsByUrl(existingEvent.imageUrl);
  }
  if (existingEvent.posterUrl) {
    await deleteAssetsByUrl(existingEvent.posterUrl);
  }
}
