// src/db/schema.ts
// Drizzle ORM schema — PostgreSQL

import {
  pgTable,
  uuid,
  varchar,
  text,
  integer,
  numeric,
  timestamp,
  boolean,
  pgEnum,
  index,
  jsonb,
} from "drizzle-orm/pg-core";
import { relations } from "drizzle-orm";

// enums

export const adminRoleEnum = pgEnum("admin_role", [
  "super_admin",
  "admin",
  "gate_staff",
]);
export const eventStatusEnum = pgEnum("event_status", ["open", "closed"]);
export const orderStatusEnum = pgEnum("order_status", [
  "pending",
  "verified",
  "rejected",
  "expired",
]);
export const discountTypeEnum = pgEnum("discount_type", ["fixed", "percentage"]);

export const admins = pgTable("admins", {
  id: uuid("id").defaultRandom().primaryKey(),
  name: varchar("name", { length: 100 }).notNull(),
  email: varchar("email", { length: 150 }).notNull().unique(),
  passwordHash: text("password_hash").notNull(),
  role: adminRoleEnum("role").notNull().default("admin"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const systemSettings = pgTable("system_settings", {
  id: varchar("id", { length: 50 }).primaryKey().default("default"),
  defaultMaxTicketsPerOrder: integer("default_max_tickets_per_order").notNull().default(4),
  pendingOrderExpiryMinutes: integer("pending_order_expiry_minutes").notNull().default(15),
  supportEmail: varchar("support_email", { length: 150 }).notNull().default("support@ggtix.id"),
  supportWhatsapp: varchar("support_whatsapp", { length: 50 }).notNull().default("+6281234567890"),
  maintenanceMode: boolean("maintenance_mode").notNull().default(false),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export const auditLogs = pgTable(
  "audit_logs",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    requestId: varchar("request_id", { length: 128 }),
    userId: uuid("user_id").references(() => admins.id, { onDelete: "set null" }),
    userEmail: varchar("user_email", { length: 150 }),
    userRole: varchar("user_role", { length: 50 }),
    method: varchar("method", { length: 10 }).notNull(),
    path: text("path").notNull(),
    statusCode: integer("status_code").notNull(),
    ip: varchar("ip", { length: 50 }).notNull(),
    userAgent: text("user_agent"),
    durationMs: integer("duration_ms"),
    details: jsonb("details"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    userIdIdx: index("audit_logs_user_id_idx").on(table.userId),
    createdAtIdx: index("audit_logs_created_at_idx").on(table.createdAt),
    pathIdx: index("audit_logs_path_idx").on(table.path),
    statusIdx: index("audit_logs_status_idx").on(table.statusCode),
  })
);

export const customers = pgTable("customers", {
  id: uuid("id").defaultRandom().primaryKey(),
  name: varchar("name", { length: 100 }).notNull(),
  email: varchar("email", { length: 150 }).notNull().unique(),
  passwordHash: text("password_hash").notNull(),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const artists = pgTable("artists", {
  id: uuid("id").defaultRandom().primaryKey(),
  name: varchar("name", { length: 150 }).notNull(),
  bio: text("bio"),
  photoUrl: text("photo_url"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const venues = pgTable(
  "venues",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    name: varchar("name", { length: 200 }).notNull(),
    address: text("address").notNull(),
    city: varchar("city", { length: 100 }).notNull().default("Jakarta"),
    imageUrl: text("image_url"),
    sortOrder: integer("sort_order").notNull().default(0),
    createdAt: timestamp("created_at").notNull().defaultNow(),
  },
  (table) => ({
    nameIdx: index("venues_name_idx").on(table.name),
  })
);

export const events = pgTable(
  "events",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    title: varchar("title", { length: 200 }).notNull(),
    artistId: uuid("artist_id")
      .notNull()
      .references(() => artists.id, { onDelete: "restrict" }),
    publisherName: varchar("publisher_name", { length: 100 }).notNull(),
    venueId: uuid("venue_id")
      .references(() => venues.id, { onDelete: "restrict" }),
    dateTime: timestamp("date_time").notNull(),
    endDateTime: timestamp("end_date_time"),
    description: text("description"),
    maxTicketsPerOrder: integer("max_tickets_per_order"),
    tags: text("tags").array().notNull().default([]),
    seatmapUrl: text("seatmap_url"),
    sortOrder: integer("sort_order").notNull().default(0),
    imageUrl: text("image_url"),
    status: eventStatusEnum("status").notNull().default("open"),
    createdBy: uuid("created_by")
      .notNull()
      .references(() => admins.id),
    createdAt: timestamp("created_at").notNull().defaultNow(),
  },
  (table) => ({
    publisherIdx: index("events_publisher_idx").on(table.publisherName),
    statusIdx: index("events_status_idx").on(table.status),
    artistIdx: index("events_artist_id_idx").on(table.artistId),
    venueIdx: index("events_venue_id_idx").on(table.venueId),
  })
);

export const ticketCategories = pgTable("ticket_categories", {
  id: uuid("id").defaultRandom().primaryKey(),
  eventId: uuid("event_id")
    .notNull()
    .references(() => events.id, { onDelete: "cascade" }),
  name: varchar("name", { length: 50 }).notNull(),
  price: numeric("price", { precision: 12, scale: 2 }).notNull(),
  quotaTotal: integer("quota_total").notNull(),
  quotaRemaining: integer("quota_remaining").notNull(),
  benefits: text("benefits").array().notNull().default([]),
  sortOrder: integer("sort_order").notNull().default(0),
});

export const orders = pgTable(
  "orders",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    customerId: uuid("customer_id")
      .notNull()
      .references(() => customers.id),
    eventId: uuid("event_id")
      .notNull()
      .references(() => events.id),
    categoryId: uuid("category_id")
      .notNull()
      .references(() => ticketCategories.id),
    quantity: integer("quantity").notNull(),
    subtotalPrice: numeric("subtotal_price", { precision: 12, scale: 2 }).notNull().default("0.00"),
    discountAmount: numeric("discount_amount", { precision: 12, scale: 2 }).notNull().default("0.00"),
    totalPrice: numeric("total_price", { precision: 12, scale: 2 }).notNull(),
    voucherId: uuid("voucher_id").references(() => vouchers.id, { onDelete: "set null" }),
    voucherCode: varchar("voucher_code", { length: 50 }),
    status: orderStatusEnum("status").notNull().default("pending"),
    createdAt: timestamp("created_at").notNull().defaultNow(),
    verifiedBy: uuid("verified_by").references(() => admins.id),
    verifiedAt: timestamp("verified_at"),
  },
  (table) => ({
    statusIdx: index("orders_status_idx").on(table.status),
    eventIdx: index("orders_event_id_idx").on(table.eventId),
    customerIdx: index("orders_customer_id_idx").on(table.customerId),
    voucherIdx: index("orders_voucher_id_idx").on(table.voucherId),
  })
);

export const vouchers = pgTable(
  "vouchers",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    code: varchar("code", { length: 50 }).notNull().unique(),
    name: varchar("name", { length: 150 }).notNull(),
    description: text("description"),
    discountType: discountTypeEnum("discount_type").notNull(),
    discountValue: numeric("discount_value", { precision: 12, scale: 2 }).notNull(),
    maxDiscountAmount: numeric("max_discount_amount", { precision: 12, scale: 2 }),
    minOrderAmount: numeric("min_order_amount", { precision: 12, scale: 2 }).notNull().default("0.00"),
    quotaTotal: integer("quota_total").notNull(),
    quotaRemaining: integer("quota_remaining").notNull(),
    maxUsagePerCustomer: integer("max_usage_per_customer").notNull().default(1),
    eventId: uuid("event_id").references(() => events.id, { onDelete: "set null" }),
    startDate: timestamp("start_date").notNull().defaultNow(),
    endDate: timestamp("end_date").notNull(),
    isActive: boolean("is_active").notNull().default(true),
    createdBy: uuid("created_by")
      .notNull()
      .references(() => admins.id),
    createdAt: timestamp("created_at").notNull().defaultNow(),
    updatedAt: timestamp("updated_at").notNull().defaultNow(),
  },
  (table) => ({
    codeIdx: index("vouchers_code_idx").on(table.code),
    eventIdIdx: index("vouchers_event_id_idx").on(table.eventId),
    activeDateIdx: index("vouchers_active_date_idx").on(table.isActive, table.startDate, table.endDate),
  })
);

export const voucherUsages = pgTable(
  "voucher_usages",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    voucherId: uuid("voucher_id")
      .notNull()
      .references(() => vouchers.id, { onDelete: "restrict" }),
    customerId: uuid("customer_id")
      .notNull()
      .references(() => customers.id, { onDelete: "restrict" }),
    orderId: uuid("order_id")
      .notNull()
      .references(() => orders.id, { onDelete: "cascade" }),
    discountApplied: numeric("discount_applied", { precision: 12, scale: 2 }).notNull(),
    status: varchar("status", { length: 20 }).notNull().default("active"),
    createdAt: timestamp("created_at").notNull().defaultNow(),
  },
  (table) => ({
    customerVoucherIdx: index("voucher_usages_customer_voucher_idx").on(table.customerId, table.voucherId),
    orderIdIdx: index("voucher_usages_order_id_idx").on(table.orderId),
  })
);

export const paymentProofs = pgTable("payment_proofs", {
  id: uuid("id").defaultRandom().primaryKey(),
  orderId: uuid("order_id")
    .notNull()
    .references(() => orders.id, { onDelete: "cascade" }),
  imageUrl: text("image_url"),
  midtransTransactionId: varchar("midtrans_transaction_id", { length: 100 }),
  paymentType: varchar("payment_type", { length: 50 }),
  transactionStatus: varchar("transaction_status", { length: 30 }),
  midtransResponse: jsonb("midtrans_response"),
  paidAt: timestamp("paid_at"),
  uploadedAt: timestamp("uploaded_at").notNull().defaultNow(),
});

export const tickets = pgTable("tickets", {
  id: uuid("id").defaultRandom().primaryKey(),
  orderId: uuid("order_id")
    .notNull()
    .references(() => orders.id, { onDelete: "cascade" }),
  qrCodeValue: varchar("qr_code_value", { length: 255 }).notNull().unique(),
  checkedIn: boolean("checked_in").notNull().default(false),
  checkedInAt: timestamp("checked_in_at"),
});

// relations

export const artistsRelations = relations(artists, ({ many }) => ({
  events: many(events),
}));

export const eventsRelations = relations(events, ({ one, many }) => ({
  artist: one(artists, { fields: [events.artistId], references: [artists.id] }),
  venue: one(venues, { fields: [events.venueId], references: [venues.id] }),
  createdByAdmin: one(admins, { fields: [events.createdBy], references: [admins.id] }),
  ticketCategories: many(ticketCategories),
  orders: many(orders),
}));

export const venuesRelations = relations(venues, ({ many }) => ({
  events: many(events),
}));

export const ticketCategoriesRelations = relations(ticketCategories, ({ one, many }) => ({
  event: one(events, { fields: [ticketCategories.eventId], references: [events.id] }),
  orders: many(orders),
}));

export const ordersRelations = relations(orders, ({ one, many }) => ({
  customer: one(customers, { fields: [orders.customerId], references: [customers.id] }),
  event: one(events, { fields: [orders.eventId], references: [events.id] }),
  category: one(ticketCategories, { fields: [orders.categoryId], references: [ticketCategories.id] }),
  verifiedByAdmin: one(admins, { fields: [orders.verifiedBy], references: [admins.id] }),
  voucher: one(vouchers, { fields: [orders.voucherId], references: [vouchers.id] }),
  paymentProofs: many(paymentProofs),
  tickets: many(tickets),
  voucherUsages: many(voucherUsages),
}));

export const vouchersRelations = relations(vouchers, ({ one, many }) => ({
  event: one(events, { fields: [vouchers.eventId], references: [events.id] }),
  createdByAdmin: one(admins, { fields: [vouchers.createdBy], references: [admins.id] }),
  usages: many(voucherUsages),
  orders: many(orders),
}));

export const voucherUsagesRelations = relations(voucherUsages, ({ one }) => ({
  voucher: one(vouchers, { fields: [voucherUsages.voucherId], references: [vouchers.id] }),
  customer: one(customers, { fields: [voucherUsages.customerId], references: [customers.id] }),
  order: one(orders, { fields: [voucherUsages.orderId], references: [orders.id] }),
}));

export const paymentProofsRelations = relations(paymentProofs, ({ one }) => ({
  order: one(orders, { fields: [paymentProofs.orderId], references: [orders.id] }),
}));

export const ticketsRelations = relations(tickets, ({ one }) => ({
  order: one(orders, { fields: [tickets.orderId], references: [orders.id] }),
}));

export const customersRelations = relations(customers, ({ many }) => ({
  orders: many(orders),
  voucherUsages: many(voucherUsages),
}));


// Opt-in devices and durable Expo delivery jobs. Credentials never enter payloads.
export const pushDevices = pgTable('push_devices', {
  id: uuid('id').defaultRandom().primaryKey(),
  customerId: uuid('customer_id').notNull().references(() => customers.id, { onDelete: 'cascade' }),
  token: text('token').notNull().unique(),
  enabled: boolean('enabled').notNull().default(true),
  activatedAt: timestamp('activated_at', { withTimezone: true }).notNull().defaultNow(),
}, table => ({ customerIdx: index('push_devices_customer_idx').on(table.customerId) }));
export const notificationJobs = pgTable('notification_jobs', {
  id: uuid('id').defaultRandom().primaryKey(),
  dedupeKey: text('dedupe_key').notNull().unique(),
  deviceId: uuid('device_id').notNull().references(() => pushDevices.id, { onDelete: 'cascade' }),
  title: text('title').notNull(), body: text('body').notNull(), data: jsonb('data').notNull(),
  status: varchar('status', { length: 20 }).notNull().default('pending'),
  attempts: integer('attempts').notNull().default(0),
  receiptId: text('receipt_id'), lastError: text('last_error'),
  availableAt: timestamp('available_at', { withTimezone: true }).notNull().defaultNow(),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
}, table => ({ pendingIdx: index('notification_jobs_pending_idx').on(table.status, table.availableAt) }));
