import { eq } from "drizzle-orm";
import { db } from "../db";
import { admins } from "../db/schema";

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
  role?: "super_admin" | "staff";
}) {
  const [newAdmin] = await db
    .insert(admins)
    .values({
      name: data.name.trim(),
      email: data.email.toLowerCase().trim(),
      passwordHash: data.passwordHash,
      role: data.role || "staff",
    })
    .returning();
  return newAdmin;
}
