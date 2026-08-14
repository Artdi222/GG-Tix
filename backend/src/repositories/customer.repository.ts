import { eq, ilike, or, count, desc, and, SQL } from "drizzle-orm";
import { db } from "../db";
import { customers } from "../db/schema";

export async function findCustomerByEmail(email: string) {
  const [customer] = await db
    .select()
    .from(customers)
    .where(eq(customers.email, email.toLowerCase().trim()))
    .limit(1);
  return customer || null;
}

export async function findCustomerById(id: string) {
  const [customer] = await db
    .select()
    .from(customers)
    .where(eq(customers.id, id))
    .limit(1);
  return customer || null;
}

export async function createCustomer(data: {
  name: string;
  email: string;
  passwordHash: string;
}) {
  const [newCustomer] = await db
    .insert(customers)
    .values({
      name: data.name.trim(),
      email: data.email.toLowerCase().trim(),
      passwordHash: data.passwordHash,
    })
    .returning();
  return newCustomer;
}

export interface CustomerQueryFilters {
  search?: string;
  page?: number;
  limit?: number;
}

export async function findCustomers(filters: CustomerQueryFilters = {}) {
  const { search, page = 1, limit = 10 } = filters;
  const offset = (page - 1) * limit;

  const conditions: SQL[] = [];

  if (search && search.trim() !== "") {
    const term = `%${search.trim()}%`;
    conditions.push(
      or(
        ilike(customers.name, term),
        ilike(customers.email, term)
      )!
    );
  }

  const whereClause = conditions.length > 0 ? and(...conditions) : undefined;

  const items = await db
    .select({
      id: customers.id,
      name: customers.name,
      email: customers.email,
      createdAt: customers.createdAt,
    })
    .from(customers)
    .where(whereClause)
    .orderBy(desc(customers.createdAt))
    .limit(limit)
    .offset(offset);

  const [{ total }] = await db
    .select({ total: count() })
    .from(customers)
    .where(whereClause);

  return {
    items,
    pagination: {
      page,
      limit,
      totalCount: Number(total),
      totalPages: Math.ceil(Number(total) / limit),
    },
  };
}
