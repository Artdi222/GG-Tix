import { eq, ilike, or, count, desc, and, SQL } from "drizzle-orm";
import { db } from "../db";
import { admins } from "../db/schema";

export interface AdminQueryFilters {
  search?: string;
  role?: "super_admin" | "admin" | "gate_staff";
  page?: number;
  limit?: number;
}

export async function findAdmins(filters: AdminQueryFilters = {}) {
  const { search, role, page = 1, limit = 10 } = filters;
  const offset = (page - 1) * limit;

  const conditions: SQL[] = [];

  if (search?.trim()) {
    const term = `%${search.trim()}%`;
    conditions.push(or(ilike(admins.name, term), ilike(admins.email, term)) as SQL);
  }

  if (role) {
    conditions.push(eq(admins.role, role));
  }

  const whereClause = conditions.length > 0 ? and(...conditions) : undefined;

  const items = await db
    .select({
      id: admins.id,
      name: admins.name,
      email: admins.email,
      role: admins.role,
      createdAt: admins.createdAt,
    })
    .from(admins)
    .where(whereClause)
    .orderBy(desc(admins.createdAt))
    .limit(limit)
    .offset(offset);

  const [{ total }] = await db
    .select({ total: count() })
    .from(admins)
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

export async function findAdminByEmail(email: string) {
  const [admin] = await db
    .select()
    .from(admins)
    .where(eq(admins.email, email.toLowerCase().trim()))
    .limit(1);
  return admin || null;
}

export async function findAdminById(id: string) {
  const [admin] = await db
    .select()
    .from(admins)
    .where(eq(admins.id, id))
    .limit(1);
  return admin || null;
}

export async function createAdmin(data: {
  name: string;
  email: string;
  passwordHash: string;
  role?: "super_admin" | "admin" | "gate_staff";
}) {
  const [newAdmin] = await db
    .insert(admins)
    .values({
      name: data.name.trim(),
      email: data.email.toLowerCase().trim(),
      passwordHash: data.passwordHash,
      role: data.role || "gate_staff",
    })
    .returning({
      id: admins.id,
      name: admins.name,
      email: admins.email,
      role: admins.role,
      createdAt: admins.createdAt,
    });
  return newAdmin;
}

export async function updateAdmin(
  id: string,
  data: {
    name?: string;
    email?: string;
    passwordHash?: string;
    role?: "super_admin" | "admin" | "gate_staff";
  }
) {
  const updateData: Record<string, any> = {};
  if (data.name !== undefined) updateData.name = data.name.trim();
  if (data.email !== undefined) updateData.email = data.email.toLowerCase().trim();
  if (data.passwordHash !== undefined) updateData.passwordHash = data.passwordHash;
  if (data.role !== undefined) updateData.role = data.role;

  const [updated] = await db
    .update(admins)
    .set(updateData)
    .where(eq(admins.id, id))
    .returning({
      id: admins.id,
      name: admins.name,
      email: admins.email,
      role: admins.role,
      createdAt: admins.createdAt,
    });

  return updated || null;
}

export async function deleteAdmin(id: string) {
  const [deleted] = await db
    .delete(admins)
    .where(eq(admins.id, id))
    .returning({
      id: admins.id,
      name: admins.name,
      email: admins.email,
      role: admins.role,
    });

  return deleted || null;
}
