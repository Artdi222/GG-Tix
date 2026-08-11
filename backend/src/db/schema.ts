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
} from "drizzle-orm/pg-core";
import { relations } from "drizzle-orm";

// enums

export const adminRoleEnum = pgEnum("admin_role", ["super_admin", "staff"]);
export const eventStatusEnum = pgEnum("event_status", ["open", "closed"]);
export const orderStatusEnum = pgEnum("order_status", [
  "pending",
  "verified",
  "rejected",
]);

export const admins = pgTable("admins", {
  id: uuid("id").defaultRandom().primaryKey(),
  name: varchar("name", { length: 100 }).notNull(),
  email: varchar("email", { length: 150 }).notNull().unique(),
  passwordHash: text("password_hash").notNull(),
  role: adminRoleEnum("role").notNull().default("staff"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

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
    latitude: numeric("latitude", { precision: 10, scale: 7 }),
    longitude: numeric("longitude", { precision: 10, scale: 7 }),
    imageUrl: text("image_url"),
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
    venue: varchar("venue", { length: 200 }).notNull(),
    city: varchar("city", { length: 100 }).notNull(),
    dateTime: timestamp("date_time").notNull(),
    imageUrl: text("image_url"),
    status: eventStatusEnum("status").notNull().default("open"),
    createdBy: uuid("created_by")
      .notNull()
      .references(() => admins.id),
    createdAt: timestamp("created_at").notNull().defaultNow(),
  },
  (table) => ({
    publisherIdx: index("events_publisher_idx").on(table.publisherName),
    cityIdx: index("events_city_idx").on(table.city),
    statusIdx: index("events_status_idx").on(table.status),
    artistIdx: index("events_artist_id_idx").on(table.artistId),
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
    totalPrice: numeric("total_price", { precision: 12, scale: 2 }).notNull(),
    status: orderStatusEnum("status").notNull().default("pending"),
    createdAt: timestamp("created_at").notNull().defaultNow(),
    verifiedBy: uuid("verified_by").references(() => admins.id),
    verifiedAt: timestamp("verified_at"),
  },
  (table) => ({
    statusIdx: index("orders_status_idx").on(table.status),
    eventIdx: index("orders_event_id_idx").on(table.eventId),
    customerIdx: index("orders_customer_id_idx").on(table.customerId),
  })
);

export const paymentProofs = pgTable("payment_proofs", {
  id: uuid("id").defaultRandom().primaryKey(),
  orderId: uuid("order_id")
    .notNull()
    .references(() => orders.id, { onDelete: "cascade" }),
  imageUrl: text("image_url").notNull(),
  uploadedAt: timestamp("uploaded_at").notNull().defaultNow(),
});

export const tickets = pgTable("tickets", {
  id: uuid("id").defaultRandom().primaryKey(),
  orderId: uuid("order_id")
    .notNull()
    .references(() => orders.id, { onDelete: "cascade" }),
  qrCodeValue: varchar("qr_code_value", { length: 255 }).notNull().unique(),
  checkedIn: boolean("checked_in").notNull().default(false),
});

// relations

export const artistsRelations = relations(artists, ({ many }) => ({
  events: many(events),
}));

export const eventsRelations = relations(events, ({ one, many }) => ({
  artist: one(artists, { fields: [events.artistId], references: [artists.id] }),
  createdByAdmin: one(admins, { fields: [events.createdBy], references: [admins.id] }),
  ticketCategories: many(ticketCategories),
  orders: many(orders),
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
  paymentProofs: many(paymentProofs),
  tickets: many(tickets),
}));

export const customersRelations = relations(customers, ({ many }) => ({
  orders: many(orders),
}));
