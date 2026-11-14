/**
 * Seed script — populates the database with demo game-concert data.
 *
 * Usage: bun run db:seed
 *
 * Truncates all tables, then generates a realistic, deterministic dataset whose
 * dates are relative to "now" (WIB), so dashboards always show recent activity:
 * past, ongoing and upcoming events, ~150 customers and ~600 orders over the
 * last 90 days. Quotas are derived from the generated orders so every counter
 * stays consistent. Run it against a dev database only.
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
  tickets,
  paymentProofs,
  vouchers,
  voucherUsages,
} from "./schema";

// Deterministic PRNG (mulberry32) so every seed run produces the same shape.
let state = 0x6767_7478;
function rand() {
  state = (state + 0x6d2b79f5) | 0;
  let t = Math.imul(state ^ (state >>> 15), 1 | state);
  t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
}
const int = (min: number, max: number) => Math.floor(rand() * (max - min + 1)) + min;
const pick = <T>(items: readonly T[]) => items[Math.floor(rand() * items.length)]!;
const chance = (p: number) => rand() < p;

const DAY = 86_400_000;
const NOW = Date.now();

const FIRST = ["Andi", "Budi", "Citra", "Dewi", "Eka", "Fajar", "Gita", "Hana", "Indra", "Joko", "Kevin", "Lestari", "Maya", "Nanda", "Oki", "Putri", "Rizky", "Sari", "Tono", "Umar", "Vina", "Wulan", "Yoga", "Zahra", "Dimas", "Ayu", "Bayu", "Nisa", "Reza", "Tiara", "Galih", "Intan", "Farhan", "Salsa", "Arif", "Melati"];
const LAST = ["Pratama", "Santoso", "Wijaya", "Saputra", "Lestari", "Kusuma", "Hidayat", "Nugroho", "Rahayu", "Siregar", "Halim", "Putra", "Wibowo", "Setiawan", "Maharani", "Gunawan", "Permana", "Anggraini", "Firmansyah", "Utami"];
const PAYMENT_TYPES = ["qris", "qris", "gopay", "shopeepay", "bca_va", "bni_va", "bri_va", "echannel", "credit_card"];

async function seed() {
  console.log("Seeding database…");

  await db.execute(
    sql`TRUNCATE voucher_usages, vouchers, payment_proofs, tickets, orders, ticket_categories, events, venues, artists, customers, admins CASCADE`
  );
  console.log("  Truncated existing data");

  // 1. Admins
  const adminPassword = await Bun.password.hash("admin123");
  const insertedAdmins = await db
    .insert(admins)
    .values([
      { name: "Budi Santoso", email: "budi@ggtix.com", passwordHash: adminPassword, role: "super_admin" },
      { name: "Artdi", email: "artdi@ggtix.com", passwordHash: adminPassword, role: "super_admin" },
      { name: "Maya Kusuma", email: "maya@ggtix.com", passwordHash: adminPassword, role: "admin" },
      { name: "Reza Halim", email: "reza@ggtix.com", passwordHash: adminPassword, role: "admin" },
      { name: "Siti Rahayu", email: "siti@ggtix.com", passwordHash: adminPassword, role: "gate_staff" },
      { name: "Galih Permana", email: "galih@ggtix.com", passwordHash: adminPassword, role: "gate_staff" },
    ])
    .returning();
  const adminBudi = insertedAdmins[0]!;
  const verifiers = insertedAdmins.filter((a) => a.role !== "gate_staff");
  console.log(`  ${insertedAdmins.length} admins created (password: admin123)`);

  // 2. Venues — real venues of official game-music concerts in 2026.
  const insertedVenues = await db
    .insert(venues)
    .values([
      { name: "Le Grand Rex", address: "1 Boulevard Poissonnière, 75002 Paris, Prancis", city: "Paris", sortOrder: 0 },
      { name: "Tokyo International Forum Hall A", address: "3-5-1 Marunouchi, Chiyoda-ku, Tokyo 100-0005, Jepang", city: "Tokyo", sortOrder: 1 },
      { name: "Mercedes-Benz Arena", address: "1200 Shibo Avenue, Pudong New Area, Shanghai, Tiongkok", city: "Shanghai", sortOrder: 2 },
      { name: "The Symphony Hall", address: "2-3-3 Oyodominami, Kita-ku, Osaka 531-0076, Jepang", city: "Osaka", sortOrder: 3 },
      { name: "Zepp DiverCity (Tokyo)", address: "Diver City Tokyo Plaza, 1-1-10 Aomi, Koto-ku, Tokyo 135-0064, Jepang", city: "Tokyo", sortOrder: 4 },
      { name: "Esplanade Theatre", address: "1 Esplanade Drive, Singapura 038981", city: "Singapura", sortOrder: 5 },
      { name: "Royal Albert Hall", address: "Kensington Gore, South Kensington, London SW7 2AP, Inggris", city: "London", sortOrder: 6 },
    ])
    .returning();
  console.log(`  ${insertedVenues.length} venues created`);

  // 3. Artists — performers or presenters named by the official announcements.
  const artistSeed = [
    ["HoYoFair", "Program fan-creation resmi HoYoverse; konser ini membawakan musik Genshin Impact, Honkai: Star Rail, Zenless Zone Zero, dan Honkai Impact 3rd."],
    ["Tokyo Philharmonic Orchestra", "Orkestra yang membawakan The Music of SQUARE ENIX di Tokyo: Final Fantasy, Kingdom Hearts, Dragon Quest, dan lainnya."],
    ["Monster Siren Records", "Label musik resmi Hypergryph untuk Arknights, penyelenggara konser tahunan Ambience Synesthesia."],
    ["NHK Symphony Orchestra", "Orkestra nasional Jepang; tur Pokémon Classic Concert merayakan 30 tahun Pokémon Red & Green."],
    ["ATLUS", "Pengembang seri Persona; Persona Live Tour 2026 -Resonance- merayakan 30 tahun Persona."],
    ["Kuro Games", "Pengembang Wuthering Waves; tur konser To the New World menampilkan soundtrack resmi game."],
    ["Blizzard Entertainment", "Pengembang World of Warcraft; tur 20 Years of Music merayakan dua dekade musik Azeroth."],
  ] as const;
  const insertedArtists = await db
    .insert(artists)
    .values(artistSeed.map(([name, bio]) => ({ name, bio })))
    .returning();
  console.log(`  ${insertedArtists.length} artists created`);

  // 4. Events — official 2026 concerts, moved one year ahead (same local time) so they are on sale.
  //    Set the real dates here when needed; `at` is an ISO time with the venue's UTC offset.
  type Tier = { name: string; price: number; quota: number; benefits: string[] };
  const tier = (name: string, price: number, quota: number, benefits: string[] = []): Tier => ({ name, price, quota, benefits });
  const eventSeed: {
    title: string; artist: number; publisher: string; venue: number; at: string; hours: number;
    sell: number; closed?: boolean; tags: string[]; description: string; tiers: Tier[];
  }[] = [
    {
      title: "HoYoFair Fan Concert", artist: 0, publisher: "HoYoverse", venue: 0, at: "2027-02-21T20:00:00+01:00", hours: 2.5, sell: 0.62,
      tags: ["HoYoverse", "Orchestra"],
      description: "Konser fan resmi HoYoFair dengan musik Genshin Impact, Honkai: Star Rail, Zenless Zone Zero, dan Honkai Impact 3rd. Aslinya digelar 21 Februari 2026 di Le Grand Rex, Paris.",
      tiers: [tier("Catégorie 1", 1_900_000, 300, ["Kursi orchestra depan"]), tier("Catégorie 2", 1_350_000, 900), tier("Catégorie 3", 900_000, 1_400)],
    },
    {
      title: "The Music of SQUARE ENIX – Magic, Memories, and Melodies", artist: 1, publisher: "Square Enix", venue: 1, at: "2027-04-25T18:00:00+09:00", hours: 2.5, sell: 0.55,
      tags: ["SquareEnix", "Orchestra"],
      description: "Tur orkestra resmi Square Enix (Final Fantasy, Kingdom Hearts, Dragon Quest, dan lainnya) bersama Tokyo Philharmonic Orchestra. Aslinya 25–26 April 2026 di Tokyo International Forum Hall A. Harga mengikuti harga resmi (S ¥11.000, A ¥8.800) yang dikonversi.",
      tiers: [tier("S Seat", 1_200_000, 2_500), tier("A Seat", 960_000, 2_500)],
    },
    {
      title: "Arknights Ambience Synesthesia — Once Seen", artist: 2, publisher: "Hypergryph", venue: 2, at: "2027-05-01T19:30:00+08:00", hours: 3, sell: 0.48,
      tags: ["Arknights", "Concert"],
      description: "Konser musik tahunan resmi Arknights (明日方舟「音律联觉——昔时我见」). Aslinya 1–4 Mei 2026, 8 pertunjukan di Mercedes-Benz Arena, Shanghai. Harga mengikuti enam tingkat resmi (¥480–¥1.480) yang dikonversi.",
      tiers: [tier("S", 3_250_000, 600), tier("A", 2_800_000, 1_200), tier("B", 2_370_000, 2_000), tier("C", 1_930_000, 3_000), tier("D", 1_490_000, 3_500), tier("E", 1_050_000, 4_000)],
    },
    {
      title: "NHK Symphony Orchestra × Pokémon Classic Concert", artist: 3, publisher: "The Pokémon Company", venue: 3, at: "2027-08-23T14:00:00+09:00", hours: 2, sell: 0.34,
      tags: ["Pokemon", "Orchestra"],
      description: "Tur konser klasik resmi Pokémon bersama NHK Symphony Orchestra untuk 30 tahun Pokémon Red & Green. Aslinya 23 Agustus 2026 di The Symphony Hall, Osaka.",
      tiers: [tier("S Seat", 1_100_000, 700), tier("A Seat", 850_000, 1_000)],
    },
    {
      title: "Persona Live Tour 2026 -Resonance-", artist: 4, publisher: "ATLUS", venue: 4, at: "2027-09-23T18:00:00+09:00", hours: 2.5, sell: 0.27,
      tags: ["Persona", "Live"],
      description: "Tur konser resmi 30 tahun Persona. Aslinya 23 September 2026 (pukul 13:00 dan 18:00) di Zepp DiverCity, Tokyo.",
      tiers: [tier("Reserved", 1_150_000, 600), tier("Standing", 950_000, 1_800)],
    },
    {
      title: "Wuthering Waves Concert Tour: To the New World", artist: 5, publisher: "Kuro Games", venue: 5, at: "2027-09-26T20:00:00+08:00", hours: 2.5, sell: 0.18,
      tags: ["WutheringWaves", "Orchestra"],
      description: "Tur konser resmi Wuthering Waves. Aslinya 26 September 2026 di Esplanade Theatre, Singapura.",
      tiers: [tier("Cat 1", 2_100_000, 400), tier("Cat 2", 1_550_000, 700), tier("Cat 3", 1_050_000, 700)],
    },
    {
      title: "World of Warcraft: 20 Years of Music", artist: 6, publisher: "Blizzard Entertainment", venue: 6, at: "2027-10-25T19:30:00+01:00", hours: 2.5, sell: 0.08,
      tags: ["WorldOfWarcraft", "Orchestra"],
      description: "Tur konser dunia resmi 20 tahun musik World of Warcraft. Aslinya 25 Oktober 2026 di Royal Albert Hall, London.",
      tiers: [tier("Stalls", 2_000_000, 1_000), tier("Circle", 1_450_000, 2_000), tier("Gallery", 900_000, 1_500)],
    },
  ];

  const insertedEvents = await db
    .insert(events)
    .values(eventSeed.map((e, i) => ({
      title: e.title,
      artistId: insertedArtists[e.artist]!.id,
      publisherName: e.publisher,
      venueId: insertedVenues[e.venue]!.id,
      dateTime: new Date(e.at),
      endDateTime: new Date(new Date(e.at).getTime() + e.hours * 3_600_000),
      description: e.description,
      tags: e.tags,
      maxTicketsPerOrder: 4,
      sortOrder: i,
      // Past events stop selling; the last one is a draft not yet on sale.
      status: new Date(e.at).getTime() < NOW || e.closed ? ("closed" as const) : ("open" as const),
      createdBy: adminBudi.id,
      createdAt: new Date(NOW - int(95, 120) * DAY),
    })))
    .returning();
  console.log(`  ${insertedEvents.length} events created`);

  // 5. Ticket categories (quotaRemaining is fixed up after orders are generated)
  const categoryRows = eventSeed.flatMap((e, ei) =>
    e.tiers.map((t, ti) => ({
      eventId: insertedEvents[ei]!.id,
      name: t.name,
      price: t.price.toFixed(2),
      quotaTotal: t.quota,
      quotaRemaining: t.quota,
      benefits: t.benefits,
      sortOrder: ti,
    }))
  );
  const insertedCategories = await db.insert(ticketCategories).values(categoryRows).returning();
  console.log(`  ${insertedCategories.length} ticket categories created`);

  // 6. Customers — the three demo logins first, then generated ones.
  const customerPassword = await Bun.password.hash("customer123");
  const customerRows = [
    { name: "Sari Dewi", email: "sari@example.com" },
    { name: "Andi Pratama", email: "andi@example.com" },
    { name: "Rina Kartika", email: "rina@example.com" },
  ];
  const usedEmails = new Set(customerRows.map((c) => c.email));
  while (customerRows.length < 150) {
    const first = pick(FIRST);
    const last = pick(LAST);
    const email = `${first}.${last}${int(1, 99)}@${pick(["gmail.com", "yahoo.co.id", "outlook.com"])}`.toLowerCase();
    if (usedEmails.has(email)) continue;
    usedEmails.add(email);
    customerRows.push({ name: `${first} ${last}`, email });
  }
  const insertedCustomers = await db
    .insert(customers)
    .values(customerRows.map((c) => ({
      ...c,
      passwordHash: customerPassword,
      createdAt: new Date(NOW - int(0, 120) * DAY - int(0, DAY)),
    })))
    .returning();
  console.log(`  ${insertedCustomers.length} customers created (password: customer123)`);

  // 7. Vouchers
  const insertedVouchers = await db
    .insert(vouchers)
    .values([
      { code: "GGTIX2026", name: "Promo Grand Launching GG-Tix", description: "Diskon 20% maksimal Rp 100.000 untuk seluruh konser.", discountType: "percentage" as const, discountValue: "20.00", maxDiscountAmount: "100000.00", minOrderAmount: "150000.00", quotaTotal: 150, quotaRemaining: 150, maxUsagePerCustomer: 1, startDate: new Date(NOW - 90 * DAY), endDate: new Date(NOW + 60 * DAY) },
      { code: "EARLYBIRD", name: "Potongan Early Bird", description: "Potongan flat Rp 50.000 untuk semua kategori.", discountType: "fixed" as const, discountValue: "50000.00", maxDiscountAmount: null, minOrderAmount: "100000.00", quotaTotal: 80, quotaRemaining: 80, maxUsagePerCustomer: 2, startDate: new Date(NOW - 90 * DAY), endDate: new Date(NOW + 30 * DAY) },
      { code: "GAMERPASS", name: "Diskon Komunitas Gamer", description: "Diskon 10% khusus member komunitas.", discountType: "percentage" as const, discountValue: "10.00", maxDiscountAmount: "50000.00", minOrderAmount: "50000.00", quotaTotal: 200, quotaRemaining: 200, maxUsagePerCustomer: 1, startDate: new Date(NOW - 60 * DAY), endDate: new Date(NOW + 90 * DAY) },
      { code: "WUWALIVE", name: "Spesial Wuthering Waves Concert", description: "Potongan Rp 75.000 khusus Wuthering Waves Concert Tour.", discountType: "fixed" as const, discountValue: "75000.00", maxDiscountAmount: null, minOrderAmount: "250000.00", quotaTotal: 60, quotaRemaining: 60, maxUsagePerCustomer: 1, eventId: insertedEvents[5]!.id, startDate: new Date(NOW - 45 * DAY), endDate: new Date(NOW + 60 * DAY) },
      { code: "TEYVAT15", name: "Flash Sale HoYoFair Fan Concert", description: "Diskon 15% — sudah berakhir.", discountType: "percentage" as const, discountValue: "15.00", maxDiscountAmount: "150000.00", minOrderAmount: "300000.00", quotaTotal: 40, quotaRemaining: 40, maxUsagePerCustomer: 1, eventId: insertedEvents[0]!.id, startDate: new Date(NOW - 88 * DAY), endDate: new Date(NOW - 70 * DAY) },
      { code: "NATAL2026", name: "Promo Akhir Tahun", description: "Dijadwalkan untuk musim liburan.", discountType: "percentage" as const, discountValue: "12.00", maxDiscountAmount: "120000.00", minOrderAmount: "200000.00", quotaTotal: 100, quotaRemaining: 100, maxUsagePerCustomer: 1, startDate: new Date(NOW + 40 * DAY), endDate: new Date(NOW + 75 * DAY) },
      { code: "BETATEST", name: "Uji Coba Internal", description: "Voucher nonaktif untuk QA.", discountType: "fixed" as const, discountValue: "25000.00", maxDiscountAmount: null, minOrderAmount: "0.00", quotaTotal: 10, quotaRemaining: 10, maxUsagePerCustomer: 1, isActive: false, startDate: new Date(NOW - 30 * DAY), endDate: new Date(NOW + 30 * DAY) },
    ].map((v) => ({ ...v, createdBy: adminBudi.id })))
    .returning();
  console.log(`  ${insertedVouchers.length} vouchers created`);

  // 8. Orders — spread over each event's sales window (max 90 days back).
  type OrderRow = typeof orders.$inferInsert & { id: string; createdAt: Date };
  const orderRows: OrderRow[] = [];
  const usageRows: (typeof voucherUsages.$inferInsert)[] = [];
  const ticketRows: (typeof tickets.$inferInsert)[] = [];
  const proofRows: (typeof paymentProofs.$inferInsert)[] = [];
  const soldByCategory = new Map<string, number>();
  const usedByVoucher = new Map<string, number>();
  const usedByCustomerVoucher = new Map<string, number>();

  eventSeed.forEach((e, ei) => {
    if (!e.sell) return;
    const event = insertedEvents[ei]!;
    const eventTime = event.dateTime.getTime();
    const windowEnd = Math.min(NOW - 10 * 60_000, eventTime - 2 * 3_600_000);
    // Far-off events opened sales recently; never let the window start after it ends.
    const windowStart = Math.min(Math.max(NOW - 90 * DAY, eventTime - 80 * DAY), windowEnd - 14 * DAY);
    const cats = insertedCategories.filter((c) => c.eventId === event.id);

    for (const cat of cats) {
      // Demo scale: sell a fraction of the quota through ~quantity-2.3 orders.
      const target = Math.round(cat.quotaTotal * e.sell * 0.35);
      let sold = 0;
      while (sold < target) {
        const quantity = Math.min(int(1, 4), cat.quotaTotal - sold);
        // Bias purchases towards the end of the window (sales ramp before shows).
        const createdAt = new Date(windowStart + (windowEnd - windowStart) * Math.sqrt(rand()));
        const customer = pick(insertedCustomers);
        const recent = NOW - createdAt.getTime() < 15 * 60_000;
        const roll = rand();
        const status: "verified" | "pending" | "rejected" | "expired" =
          recent ? "pending" : roll < 0.84 ? "verified" : roll < 0.95 ? "expired" : "rejected";

        const subtotal = Number(cat.price) * quantity;
        let discount = 0;
        let voucher: (typeof insertedVouchers)[number] | undefined;
        if (chance(0.18)) {
          const candidate = pick(insertedVouchers);
          const key = `${candidate.id}:${customer.id}`;
          const valid = candidate.isActive
            && candidate.startDate.getTime() <= createdAt.getTime()
            && candidate.endDate.getTime() >= createdAt.getTime()
            && (!candidate.eventId || candidate.eventId === event.id)
            && subtotal >= Number(candidate.minOrderAmount)
            && (usedByVoucher.get(candidate.id) ?? 0) < candidate.quotaTotal
            && (usedByCustomerVoucher.get(key) ?? 0) < candidate.maxUsagePerCustomer;
          if (valid) {
            voucher = candidate;
            const raw = candidate.discountType === "percentage"
              ? subtotal * Number(candidate.discountValue) / 100
              : Number(candidate.discountValue);
            discount = Math.min(subtotal, candidate.maxDiscountAmount ? Math.min(raw, Number(candidate.maxDiscountAmount)) : raw);
          }
        }

        const id = crypto.randomUUID();
        const verifiedAt = status === "verified" || status === "rejected"
          ? new Date(createdAt.getTime() + int(1, 12) * 60_000)
          : null;
        orderRows.push({
          id,
          customerId: customer.id,
          eventId: event.id,
          categoryId: cat.id,
          quantity,
          subtotalPrice: subtotal.toFixed(2),
          discountAmount: discount.toFixed(2),
          totalPrice: (subtotal - discount).toFixed(2),
          voucherId: voucher?.id ?? null,
          voucherCode: voucher?.code ?? null,
          status,
          createdAt,
          verifiedAt,
          verifiedBy: verifiedAt ? pick(verifiers).id : null,
        });

        // Only live orders hold quota and vouchers; failed ones release them.
        if (status === "verified" || status === "pending") {
          sold += quantity;
          if (voucher) {
            const key = `${voucher.id}:${customer.id}`;
            usedByVoucher.set(voucher.id, (usedByVoucher.get(voucher.id) ?? 0) + 1);
            usedByCustomerVoucher.set(key, (usedByCustomerVoucher.get(key) ?? 0) + 1);
            usageRows.push({ voucherId: voucher.id, customerId: customer.id, orderId: id, discountApplied: discount.toFixed(2), createdAt });
          }
        }

        proofRows.push({
          orderId: id,
          paymentType: pick(PAYMENT_TYPES),
          transactionStatus: status === "verified" ? "settlement" : status === "rejected" ? "deny" : status === "expired" ? "expire" : "pending",
          midtransTransactionId: `midtrans-demo-${id.slice(0, 8)}`,
          paidAt: status === "verified" ? verifiedAt : null,
          uploadedAt: createdAt,
        });

        if (status === "verified") {
          const attended = eventTime < NOW;
          for (let i = 0; i < quantity; i++) {
            const checkedIn = attended && chance(0.88);
            ticketRows.push({
              orderId: id,
              qrCodeValue: `tix_${crypto.randomUUID()}`,
              checkedIn,
              checkedInAt: checkedIn ? new Date(eventTime - int(-60, 90) * 60_000) : null,
            });
          }
        }
      }
      soldByCategory.set(cat.id, sold);
    }
  });

  const chunk = <T>(rows: T[], size = 500) =>
    Array.from({ length: Math.ceil(rows.length / size) }, (_, i) => rows.slice(i * size, (i + 1) * size));

  for (const rows of chunk(orderRows)) await db.insert(orders).values(rows);
  for (const rows of chunk(proofRows)) await db.insert(paymentProofs).values(rows);
  for (const rows of chunk(ticketRows)) await db.insert(tickets).values(rows);
  for (const rows of chunk(usageRows)) await db.insert(voucherUsages).values(rows);

  // Derive remaining quotas from what was actually sold.
  for (const cat of insertedCategories) {
    const sold = soldByCategory.get(cat.id) ?? 0;
    if (sold) await db.update(ticketCategories).set({ quotaRemaining: cat.quotaTotal - sold }).where(sql`${ticketCategories.id} = ${cat.id}`);
  }
  for (const v of insertedVouchers) {
    const used = usedByVoucher.get(v.id) ?? 0;
    if (used) await db.update(vouchers).set({ quotaRemaining: v.quotaTotal - used }).where(sql`${vouchers.id} = ${v.id}`);
  }

  const count = (s: string) => orderRows.filter((o) => o.status === s).length;
  console.log(`  ${orderRows.length} orders created (${count("verified")} verified, ${count("pending")} pending, ${count("expired")} expired, ${count("rejected")} rejected)`);
  console.log(`  ${ticketRows.length} tickets, ${proofRows.length} payment proofs, ${usageRows.length} voucher usages`);

  console.log("\nSeed complete!");
  console.log("\nLogin credentials (password admin123 / customer123):");
  console.log("   Super admin: budi@ggtix.com, artdi@ggtix.com");
  console.log("   Admin:       maya@ggtix.com, reza@ggtix.com");
  console.log("   Gate staff:  siti@ggtix.com, galih@ggtix.com");
  console.log("   Customer:    sari@example.com, andi@example.com, rina@example.com");
}

seed()
  .catch((err) => {
    console.error("Seed failed:", err);
    process.exit(1);
  })
  .finally(async () => {
    await client.end();
  });
