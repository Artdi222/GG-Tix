import { eq } from "drizzle-orm";
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
