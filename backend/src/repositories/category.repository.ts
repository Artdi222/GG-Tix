import { eq, count } from "drizzle-orm";
import { db } from "../db";
import { ticketCategories, orders } from "../db/schema";

export interface CreateCategoryInput {
  eventId: string;
  name: string;
  price: string;
  quotaTotal: number;
}

export interface UpdateCategoryInput {
  name?: string;
  price?: string;
  quotaTotal?: number;
}

export async function findCategoriesByEventId(eventId: string) {
  return await db
    .select()
    .from(ticketCategories)
    .where(eq(ticketCategories.eventId, eventId));
}

export async function findCategoryById(id: string) {
  const [category] = await db
    .select()
    .from(ticketCategories)
    .where(eq(ticketCategories.id, id))
    .limit(1);
  return category || null;
}

export async function createCategory(data: CreateCategoryInput) {
  const [newCategory] = await db
    .insert(ticketCategories)
    .values({
      eventId: data.eventId,
      name: data.name.trim(),
      price: data.price,
      quotaTotal: data.quotaTotal,
      quotaRemaining: data.quotaTotal,
    })
    .returning();
  return newCategory;
}

export async function updateCategory(id: string, data: UpdateCategoryInput) {
  // Fetch current values to compute quota delta
  const current = await findCategoryById(id);
  if (!current) return null;

  const updateData: Record<string, any> = {};
  if (data.name !== undefined) updateData.name = data.name.trim();
  if (data.price !== undefined) updateData.price = data.price;

  // When quotaTotal changes, adjust quotaRemaining by the same delta
  // so already-sold tickets are preserved.
  if (data.quotaTotal !== undefined && data.quotaTotal !== current.quotaTotal) {
    const delta = data.quotaTotal - current.quotaTotal;
    const newRemaining = current.quotaRemaining + delta;

    if (newRemaining < 0) {
      // Can't reduce below already-sold count — caller should handle this
      return { error: "QUOTA_BELOW_SOLD" as const, sold: current.quotaTotal - current.quotaRemaining };
    }

    updateData.quotaTotal = data.quotaTotal;
    updateData.quotaRemaining = newRemaining;
  }

  if (Object.keys(updateData).length === 0) {
    return current;
  }

  const [updated] = await db
    .update(ticketCategories)
    .set(updateData)
    .where(eq(ticketCategories.id, id))
    .returning();

  return updated || null;
}

export async function deleteCategory(id: string) {
  const [deleted] = await db
    .delete(ticketCategories)
    .where(eq(ticketCategories.id, id))
    .returning();
  return deleted || null;
}

export async function countOrdersByCategoryId(categoryId: string) {
  const [result] = await db
    .select({ value: count() })
    .from(orders)
    .where(eq(orders.categoryId, categoryId));
  return Number(result?.value || 0);
}
