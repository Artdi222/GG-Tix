**PRD - GG Tix - Digital Ticket Generation & QR Check-In System**
**GGT-05 - Sistem Tiket Digital, Generasi QR Code, & Scanner Check-In Venue**

| MODUL | PERSONA | PLATFORM | PRIORITAS | STATUS |
| --- | --- | --- | --- | --- |
| **Backend API + Frontend Dashboard** | **Super Admin, Staff, Customer** | **REST API (Hono + Bun) + Nuxt Frontend** | **Phase 3** | **Draft** |

**DACI Framework**

| **Driver** | Engineering Team |
| --- | --- |
| **Approver** | Product Owner |
| **Contributor** | Backend Developer, Frontend Developer |
| **Informed** | QA, Mobile Developer |

---

## Background Context

GG Tix sudah menyelesaikan Phase 1 (Foundation) dan Phase 2 (Analytics, Storage & Schema Enrichment). Saat ini tabel `tickets` sudah ada di database schema dengan kolom `id`, `order_id`, `qr_code_value` (unique), dan `checked_in` (boolean). Namun:

1. **Tidak ada logic pembuatan tiket** — Saat admin memverifikasi order (`PATCH /orders/:id/verify → verified`), tidak ada record `tickets` yang dibuat. Tabel kosong.
2. **Tidak ada endpoint tiket** — Tidak ada API untuk mengambil tiket milik suatu order (`GET /tickets/order/:orderId`) atau melakukan check-in (`POST /tickets/check-in`).
3. **Halaman scanner kosong** — Halaman `/scanner` di admin dashboard hanya berisi placeholder text *"Fitur scanner QR sedang dalam pengembangan"*.
4. **Tidak ada QR code** — Tidak ada mekanisme generasi gambar QR code dari `qr_code_value`.

**Dampak**: Flow end-to-end tiket konser terputus. Customer yang order-nya sudah verified tidak mendapatkan e-ticket. Staff di venue tidak bisa memvalidasi tiket di pintu masuk.

---

## Problem Definition

**Apa masalah yang dituju?**
Setelah order diverifikasi, tidak ada tiket digital yang diterbitkan dan tidak ada mekanisme check-in di venue konser.

**Siapa yang terdampak?**
- **Customer**: Tidak mendapatkan e-ticket dengan QR code setelah pembayaran terverifikasi. **Kritis**.
- **Staff**: Tidak bisa memvalidasi tiket di pintu masuk venue. **Kritis**.
- **Super Admin**: Tidak bisa monitor berapa pengunjung yang sudah check-in. **Tinggi**.

**Jobs To Be Done**
- *"Sebagai customer, setelah order saya diverifikasi, saya ingin menerima tiket digital dengan QR code unik yang bisa saya tunjukkan di pintu masuk konser."*
- *"Sebagai staff di venue, saya ingin scan QR code tiket di pintu masuk dan langsung tahu apakah tiket valid, sudah dipakai, atau palsu."*
- *"Sebagai admin, saya ingin melihat berapa pengunjung yang sudah check-in secara real-time di hari H konser."*

---

## Scope of Work

### TIK-01 — Auto-Generate Tiket Saat Order Verified

**Trigger**: Setiap kali status order berubah menjadi `verified` (baik dari manual admin verify maupun nanti dari webhook Midtrans di GGT-06).

**Logic**:
1. Dalam transaksi yang sama saat `orders.status` di-update ke `verified`:
2. Generate `N` record di tabel `tickets` sesuai `orders.quantity`.
3. Setiap tiket mendapat `qr_code_value` unik berformat: `tix_<uuid-v4>` (contoh: `tix_a3f8b2c1-4d6e-4f7a-8b9c-0d1e2f3a4b5c`).
4. Semua tiket default `checked_in = false`.

**Validasi**:
- Jika order sudah punya tiket (idempotent), jangan generate ulang.
- Jika order bukan `verified`, jangan generate tiket.

**File yang diubah**:
- `backend/src/repositories/order.repository.ts` — Tambah logic insert `tickets` dalam `verifyOrder()` transaction.

---

### TIK-02 — Backend: Endpoint Get Tiket per Order

**Endpoint**: `GET /api/tickets/order/:orderId`

**Auth**: 🟣 Customer (hanya bisa akses tiket order milik sendiri) atau 🔵 Admin.

**Response** (200):
```jsonc
{
  "data": {
    "order": {
      "id": "uuid",
      "eventTitle": "Wuthering Waves Live 2026",
      "eventDate": "2026-10-12T19:00:00.000Z",
      "venueName": "Gelora Bung Karno",
      "categoryName": "VIP",
      "quantity": 2,
      "status": "verified"
    },
    "tickets": [
      {
        "id": "uuid",
        "qrCodeValue": "tix_a3f8b2c1-4d6e-4f7a-8b9c-0d1e2f3a4b5c",
        "qrCodeDataUrl": "data:image/svg+xml;base64,PHN2ZyB...",
        "checkedIn": false,
        "checkedInAt": null
      },
      {
        "id": "uuid",
        "qrCodeValue": "tix_d4e5f6a7-8b9c-0d1e-2f3a-4b5c6d7e8f9a",
        "qrCodeDataUrl": "data:image/svg+xml;base64,PHN2ZyB...",
        "checkedIn": false,
        "checkedInAt": null
      }
    ]
  }
}
```

**Catatan**:
- `qrCodeDataUrl` di-generate on-the-fly oleh backend menggunakan library `qrcode` (SVG mode) dari nilai `qrCodeValue`.
- Jika order belum `verified` atau tidak ditemukan, return `404`.

**File baru**:
- `backend/src/routes/tickets.ts`
- `backend/src/services/ticket.service.ts`
- `backend/src/repositories/ticket.repository.ts`

---

### TIK-03 — Backend: Endpoint Check-In Tiket

**Endpoint**: `POST /api/tickets/check-in`

**Auth**: 🔵 Admin (Staff atau Super Admin).

**Request Body**:
```jsonc
{
  "qrCodeValue": "tix_a3f8b2c1-4d6e-4f7a-8b9c-0d1e2f3a4b5c",
  "eventId": "uuid"   // wajib — untuk validasi tiket hanya di event yang dipilih
}
```

**Response Sukses** (200):
```jsonc
{
  "data": {
    "status": "SUCCESS",
    "ticket": {
      "id": "uuid",
      "qrCodeValue": "tix_...",
      "checkedIn": true,
      "checkedInAt": "2026-10-12T18:45:00.000Z"
    },
    "order": {
      "customerName": "Sari Dewi",
      "categoryName": "VIP",
      "quantity": 2
    },
    "event": {
      "title": "Wuthering Waves Live 2026"
    }
  }
}
```

**Response Gagal**:
| Kondisi | Status | Response |
| --- | --- | --- |
| QR code tidak ditemukan | 404 | `{ "error": "TICKET_NOT_FOUND", "message": "QR code tidak dikenali" }` |
| Tiket bukan milik event yang dipilih | 403 | `{ "error": "WRONG_EVENT", "message": "Tiket ini bukan untuk event yang dipilih" }` |
| Tiket sudah pernah check-in | 409 | `{ "error": "ALREADY_CHECKED_IN", "message": "Tiket sudah digunakan", "checkedInAt": "2026-10-12T18:30:00.000Z" }` |

**Logic Backend**:
1. Cari tiket berdasarkan `qrCodeValue`.
2. Join ke `orders` → `events` untuk validasi `eventId` cocok.
3. Validasi `checkedIn === false`.
4. Set `checkedIn = true` dan tambah field `checkedInAt = now()` (perlu migration: tambah kolom `checked_in_at` timestamp nullable di tabel `tickets`).
5. Return data tiket + nama customer + info event.

---

### TIK-04 — Backend: Endpoint Check-In Statistics

**Endpoint**: `GET /api/tickets/stats/:eventId`

**Auth**: 🔵 Admin.

**Response** (200):
```jsonc
{
  "data": {
    "eventId": "uuid",
    "eventTitle": "Wuthering Waves Live 2026",
    "totalTickets": 500,
    "checkedIn": 342,
    "remaining": 158,
    "checkedInPct": 68.4,
    "byCategory": [
      {
        "categoryName": "VVIP",
        "total": 50,
        "checkedIn": 48,
        "remaining": 2,
        "checkedInPct": 96.0
      },
      {
        "categoryName": "VIP",
        "total": 150,
        "checkedIn": 120,
        "remaining": 30,
        "checkedInPct": 80.0
      },
      {
        "categoryName": "Reguler",
        "total": 300,
        "checkedIn": 174,
        "remaining": 126,
        "checkedInPct": 58.0
      }
    ]
  }
}
```

---

### TIK-05 — Schema Migration: Tambah `checked_in_at` di Tabel `tickets`

**Perubahan schema**:
```sql
ALTER TABLE tickets ADD COLUMN checked_in_at TIMESTAMP;
```

**Drizzle schema update** di `backend/src/db/schema.ts`:
```typescript
export const tickets = pgTable("tickets", {
  id: uuid("id").defaultRandom().primaryKey(),
  orderId: uuid("order_id")
    .notNull()
    .references(() => orders.id, { onDelete: "cascade" }),
  qrCodeValue: varchar("qr_code_value", { length: 255 }).notNull().unique(),
  checkedIn: boolean("checked_in").notNull().default(false),
  checkedInAt: timestamp("checked_in_at"),  // NEW
});
```

---

### TIK-06 — Frontend: Halaman Scanner QR Check-In (`/scanner`)

**Menggantikan** placeholder saat ini di `frontend/app/pages/scanner/index.vue`.

**Layout & Flow Halaman**:

1. **Header**: "Scanner QR Check-In" dengan badge jumlah event yang sedang berlangsung.

2. **Step 1 — Pilih Event**:
   - Dropdown / searchable select berisi daftar event yang statusnya `open` atau yang tanggalnya hari ini / mendatang.
   - Setelah event dipilih, tampilkan info singkat: nama event, tanggal, venue.

3. **Step 2 — Scanner Aktif**:
   - Area kamera scanner menggunakan **html5-qrcode** library (integrasi via `onMounted` dan `onBeforeUnmount`).
   - Tombol switch kamera (depan/belakang) jika device punya multiple camera.
   - Di bawah scanner: **input manual** (text field + tombol "Cek") sebagai fallback jika kamera tidak tersedia atau QR rusak.

4. **Step 3 — Hasil Scan** (overlay/flash):
   - **Sukses** ✅: Flash layar hijau selama 2 detik + sound effect "ding" + tampilkan nama customer, kategori tiket, tiket ke-berapa dari total quantity.
   - **Sudah Dipakai** ⚠️: Flash layar kuning/oranye + sound effect "buzz" + tampilkan "Tiket sudah digunakan pada [waktu]".
   - **Error** ❌: Flash layar merah + sound effect "buzz" + tampilkan pesan error (QR tidak dikenali / event salah).
   - Setelah 2-3 detik, auto-reset ke scanner untuk scan tiket berikutnya.

5. **Sidebar / Panel Bawah — Live Stats**:
   - Counter real-time: **"Checked-in: 342 / 500 (68.4%)"**
   - Progress bar per kategori tiket (VVIP, VIP, Reguler) dengan warna berbeda.
   - Auto-refresh stats setelah setiap scan berhasil.
   - Log 10 scan terakhir (nama, kategori, waktu check-in).

**Dependency Frontend**:
- Install `html5-qrcode` package di frontend.

---

### TIK-07 — Backend: Dependencies & Library

**Package baru di backend**:
- `qrcode` (npm) — untuk generate QR code SVG/PNG dari string `qrCodeValue`.

**Instalasi**: `bun add qrcode @types/qrcode`

**Usage di ticket.service.ts**:
```typescript
import QRCode from 'qrcode';

async function generateQrDataUrl(value: string): Promise<string> {
  return await QRCode.toDataURL(value, {
    type: 'image/png',
    width: 400,
    margin: 2,
    color: { dark: '#000000', light: '#FFFFFF' },
  });
}
```

---

## Endpoint Summary (GGT-05)

| Method | Path | Auth | Deskripsi |
| --- | --- | --- | --- |
| GET | `/api/tickets/order/:orderId` | Customer / Admin | List tiket QR per order (dengan QR data URL) |
| POST | `/api/tickets/check-in` | Admin (Staff) | Validasi & mark check-in tiket di venue |
| GET | `/api/tickets/stats/:eventId` | Admin | Statistik check-in per event (total & per kategori) |

---

## Verification Plan

### Automated Tests
```bash
# Test auto-generate tiket saat verify order
curl -X PATCH http://localhost:3000/api/orders/<orderId>/verify \
  -H "Authorization: Bearer <adminToken>" \
  -H "Content-Type: application/json" \
  -d '{"decision": "verified"}'
# Kemudian cek tiket muncul:
curl http://localhost:3000/api/tickets/order/<orderId> \
  -H "Authorization: Bearer <adminToken>"

# Test check-in
curl -X POST http://localhost:3000/api/tickets/check-in \
  -H "Authorization: Bearer <staffToken>" \
  -H "Content-Type: application/json" \
  -d '{"qrCodeValue": "tix_<uuid>", "eventId": "<eventId>"}'

# Test double check-in (harus 409)
curl -X POST http://localhost:3000/api/tickets/check-in \
  -H "Authorization: Bearer <staffToken>" \
  -H "Content-Type: application/json" \
  -d '{"qrCodeValue": "tix_<uuid>", "eventId": "<eventId>"}'

# Test stats
curl http://localhost:3000/api/tickets/stats/<eventId> \
  -H "Authorization: Bearer <adminToken>"
```

### Manual Verification
1. Verify order dari dashboard → cek di database bahwa tiket ter-generate.
2. Buka `/scanner` → pilih event → scan QR code (dari response tiket) → pastikan flash hijau + sound.
3. Scan QR yang sama lagi → pastikan flash kuning + pesan "sudah digunakan".
4. Cek live counter naik setelah scan sukses.

---

## Acceptance Criteria

- [ ] Order yang diverifikasi otomatis membuat N record tiket sesuai quantity
- [ ] Tiket tidak di-generate ulang jika order sudah punya tiket (idempotent)
- [ ] `GET /tickets/order/:orderId` mengembalikan tiket dengan QR data URL
- [ ] Customer hanya bisa akses tiket order milik sendiri
- [ ] `POST /tickets/check-in` memvalidasi tiket, event scope, dan status checked_in
- [ ] Double check-in menghasilkan error 409 dengan info waktu check-in sebelumnya
- [ ] `GET /tickets/stats/:eventId` mengembalikan statistik check-in akurat
- [ ] Halaman `/scanner` memiliki kamera scanner QR + input manual fallback
- [ ] Scanner di-scope per event (pilih event dulu)
- [ ] Feedback scan: audio (ding/buzz) + visual flash (hijau/kuning/merah)
- [ ] Live counter check-in real-time di halaman scanner
- [ ] Kolom `checked_in_at` tersedia di tabel tickets

---

> **Referensi Terkait:**
> - [GG Tix — Dokumen Konsep Lengkap](file:///home/artdi/Projects/GG%20Tix/prd/GG%20Tix%20-%20Dokumen%20Konsep%20Lengkap.md)
> - [Backend API Contract](file:///home/artdi/Projects/GG%20Tix/prd/Backend%20API%20Contract%20-%20Panduan%20Integrasi%20Frontend.md)
> - [GGT-06: Midtrans Payment Gateway](file:///home/artdi/Projects/GG%20Tix/prd/GGT-06%20-%20Midtrans%20Payment%20Gateway%20Integration.md)
