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

export async function createCategory(eventId: string, data: CreateCategoryDTO) {
  // Validate event existence
  const event = await eventRepo.findEventById(eventId);
  if (!event) {
    throw new AppError("Event not found", 404);
  }

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

  const result = await categoryRepo.updateCategory(id, data);

  // Handle quota-below-sold error from the repository
  if (result && typeof result === "object" && "error" in result && result.error === "QUOTA_BELOW_SOLD") {
    throw new AppError(
      `Cannot reduce quota below already-sold count (${result.sold} sold)`,
      409,
      { quotaTotal: `At least ${result.sold} tickets have already been sold` }
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
    throw new AppError("Cannot delete category with existing orders", 409);
  }

  return await categoryRepo.deleteCategory(id);
}
