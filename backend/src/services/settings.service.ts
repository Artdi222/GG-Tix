import { eq, count, desc, and, SQL, ilike, or, sql } from "drizzle-orm";
import { db } from "../db";
import { systemSettings, auditLogs, admins } from "../db/schema";
import { AppError } from "../lib/errors";

export async function getSystemSettings() {
  const [settings] = await db.select().from(systemSettings).where(eq(systemSettings.id, "default")).limit(1);
  return settings || {
    id: "default",
    defaultMaxTicketsPerOrder: 4,
    pendingOrderExpiryMinutes: 15,
    supportEmail: "support@ggtix.id",
    supportWhatsapp: "+6281234567890",
    maintenanceMode: false,
    updatedAt: new Date(),
  };
}

export async function updateSystemSettings(data: {
  defaultMaxTicketsPerOrder?: number;
  pendingOrderExpiryMinutes?: number;
  supportEmail?: string;
  supportWhatsapp?: string;
  maintenanceMode?: boolean;
}) {
  const updateData: Record<string, any> = {};
  if (data.defaultMaxTicketsPerOrder !== undefined) updateData.defaultMaxTicketsPerOrder = data.defaultMaxTicketsPerOrder;
  if (data.pendingOrderExpiryMinutes !== undefined) updateData.pendingOrderExpiryMinutes = data.pendingOrderExpiryMinutes;
  if (data.supportEmail !== undefined) updateData.supportEmail = data.supportEmail;
  if (data.supportWhatsapp !== undefined) updateData.supportWhatsapp = data.supportWhatsapp;
  if (data.maintenanceMode !== undefined) updateData.maintenanceMode = data.maintenanceMode;
  
  updateData.updatedAt = new Date();

  // Upsert logic
  await db.insert(systemSettings).values({ id: "default", ...updateData }).onConflictDoUpdate({
    target: systemSettings.id,
    set: updateData,
  });

  return await getSystemSettings();
}

export async function getAuditLogs(filters: {
  search?: string;
  method?: string;
  statusCode?: number;
  page?: number;
  limit?: number;
}) {
  const { search, method, statusCode, page = 1, limit = 15 } = filters;
  const offset = (page - 1) * limit;

  const conditions: SQL[] = [];

  if (search?.trim()) {
    const term = `%${search.trim()}%`;
    conditions.push(
      or(
        ilike(auditLogs.path, term),
        ilike(auditLogs.userEmail, term),
        ilike(auditLogs.userRole, term),
        ilike(admins.email, term),
        ilike(admins.name, term)
      ) as SQL
    );
  }

  if (method) {
    conditions.push(eq(auditLogs.method, method));
  }

  if (statusCode) {
    conditions.push(eq(auditLogs.statusCode, statusCode));
  }

  const whereClause = conditions.length > 0 ? and(...conditions) : undefined;

  const items = await db
    .select({
      id: auditLogs.id,
      requestId: auditLogs.requestId,
      userId: auditLogs.userId,
      userEmail: sql<string>`COALESCE(${auditLogs.userEmail}, ${admins.email})`,
      userName: admins.name,
      userRole: auditLogs.userRole,
      method: auditLogs.method,
      path: auditLogs.path,
      statusCode: auditLogs.statusCode,
      ip: auditLogs.ip,
      userAgent: auditLogs.userAgent,
      durationMs: auditLogs.durationMs,
      details: auditLogs.details,
      createdAt: auditLogs.createdAt,
    })
    .from(auditLogs)
    .leftJoin(admins, eq(auditLogs.userId, admins.id))
    .where(whereClause)
    .orderBy(desc(auditLogs.createdAt))
    .limit(limit)
    .offset(offset);

  const [{ total }] = await db
    .select({ total: count() })
    .from(auditLogs)
    .leftJoin(admins, eq(auditLogs.userId, admins.id))
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

export async function createAuditLog(data: typeof auditLogs.$inferInsert) {
  try {
    await db.insert(auditLogs).values(data);
  } catch (err) {
    console.error("Failed to insert audit log to database:", err);
  }
}

export async function getDiagnostics() {
  const startDb = performance.now();
  let dbStatus = "healthy";
  let dbLatency = 0;
  try {
    await db.execute(sql`SELECT 1`);
    dbLatency = Math.round(performance.now() - startDb);
  } catch (e) {
    dbStatus = "unhealthy";
  }

  return {
    database: {
      status: dbStatus,
      latencyMs: dbLatency,
    },
    storage: {
      status: (process.env.B2_KEY_ID || process.env.B2_APPLICATION_KEY_ID) && process.env.B2_APPLICATION_KEY && process.env.B2_BUCKET ? "healthy" : "not_configured",
      provider: "Backblaze B2",
    },
    paymentGateway: {
      status: process.env.MIDTRANS_SERVER_KEY ? "healthy" : "not_configured",
      environment: process.env.MIDTRANS_IS_PRODUCTION === "true" ? "production" : "sandbox",
    },
    runtime: {
      platform: "Bun / Hono",
      nodeEnv: process.env.NODE_ENV || "development",
      uptimeSeconds: Math.round(process.uptime()),
    },
  };
}
