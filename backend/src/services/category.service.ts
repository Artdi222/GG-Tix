import * as categoryRepo from "../repositories/category.repository";
import * as eventRepo from "../repositories/event.repository";
import { AppError } from "../lib/errors";

export interface CreateCategoryDTO {
  name: string;
  price: string;
  quotaTotal: number;
  benefits?: string[];
  sortOrder?: number;
}

export interface UpdateCategoryDTO {
  name?: string;
  price?: string;
  quotaTotal?: number;
  benefits?: string[];
  sortOrder?: number;
}

async function assertUniqueCategoryName(eventId: string, name: string, excludeId?: string) {
  const existing = await categoryRepo.findCategoriesByEventId(eventId);
  const target = name.trim().toLowerCase();
  if (existing.some((c) => c.id !== excludeId && c.name.trim().toLowerCase() === target)) {
    throw new AppError(`Kategori "${name.trim()}" sudah ada di event ini.`, 409);
  }
}

export async function createCategory(eventId: string, data: CreateCategoryDTO) {
  // Validate event existence
  const event = await eventRepo.findEventById(eventId);
  if (!event) {
    throw new AppError("Event not found", 404);
  }

  await assertUniqueCategoryName(eventId, data.name);

  return await categoryRepo.createCategory({
    eventId,
    ...data,
  });
}

export async function getCategoriesByEventId(eventId: string) {
  const event = await eventRepo.findEventById(eventId);
  if (!event) {
    throw new AppError("Event not found", 404);
  }
  return await categoryRepo.findCategoriesByEventId(eventId);
}

export async function updateCategory(id: string, data: UpdateCategoryDTO) {
  const existing = await categoryRepo.findCategoryById(id);
  if (!existing) {
    throw new AppError("Category not found", 404);
  }
  if (data.name !== undefined) await assertUniqueCategoryName(existing.eventId, data.name, id);

  const result = await categoryRepo.updateCategory(id, data);

  // Handle quota-below-sold error from the repository
  if (result && typeof result === "object" && "error" in result && result.error === "QUOTA_BELOW_SOLD") {
    throw new AppError(
      `Kuota tidak bisa di bawah jumlah tiket yang sudah terjual (${result.sold} tiket).`,
      409,
      { quotaTotal: `Minimal ${result.sold} tiket sudah terjual` }
    );
  }

  return result;
}

export async function deleteCategory(id: string) {
  const existing = await categoryRepo.findCategoryById(id);
  if (!existing) {
    throw new AppError("Category not found", 404);
  }

  const orderCount = await categoryRepo.countOrdersByCategoryId(id);
  if (orderCount > 0) {
    throw new AppError("Kategori tidak dapat dihapus karena sudah ada pesanan.", 409);
  }

  return await categoryRepo.deleteCategory(id);
}
