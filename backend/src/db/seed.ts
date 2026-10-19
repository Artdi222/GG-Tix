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

/** A date `days` from today at the given WIB wall-clock time. */
function wib(days: number, time = "19:00") {
  const d = new Date(NOW + days * DAY + 7 * 3_600_000); // shift to WIB calendar day
  const ymd = d.toISOString().slice(0, 10);
  return new Date(`${ymd}T${time}:00+07:00`);
}

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

  // 2. Venues
  const insertedVenues = await db
    .insert(venues)
    .values([
      { name: "Gelora Bung Karno", address: "Jl. Pintu Satu Senayan, Gelora, Tanah Abang, Jakarta Pusat, DKI Jakarta 10270", city: "Jakarta", sortOrder: 0 },
      { name: "Istora Senayan", address: "Kompleks GBK, Jl. Pintu Satu Senayan, Tanah Abang, Jakarta Pusat, DKI Jakarta 10270", city: "Jakarta", sortOrder: 1 },
      { name: "ICE BSD City", address: "Jl. BSD Grand Boulevard No.1, Pagedangan, Kabupaten Tangerang, Banten 15339", city: "Tangerang", sortOrder: 2 },
      { name: "Trans Convention Center", address: "Jl. Gatot Subroto No.289, Cibangkong, Batununggal, Kota Bandung, Jawa Barat 40273", city: "Bandung", sortOrder: 3 },
      { name: "Surabaya Convention Hall", address: "Jl. Arief Rachman Hakim No.131, Klampis Ngasem, Sukolilo, Kota Surabaya, Jawa Timur 60117", city: "Surabaya", sortOrder: 4 },
      { name: "Jogja Expo Center", address: "Jl. Raya Janti, Wonocatur, Banguntapan, Bantul, DI Yogyakarta 55198", city: "Yogyakarta", sortOrder: 5 },
      { name: "Santika Premiere Ballroom", address: "Jl. Pandanaran No.116, Mugassari, Semarang Selatan, Kota Semarang, Jawa Tengah 50249", city: "Semarang", sortOrder: 6 },
      { name: "Bali Nusa Dua Convention Center", address: "Kawasan Pariwisata Nusa Dua Lot NW/1, Benoa, Kuta Selatan, Badung, Bali 80363", city: "Bali", sortOrder: 7 },
    ])
    .returning();
  console.log(`  ${insertedVenues.length} venues created`);

  // 3. Artists
  const artistSeed = [
    ["Rover Ensemble", "Orkestra yang membawakan soundtrack epik Wuthering Waves — string megah, tema pertarungan, dan melodi Solaris."],
    ["Stellar Astral", "Grup pop kosmik bernuansa Astral Express: synth neon, harmoni selestial, dan energi konser yang meledak."],
    ["Liyue Philharmonic", "Instrumen tradisional bertemu orkestrasi modern — aransemen Genshin Impact yang legendaris."],
    ["Rhodes Island Band", "Industrial rock dan elektronik khas Arknights dengan beat menghentak dan vokal operatik."],
    ["New Eridu DJ Crew", "Kolektif DJ yang memutar beat urban Zenless Zone Zero: bass drop, breakbeat, dan panggung neon."],
    ["Kivotos Strings", "Kuartet gesek yang menghadirkan musik Blue Archive dengan sentuhan pop ceria."],
    ["Persona Jazz Unit", "Big band jazz-funk yang membawakan acid jazz ikonik dari seri Persona."],
    ["Hyrule Symphony", "Orkestra simfoni yang menghidupkan musik petualangan klasik dari dunia fantasi."],
  ] as const;
  const insertedArtists = await db
    .insert(artists)
    .values(artistSeed.map(([name, bio]) => ({ name, bio })))
    .returning();
  console.log(`  ${insertedArtists.length} artists created`);

  // 4. Events — offsets relative to today; sell-through drives order volume.
  type Tier = { name: string; price: number; quota: number; benefits: string[] };
  const T = {
    vvip: (price: number, quota: number): Tier => ({ name: "VVIP", price, quota, benefits: ["Kursi baris 1–5", "Poster bertanda tangan", "Merchandise eksklusif"] }),
    vip: (price: number, quota: number): Tier => ({ name: "VIP", price, quota, benefits: ["Kursi baris 6–15", "Lanyard & badge", "Jalur masuk prioritas"] }),
    cat1: (price: number, quota: number): Tier => ({ name: "CAT 1", price, quota, benefits: ["Tribun tengah"] }),
    reg: (price: number, quota: number): Tier => ({ name: "Reguler", price, quota, benefits: ["Tiket masuk standar"] }),
    fest: (price: number, quota: number): Tier => ({ name: "Festival", price, quota, benefits: ["Area berdiri depan panggung"] }),
  };
  const eventSeed = [
    { title: "Genshin Impact: Melodies of Teyvat", artist: 2, publisher: "HoYoverse", venue: 0, day: -62, time: "19:00", sell: 0.97, tags: ["GenshinImpact", "Orchestra"], tiers: [T.vvip(2_000_000, 60), T.vip(950_000, 180), T.cat1(550_000, 400), T.reg(300_000, 700)] },
    { title: "Persona Live: Take Your Time", artist: 6, publisher: "Atlus", venue: 3, day: -34, time: "19:30", sell: 0.88, tags: ["Persona", "Jazz"], tiers: [T.vip(800_000, 120), T.reg(350_000, 450)] },
    { title: "Arknights: Contingency Stage", artist: 3, publisher: "Hypergryph", venue: 4, day: -12, time: "20:00", sell: 0.79, tags: ["Arknights", "Rock"], tiers: [T.vip(650_000, 120), T.fest(300_000, 500)] },
    { title: "Blue Archive: Kivotos Festival", artist: 5, publisher: "Nexon Games", venue: 2, day: 2, time: "16:00", sell: 0.84, tags: ["BlueArchive", "Pop"], tiers: [T.vip(750_000, 150), T.cat1(450_000, 300), T.reg(250_000, 600)] },
    { title: "Wuthering Waves Live 2026", artist: 0, publisher: "Kuro Games", venue: 0, day: 9, time: "19:00", sell: 0.72, tags: ["WutheringWaves", "Orchestra"], tiers: [T.vvip(1_800_000, 50), T.vip(850_000, 200), T.cat1(500_000, 450), T.reg(275_000, 800)] },
    { title: "Honkai: Star Rail — Astral Concert", artist: 1, publisher: "HoYoverse", venue: 1, day: 20, time: "18:30", sell: 0.58, tags: ["HSR", "SynthPop"], tiers: [T.vip(800_000, 150), T.reg(325_000, 650)] },
    { title: "Zenless Zone Zero: NEON NIGHT", artist: 4, publisher: "HoYoverse", venue: 5, day: 33, time: "20:00", sell: 0.41, tags: ["ZZZ", "Electronic"], tiers: [T.vip(700_000, 100), T.fest(275_000, 600)] },
    { title: "Hyrule Symphony: Echoes of Wisdom", artist: 7, publisher: "Nintendo", venue: 6, day: 47, time: "19:00", sell: 0.29, tags: ["Symphony", "Fantasy"], tiers: [T.vip(900_000, 80), T.reg(400_000, 350)] },
    { title: "Genshin Impact: Natlan Night", artist: 2, publisher: "HoYoverse", venue: 7, day: 61, time: "19:30", sell: 0.22, tags: ["GenshinImpact", "Bali"], tiers: [T.vvip(2_200_000, 40), T.vip(1_000_000, 120), T.reg(400_000, 400)] },
    { title: "Arknights: Rhodes Island Tour Jogja", artist: 3, publisher: "Hypergryph", venue: 5, day: 78, time: "19:00", sell: 0.12, tags: ["Arknights", "Tour"], tiers: [T.vip(600_000, 80), T.fest(250_000, 400)] },
    { title: "Wuthering Waves: Resonator's Encore", artist: 0, publisher: "Kuro Games", venue: 7, day: 110, time: "19:30", sell: 0.05, tags: ["WutheringWaves", "Encore"], tiers: [T.vip(850_000, 60), T.reg(300_000, 300)] },
    { title: "Stellar Astral: Countdown Party", artist: 1, publisher: "HoYoverse", venue: 2, day: 140, time: "21:00", sell: 0, closed: true, tags: ["HSR", "NewYear"], tiers: [T.vip(900_000, 100), T.fest(350_000, 700)] },
  ];

  const insertedEvents = await db
    .insert(events)
    .values(eventSeed.map((e, i) => ({
      title: e.title,
      artistId: insertedArtists[e.artist]!.id,
      publisherName: e.publisher,
      venueId: insertedVenues[e.venue]!.id,
      dateTime: wib(e.day, e.time),
      endDateTime: new Date(wib(e.day, e.time).getTime() + 3 * 3_600_000),
      description: `${e.title} — konser musik game bersama ${artistSeed[e.artist]![0]} di ${insertedVenues[e.venue]!.name}.`,
      tags: e.tags,
      maxTicketsPerOrder: 4,
      sortOrder: i,
      // Past events stop selling; the last one is a draft not yet on sale.
      status: e.day < 0 || e.closed ? ("closed" as const) : ("open" as const),
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
      { code: "WUWALIVE", name: "Spesial Wuthering Waves Live", description: "Potongan Rp 75.000 khusus Wuthering Waves Live 2026.", discountType: "fixed" as const, discountValue: "75000.00", maxDiscountAmount: null, minOrderAmount: "250000.00", quotaTotal: 60, quotaRemaining: 60, maxUsagePerCustomer: 1, eventId: insertedEvents[4]!.id, startDate: new Date(NOW - 45 * DAY), endDate: wib(9, "12:00") },
      { code: "TEYVAT15", name: "Flash Sale Melodies of Teyvat", description: "Diskon 15% — sudah berakhir.", discountType: "percentage" as const, discountValue: "15.00", maxDiscountAmount: "150000.00", minOrderAmount: "300000.00", quotaTotal: 40, quotaRemaining: 40, maxUsagePerCustomer: 1, eventId: insertedEvents[0]!.id, startDate: new Date(NOW - 88 * DAY), endDate: new Date(NOW - 70 * DAY) },
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
