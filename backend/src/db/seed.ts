/**
 * Seed script — populates the database with demo game-concert data.
 *
 * Usage: bun run db:seed
 *
 * This script is idempotent-ish: it truncates all tables first, then inserts
 * fresh seed data. Run it against a dev database only.
 */

import { db, client } from "./index";
import { sql } from "drizzle-orm";
import {
  admins,
  customers,
  artists,
  venues,
  events,
  ticketCategories,
  orders,
} from "./schema";

async function seed() {
  console.log("Seeding database…");

  // Truncate in correct order (respecting FK constraints)
  await db.execute(
    sql`TRUNCATE orders, ticket_categories, events, artists, customers, admins CASCADE`
  );
  console.log("  Truncated existing data");

  // 1. Admins
  const adminPassword = await Bun.password.hash("admin123");

  const [adminBudi] = await db
    .insert(admins)
    .values([
      {
        name: "Budi Santoso",
        email: "budi@ggtix.com",
        passwordHash: adminPassword,
        role: "super_admin",
      },
      {
        name: "Artdi",
        email: "artdi@ggtix.com",
        passwordHash: adminPassword,
        role: "super_admin",
      },
      {
      name: "Siti Rahayu",
        email: "siti@ggtix.com",
        passwordHash: adminPassword,
        role: "staff",
      },
    ])
    .returning();

  console.log("  3 admins created (password: admin123)");

  // 1b. Venues (GGT-03)
  const insertedVenues = await db
    .insert(venues)
    .values([
      {
        name: "Gelora Bung Karno",
        address: "Jl. Pintu Satu Senayan, Gelora, Tanah Abang, Jakarta Pusat, DKI Jakarta 10270",
        latitude: "-6.2187300",
        longitude: "106.8026815",
        imageUrl: null,
      },
      {
        name: "Istora Senayan",
        address: "Gelora Bung Karno Complex, Jl. Pintu Satu Senayan, Tanah Abang, Jakarta Pusat, DKI Jakarta 10270",
        latitude: "-6.2207900",
        longitude: "106.8047900",
        imageUrl: null,
      },
    ])
    .returning();

  console.log("  2 venues created");

  // 2. Customers
  const customerPassword = await Bun.password.hash("customer123");

  const insertedCustomers = await db
    .insert(customers)
    .values([
      {
        name: "Sari Dewi",
        email: "sari@example.com",
        passwordHash: customerPassword,
      },
      {
        name: "Andi Pratama",
        email: "andi@example.com",
        passwordHash: customerPassword,
      },
      {
        name: "Rina Kartika",
        email: "rina@example.com",
        passwordHash: customerPassword,
      },
    ])
    .returning();

  console.log("  3 customers created (password: customer123)");

  // 3. Artists
  const insertedArtists = await db
    .insert(artists)
    .values([
      {
        name: "Rover Ensemble",
        bio: "An orchestral ensemble performing the epic soundtrack of Wuthering Waves — soaring strings, combat themes, and the haunting melodies of Solaris.",
        photoUrl: "https://placehold.co/400x400?text=Rover+Ensemble",
      },
      {
        name: "Stellar Astral",
        bio: "A cosmic pop group channeling the star-rail aesthetic: neon synths, celestial harmonics, and hype-inducing concert energy straight from the Astral Express.",
        photoUrl: "https://placehold.co/400x400?text=Stellar+Astral",
      },
      {
        name: "Liyue Philharmonic",
        bio: "Traditional Chinese instruments meet modern orchestration. Their renditions of Genshin Impact's Liyue and Sumeru scores have become legendary.",
        photoUrl: "https://placehold.co/400x400?text=Liyue+Philharmonic",
      },
      {
        name: "Rhodes Island Band",
        bio: "Industrial rock meets electronic — the signature sound of Arknights brought to life with pounding beats and dramatic operatic vocals.",
        photoUrl: "https://placehold.co/400x400?text=Rhodes+Island+Band",
      },
      {
        name: "Zenless Zone Zero DJ Crew",
        bio: "High-energy DJ collective spinning the urban beats of New Eridu. Expect bass drops, breakbeats, and neon-drenched stage shows.",
        photoUrl: "https://placehold.co/400x400?text=ZZZ+DJ+Crew",
      },
    ])
    .returning();

  console.log("  5 artists created");

  // 4. Events
  const insertedEvents = await db
    .insert(events)
    .values([
      {
        title: "Wuthering Waves Live 2026",
        artistId: insertedArtists[0].id,
        publisherName: "Kuro Games",
        venue: "Gelora Bung Karno",
        city: "Jakarta",
        dateTime: new Date("2026-10-12T19:00:00Z"),
        status: "open",
        createdBy: adminBudi.id,
      },
      {
        title: "Honkai: Star Rail — Astral Concert",
        artistId: insertedArtists[1].id,
        publisherName: "HoYoverse",
        venue: "Istora Senayan",
        city: "Jakarta",
        dateTime: new Date("2026-11-08T18:30:00Z"),
        status: "open",
        createdBy: adminBudi.id,
      },
      {
        title: "Genshin Impact: Resonance in Teyvat",
        artistId: insertedArtists[2].id,
        publisherName: "HoYoverse",
        venue: "Trans Convention Center",
        city: "Bandung",
        dateTime: new Date("2026-11-22T19:00:00Z"),
        status: "open",
        createdBy: adminBudi.id,
      },
      {
        title: "Arknights: Contingency Stage",
        artistId: insertedArtists[3].id,
        publisherName: "Hypergryph",
        venue: "Surabaya Convention Hall",
        city: "Surabaya",
        dateTime: new Date("2026-12-05T20:00:00Z"),
        status: "open",
        createdBy: adminBudi.id,
      },
      {
        title: "Zenless Zone Zero: NEON NIGHT",
        artistId: insertedArtists[4].id,
        publisherName: "HoYoverse",
        venue: "Jogja Expo Center",
        city: "Yogyakarta",
        dateTime: new Date("2027-01-15T20:00:00Z"),
        status: "open",
        createdBy: adminBudi.id,
      },
      {
        title: "Wuthering Waves: Resonator's Encore",
        artistId: insertedArtists[0].id,
        publisherName: "Kuro Games",
        venue: "Bali Nusa Dua Convention Center",
        city: "Bali",
        dateTime: new Date("2027-02-20T19:30:00Z"),
        status: "closed",
        createdBy: adminBudi.id,
      },
    ])
    .returning();

  console.log("  6 events created (5 open, 1 closed)");

  // 5. Ticket Categories
  const categoryData = [
    // Wuthering Waves Live 2026
    { eventId: insertedEvents[0].id, name: "VVIP", price: "1500000.00", quotaTotal: 30, quotaRemaining: 22 },
    { eventId: insertedEvents[0].id, name: "VIP", price: "750000.00", quotaTotal: 100, quotaRemaining: 67 },
    { eventId: insertedEvents[0].id, name: "Reguler", price: "250000.00", quotaTotal: 500, quotaRemaining: 340 },
    // Honkai: Star Rail — Astral Concert
    { eventId: insertedEvents[1].id, name: "VIP", price: "800000.00", quotaTotal: 80, quotaRemaining: 55 },
    { eventId: insertedEvents[1].id, name: "Reguler", price: "300000.00", quotaTotal: 400, quotaRemaining: 280 },
    // Genshin Impact: Resonance in Teyvat
    { eventId: insertedEvents[2].id, name: "VVIP", price: "2000000.00", quotaTotal: 20, quotaRemaining: 14 },
    { eventId: insertedEvents[2].id, name: "VIP", price: "900000.00", quotaTotal: 60, quotaRemaining: 42 },
    { eventId: insertedEvents[2].id, name: "Reguler", price: "350000.00", quotaTotal: 300, quotaRemaining: 210 },
    // Arknights: Contingency Stage
    { eventId: insertedEvents[3].id, name: "VIP", price: "600000.00", quotaTotal: 50, quotaRemaining: 50 },
    { eventId: insertedEvents[3].id, name: "Reguler", price: "200000.00", quotaTotal: 350, quotaRemaining: 350 },
    // ZZZ: NEON NIGHT
    { eventId: insertedEvents[4].id, name: "VIP", price: "700000.00", quotaTotal: 70, quotaRemaining: 70 },
    { eventId: insertedEvents[4].id, name: "Reguler", price: "250000.00", quotaTotal: 450, quotaRemaining: 450 },
    // WuWa Encore (closed event — sold some already)
    { eventId: insertedEvents[5].id, name: "VIP", price: "850000.00", quotaTotal: 40, quotaRemaining: 5 },
    { eventId: insertedEvents[5].id, name: "Reguler", price: "280000.00", quotaTotal: 200, quotaRemaining: 30 },
  ];

  const insertedCategories = await db
    .insert(ticketCategories)
    .values(categoryData)
    .returning();

  console.log("  14 ticket categories created");

  // 6. Sample Orders
  // Create a mix of verified, pending, and rejected orders for demo realism.
  const orderData = [
    // Sari orders WuWa VVIP — verified
    {
      customerId: insertedCustomers[0].id,
      eventId: insertedEvents[0].id,
      categoryId: insertedCategories[0].id, // WuWa VVIP
      quantity: 2,
      totalPrice: "3000000.00",
      status: "verified" as const,
      verifiedBy: adminBudi.id,
      verifiedAt: new Date("2026-08-01T10:00:00Z"),
    },
    // Sari orders Star Rail VIP — pending
    {
      customerId: insertedCustomers[0].id,
      eventId: insertedEvents[1].id,
      categoryId: insertedCategories[3].id, // Star Rail VIP
      quantity: 1,
      totalPrice: "800000.00",
      status: "pending" as const,
    },
    // Andi orders WuWa Reguler — verified
    {
      customerId: insertedCustomers[1].id,
      eventId: insertedEvents[0].id,
      categoryId: insertedCategories[2].id, // WuWa Reguler
      quantity: 4,
      totalPrice: "1000000.00",
      status: "verified" as const,
      verifiedBy: adminBudi.id,
      verifiedAt: new Date("2026-08-02T14:30:00Z"),
    },
    // Andi orders Genshin VIP — verified
    {
      customerId: insertedCustomers[1].id,
      eventId: insertedEvents[2].id,
      categoryId: insertedCategories[6].id, // Genshin VIP
      quantity: 2,
      totalPrice: "1800000.00",
      status: "verified" as const,
      verifiedBy: adminBudi.id,
      verifiedAt: new Date("2026-08-03T09:15:00Z"),
    },
    // Rina orders Genshin VVIP — pending
    {
      customerId: insertedCustomers[2].id,
      eventId: insertedEvents[2].id,
      categoryId: insertedCategories[5].id, // Genshin VVIP
      quantity: 1,
      totalPrice: "2000000.00",
      status: "pending" as const,
    },
    // Rina orders Star Rail Reguler — rejected (quota refunded)
    {
      customerId: insertedCustomers[2].id,
      eventId: insertedEvents[1].id,
      categoryId: insertedCategories[4].id, // Star Rail Reguler
      quantity: 3,
      totalPrice: "900000.00",
      status: "rejected" as const,
      verifiedBy: adminBudi.id,
      verifiedAt: new Date("2026-08-01T16:45:00Z"),
    },
    // Sari orders WuWa Encore VIP (closed event) — verified
    {
      customerId: insertedCustomers[0].id,
      eventId: insertedEvents[5].id,
      categoryId: insertedCategories[12].id, // Encore VIP
      quantity: 2,
      totalPrice: "1700000.00",
      status: "verified" as const,
      verifiedBy: adminBudi.id,
      verifiedAt: new Date("2026-07-20T11:00:00Z"),
    },
    // Andi orders WuWa VIP — verified
    {
      customerId: insertedCustomers[1].id,
      eventId: insertedEvents[0].id,
      categoryId: insertedCategories[1].id, // WuWa VIP
      quantity: 3,
      totalPrice: "2250000.00",
      status: "verified" as const,
      verifiedBy: adminBudi.id,
      verifiedAt: new Date("2026-08-04T08:00:00Z"),
    },
  ];

  await db.insert(orders).values(orderData);
  console.log("  8 sample orders created (5 verified, 2 pending, 1 rejected)");

  // Done
  console.log("\nSeed complete!");
  console.log("\nLogin credentials:");
  console.log("   Admin:    budi@ggtix.com / admin123");
  console.log("   Admin:    artdi@ggtix.com / admin123");
  console.log("   Admin:    siti@ggtix.com / admin123");
  console.log("   Customer: sari@example.com / customer123");
  console.log("   Customer: andi@example.com / customer123");
  console.log("   Customer: rina@example.com / customer123");
}

seed()
  .catch((err) => {
    console.error("Seed failed:", err);
    process.exit(1);
  })
  .finally(async () => {
    await client.end();
  });
