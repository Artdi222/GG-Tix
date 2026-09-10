import { eq, and, sql, desc, count, ilike } from "drizzle-orm";
import { db } from "../db";
import { vouchers, voucherUsages, events, customers, orders } from "../db/schema";

export interface CreateVoucherInput {
  code: string;
  name: string;
  description?: string;
  discountType: "fixed" | "percentage";
  discountValue: string;
  maxDiscountAmount?: string | null;
  minOrderAmount?: string;
  quotaTotal: number;
  quotaRemaining?: number;
  maxUsagePerCustomer?: number;
  eventId?: string | null;
  startDate?: Date;
  endDate: Date;
  isActive?: boolean;
  createdBy: string;
}

export interface UpdateVoucherInput {
  name?: string;
  description?: string;
  discountType?: "fixed" | "percentage";
  discountValue?: string;
  maxDiscountAmount?: string | null;
  minOrderAmount?: string;
  quotaTotal?: number;
  quotaRemaining?: number;
  maxUsagePerCustomer?: number;
  eventId?: string | null;
  startDate?: Date;
  endDate?: Date;
  isActive?: boolean;
}

export interface VoucherQueryFilters {
  search?: string;
  status?: "active" | "inactive";
  eventId?: string;
  page?: number;
  limit?: number;
}

export async function findVoucherByCode(code: string) {
  const normalizedCode = code.trim().toUpperCase();
  const [voucher] = await db
    .select()
    .from(vouchers)
    .where(eq(sql`UPPER(${vouchers.code})`, normalizedCode))
    .limit(1);
  return voucher || null;
}

export async function findVoucherById(id: string) {
  const [voucher] = await db
    .select()
    .from(vouchers)
    .where(eq(vouchers.id, id))
    .limit(1);
  return voucher || null;
}

export async function countCustomerUsages(customerId: string, voucherId: string): Promise<number> {
  const [result] = await db
    .select({ total: count() })
    .from(voucherUsages)
    .where(
      and(
        eq(voucherUsages.customerId, customerId),
        eq(voucherUsages.voucherId, voucherId),
        eq(voucherUsages.status, "active")
      )
    );
  return Number(result?.total || 0);
}

export async function findVouchers(filters: VoucherQueryFilters) {
  const page = Math.max(1, filters.page || 1);
  const limit = Math.min(100, Math.max(1, filters.limit || 15));
  const offset = (page - 1) * limit;

  const conditions = [];

  if (filters.search) {
    const q = `%${filters.search.trim()}%`;
    conditions.push(sql`(${vouchers.code} ILIKE ${q} OR ${vouchers.name} ILIKE ${q})`);
  }

  if (filters.status === "active") {
    conditions.push(eq(vouchers.isActive, true));
  } else if (filters.status === "inactive") {
    conditions.push(eq(vouchers.isActive, false));
  }

  if (filters.eventId) {
    conditions.push(eq(vouchers.eventId, filters.eventId));
  }

  const whereClause = conditions.length > 0 ? and(...conditions) : undefined;

  const [totalRes] = await db
    .select({ count: count() })
    .from(vouchers)
    .where(whereClause);

  const totalCount = Number(totalRes?.count || 0);

  const items = await db
    .select({
      id: vouchers.id,
      code: vouchers.code,
      name: vouchers.name,
      description: vouchers.description,
      discountType: vouchers.discountType,
      discountValue: vouchers.discountValue,
      maxDiscountAmount: vouchers.maxDiscountAmount,
      minOrderAmount: vouchers.minOrderAmount,
      quotaTotal: vouchers.quotaTotal,
      quotaRemaining: vouchers.quotaRemaining,
      maxUsagePerCustomer: vouchers.maxUsagePerCustomer,
      eventId: vouchers.eventId,
      eventTitle: events.title,
      startDate: vouchers.startDate,
      endDate: vouchers.endDate,
      isActive: vouchers.isActive,
      createdBy: vouchers.createdBy,
      createdAt: vouchers.createdAt,
      updatedAt: vouchers.updatedAt,
    })
    .from(vouchers)
    .leftJoin(events, eq(vouchers.eventId, events.id))
    .where(whereClause)
    .orderBy(desc(vouchers.createdAt))
    .limit(limit)
    .offset(offset);

  return {
    items,
    pagination: {
      page,
      limit,
      totalCount,
      totalPages: Math.ceil(totalCount / limit) || 1,
    },
  };
}

export async function createVoucher(data: CreateVoucherInput) {
  const [newVoucher] = await db
    .insert(vouchers)
    .values({
      ...data,
      code: data.code.trim().toUpperCase(),
      quotaRemaining: data.quotaRemaining ?? data.quotaTotal,
    })
    .returning();
  return newVoucher;
}

export async function updateVoucher(id: string, data: UpdateVoucherInput) {
  const [updated] = await db
    .update(vouchers)
    .set({
      ...data,
      updatedAt: new Date(),
    })
    .where(eq(vouchers.id, id))
    .returning();
  return updated || null;
}

export async function toggleVoucher(id: string) {
  const voucher = await findVoucherById(id);
  if (!voucher) return null;

  const [updated] = await db
    .update(vouchers)
    .set({
      isActive: !voucher.isActive,
      updatedAt: new Date(),
    })
    .where(eq(vouchers.id, id))
    .returning();
  return updated;
}

export async function deleteVoucher(id: string) {
  const [result] = await db
    .delete(vouchers)
    .where(eq(vouchers.id, id))
    .returning({ id: vouchers.id });
  return Boolean(result);
}

export async function getVoucherUsages(voucherId: string, page = 1, limit = 20) {
  const offset = (page - 1) * limit;

  const [totalRes] = await db
    .select({ count: count() })
    .from(voucherUsages)
    .where(eq(voucherUsages.voucherId, voucherId));

  const totalCount = Number(totalRes?.count || 0);

  const items = await db
    .select({
      id: voucherUsages.id,
      orderId: voucherUsages.orderId,
      customerId: voucherUsages.customerId,
      customerName: customers.name,
      customerEmail: customers.email,
      discountApplied: voucherUsages.discountApplied,
      status: voucherUsages.status,
      createdAt: voucherUsages.createdAt,
    })
    .from(voucherUsages)
    .innerJoin(customers, eq(voucherUsages.customerId, customers.id))
    .where(eq(voucherUsages.voucherId, voucherId))
    .orderBy(desc(voucherUsages.createdAt))
    .limit(limit)
    .offset(offset);

  return {
    items,
    pagination: {
      page,
      limit,
      totalCount,
      totalPages: Math.ceil(totalCount / limit) || 1,
    },
  };
}

export async function getVoucherStats() {
  const [activeRes] = await db
    .select({ count: count() })
    .from(vouchers)
    .where(eq(vouchers.isActive, true));

  const [usagesRes] = await db
    .select({
      totalDiscount: sql<string>`COALESCE(SUM(${voucherUsages.discountApplied}), '0.00')`,
      totalTransactions: count(),
    })
    .from(voucherUsages)
    .where(eq(voucherUsages.status, "active"));

  return {
    activeVouchers: Number(activeRes?.count || 0),
    totalDiscountDistributed: usagesRes?.totalDiscount || "0.00",
    totalDiscountedOrders: Number(usagesRes?.totalTransactions || 0),
  };
}
