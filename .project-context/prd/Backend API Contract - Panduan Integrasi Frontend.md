# Backend API Contract — Panduan Integrasi Frontend GG Tix

> Dokumen ini menjelaskan **endpoint, bentuk request/response, dan aturan auth** yang tersedia di backend GG Tix (Hono + Bun + PostgreSQL).
> Tujuan: menyamakan pemahaman antara tim frontend dan backend agar tidak ada miskomunikasi (field, nama endpoint, tipe data).

**Base URL**: `http://localhost:3000/api` (dev). Frontend dev di `http://localhost:3001`.
**Semua path di bawah sudah dengan prefix `/api`.**

| Prioritas | Status |
| --- | --- |
| Disusun dari kode backend (authoritative) | ✓ Update: `2026-08-18` (GGT-01 s/d GGT-07) |

---

## 1. Hal Penting yang Sering Salah di Frontend

| Topik | Backend (Kebenaran) | Frontend (Sebelumnya keliru) |
| --- | --- | --- |
| **Nama resource konser** | `Events` → `/api/events` | Memakai `/api/concerts` dan field `name` |
| **Relasi Venue** | `events.venueId` adalah FK UUID ke tabel `venues`. Data venue terisi di nested object `venue: { id, name, city, address, imageUrl }`. | Mengira string `venue` & `city` mandiri di tabel event |
| **Field Tambahan Event** | `description`, `endDateTime`, `maxTicketsPerOrder`, `tags`, `seatmapUrl`, `sortOrder`, `imageUrl` | Hanya membuat form sederhana tanpa seatmap/tags |
| **Benefits Kategori Tiket** | `benefits` (string array) & `sortOrder` (integer) sudah didukung di backend | Mengira benefits belum ada kolom DB |
| **Login admin** | `POST /api/auth/admin/login` | `POST /api/auth/login` |
| **Login customer** | `POST /api/auth/customer/login` | (dipakai admin panel; gunakan admin) |
| **ID** | `uuid` (string) | `number` |
| **Harga / uang** | `numeric` dikirim **sebagai string** (`"500000.00"`) | `number` |
| **Status event** | `"open" | "closed"` | `"on-sale | almost-sold-out | sold-out | draft"` (4 nilai, tidak dipakai backend) |
| **Bentuk daftar (list)** | dibungkus `{ data: [...], pagination: {...} }` | array telanjang |
| **Bentuk login** | dibungkus `data: { token, refreshToken, user }` | mengira langsung token |

---

## 2. Aturan Autentikasi & Format Respon

- **Header auth**: `Authorization: Bearer <accessToken>`
- **Access token**: default berlaku **1 jam** (`JWT_ACCESS_TTL`).
- **Refresh flow** ada: `POST /api/auth/refresh` (body `{ refreshToken }`) → `{ data: { token } }`. Refresh token berlaku **7 hari**.
- **Rate limit**: auth `10 req/15 menit/IP`; order `20 req/15 menit`. Melampaui → `429` + header `Retry-After`.

### Format Respon Sukses (umum)
```jsonc
// Single/list endpoint
{ "data": { ... } }            // single
{ "data": [ ... ], "pagination": { "page": 1, "limit": 10, "totalCount": 5, "totalPages": 1 } }  // list

// Mutasi
{ "message": "Event created successfully", "data": { ... } }
```

### Format Respon Error
```jsonc
{ "error": "Pesan error", "fields": { "title": "Per-field message" } }
```
- `fields` hanya muncul saat validasi (422/400).
- Status: `400` bad request, `401` unauthorized, `403` forbidden/ditolak, `404` not found, `409` conflict, `413` body terlalu besar, `422` validasi, `429` rate limit.

### Aturan akses (role)
- 🟢 **Public** — tanpa token
- 🔵 **Admin** — token admin (`role=admin`, semua admin termasuk staff)
- 🔴 **Super Admin** — token admin dengan `adminRole=super_admin`
- 🟣 **Customer** — token customer

---

## 3. Auth (`/api/auth`)

| Metode | Path | Akses | Body / Query | Respon |
| --- | --- | --- | --- | --- |
| POST | `/auth/admin/login` | 🟢 | `{ email, password }` (password min 6) | 200 `data: { token, refreshToken, user: { id, name, email, role: adminRole } }` |
| POST | `/auth/customer/login` | 🟢 | `{ email, password }` | 200 `data: { token, refreshToken, user: { id, name, email, role: 'customer' } }` |
| POST | `/auth/customer/register` | 🟢 | `{ name, email, password }` (name min 2) | 201 `data: {...}` |
| POST | `/auth/refresh` | 🟢 | `{ refreshToken }` | 200 `data: { token }` |
| GET | `/auth/me` | 🔵/🟣 | — | 200 `data: { id, name, email, role }` |

> Seed creds: admin `budi@ggtix.com / admin123`, `artdi@ggtix.com / admin123`, staff `siti@ggtix.com / admin123`; customer `sari@example.com / customer123` dst.
> Tidak ada endpoint `POST /auth/logout` di backend; logout = buang token & cookie di client.

---

## 4. Events / Konser (`/api/events`)

### Model Event (response)
```jsonc
{
  "id": "uuid",
  "title": "Wuthering Waves Live 2026",
  "artistId": "uuid",
  "publisherName": "Kuro Games",
  "venueId": "uuid",
  "venue": {
    "id": "uuid",
    "name": "Gelora Bung Karno",
    "city": "Jakarta",
    "address": "Jl. Pintu Satu Senayan",
    "imageUrl": "https://.../venue.webp"
  },
  "artist": {
    "id": "uuid",
    "name": "Vanguard Sound",
    "photoUrl": "https://..."
  },
  "dateTime": "2026-10-12T19:00:00.000Z",
  "endDateTime": "2026-10-12T22:00:00.000Z",
  "description": "Konser orkestra game resmi pertama di Indonesia.",
  "maxTicketsPerOrder": 4,
  "tags": ["gaming", "orchestra", "anime"],
  "seatmapUrl": "https://.../seatmap.webp",
  "imageUrl": "https://.../banner.webp",
  "sortOrder": 0,
  "status": "open",     // "open" | "closed"
  "createdBy": "uuid",
  "createdAt": "2026-..."
}
```

| Method | Path | Auth | Body / Query | Respon |
| --- | --- | --- | --- | --- |
| GET | `/events` | 🟢 | Query: `search`, `artistId`, `venueId`, `status open/closed`, `page`, `limit` (default 10, max 100) | `{ data: [...], pagination }` |
| GET | `/events/:id` | 🟢 | Param `:id` (UUID) | `{ data: eventWithDetailsAndCategories }` |
| POST | `/events` | 🔴 | `{ title, artistId, publisherName, venueId, dateTime, endDateTime?, description?, maxTicketsPerOrder?, tags?, seatmapUrl?, imageUrl?, sortOrder?, status? }` | 201 `{ message, data }` |
| PUT | `/events/:id` | 🔴 | Partial dari create body | `{ message, data }` |
| PATCH | `/events/:id/status` | 🔴 | `{ status: "open"|"closed" }` | `{ message, data }` |
| DELETE | `/events/:id` | 🔴 | — | `{ message }` |

---

## 5. Ticket Categories (`/api/events/:eventId/categories`, `/api/categories/:id`)

Model kategori:
```jsonc
{
  "id": "uuid",
  "eventId": "uuid",
  "name": "VIP",
  "price": "750000.00",
  "quotaTotal": 100,
  "quotaRemaining": 67,
  "benefits": ["Early Entry", "Exclusive Merchandise Set", "Lanyard & PVC Card"],
  "sortOrder": 1
}
```

| Method | Path | Auth | Body / Query | Respon |
| --- | --- | --- | --- | --- |
| GET | `/events/:eventId/categories` | 🟢 | — | `{ data: [category] }` |
| POST | `/events/:eventId/categories` | 🔴 | `{ name, price(dec), quotaTotal, benefits?, sortOrder? }` | 201 `{ data }` |
| PUT | `/categories/:id` | 🔴 | Partial `{ name?, price?, quotaTotal?, benefits?, sortOrder? }` | `{ data }` |
| DELETE | `/categories/:id` | 🔴 | — | `{ message }` |

---

## 6. Venues (`/api/venues`)

Model:
```jsonc
{
  "id": "uuid",
  "name": "Gelora Bung Karno",
  "address": "Jl. Pintu Satu Senayan, Gelora, Kecamatan Tanah Abang",
  "city": "Jakarta",
  "imageUrl": "https://.../gbk.webp",
  "sortOrder": 0,
  "createdAt": "..."
}
```

| Method | Path | Auth | Body / Query | Respon |
| --- | --- | --- | --- | --- |
| GET | `/venues` | 🔵 | Query `q`, `page`, `limit` (default 10, max 100) | `{ data, pagination }` |
| GET | `/venues/:id` | 🔵 | — | `{ data }` |
| POST | `/venues` | 🔴 | `{ name, address, city, imageUrl?, sortOrder? }` | 201 `{ data }` |
| PUT | `/venues/:id` | 🔴 | Partial | `{ data }` |
| DELETE | `/venues/:id` | 🔴 | — | `{ message }` |

---

## 7. Artists (`/api/artists`)

Model:
```jsonc
{
  "id": "uuid",
  "name": "Rover Ensemble",
  "bio": "...",
  "photoUrl": "https://...",
  "createdAt": "..."
}
```

| Method | Path | Auth | Body / Query | Respon |
| --- | --- | --- | --- | --- |
| GET | `/artists` | 🟢 | Query `q` / `search`, `page`, `limit` | `{ data, pagination }` |
| GET | `/artists/:id` | 🟢 | — | `{ data }` |
| POST | `/artists` | 🔴 | `{ name, bio?, photoUrl? }` | 201 `{ data }` |
| PUT | `/artists/:id` | 🔴 | Partial | `{ data }` |
| DELETE | `/artists/:id` | 🔴 | — | `{ message, data }` (gagal 400 bila punya event) |

---

## 8. Orders (`/api/orders`)

Model order (dari `GET /api/orders`):
```jsonc
{
  "id": "uuid",
  "customer": { "id": "uuid", "name": "Sari Dewi", "email": "sari@example.com" },
  "event": { "title": "...", "dateTime": "..." },
  "category": { "name": "VIP" },
  "quantity": 2,
  "totalPrice": "1500000.00",   // string
  "status": "pending",           // "pending" | "verified" | "rejected"
  "createdAt": "..." ,
  "verifiedBy": null,
  "verifiedAt": null
}
```

| Method | Path | Auth | Body / Query | Respon |
| --- | --- | --- | --- | --- |
| POST | `/orders` | 🟣 | `{ eventId, categoryId, quantity }` | 201 `{ message, data }` |
| GET | `/orders/me` | 🟣 | Query `page`, `limit` | `{ data, pagination }` |
| GET | `/orders` | 🔵 | Query `status`, `eventId`, `page`, `limit` | `{ data, pagination }` |
| PATCH | `/orders/:id/verify` | 🔵 | `{ decision: "verified"|"rejected" }` | `{ message, data }` |

---

## 9. Users & Admin Management (`/api/users`)

| Method | Path | Auth | Body / Query | Respon |
| --- | --- | --- | --- | --- |
| GET | `/users/customers` | 🔴 | Query `search`, `page`, `limit` | `{ data: [customer], pagination }` |
| GET | `/users/admins` | 🔴 | Query `search`, `role super_admin/staff`, `page`, `limit` | `{ data: [admin], pagination }` |
| POST | `/users/admins` | 🔴 | `{ name, email, password, role: "super_admin"|"staff" }` | 201 `{ message, data }` |
| PUT | `/users/admins/:id` | 🔴 | Partial `{ name?, email?, password?, role? }` | `{ message, data }` |
| DELETE | `/users/admins/:id` | 🔴 | Param `:id` (tidak bisa hapus diri sendiri) | `{ message }` |

---

## 10. Dashboard Analytics (`/api/dashboard`)

### `GET /api/dashboard/summary` (🔵 admin)
Query parameter opsional: `days` (misal: 7, 30, 90) atau `from` & `to` (ISO string).

Response:
```jsonc
{
  "kpi": {
    "totalEvents": 8,
    "totalTicketsSold": 342,
    "totalRevenue": 178500000,
    "upcomingShows": 4,
    "pendingVerifications": 3
  },
  "overallStats": {
    "verified": { "tickets": 342, "revenue": 178500000 },
    "pending":  { "tickets": 6, "revenue": 3500000 },
    "rejected": { "tickets": 12, "revenue": 6000000 }
  },
  "trend": [
    { "date": "2026-08-01", "tickets": 15, "revenue": 7500000 },
    { "date": "2026-08-02", "tickets": 28, "revenue": 14000000 }
  ],
  "occupancy": [
    {
      "eventId": "uuid",
      "title": "Wuthering Waves Live",
      "capacity": 500,
      "sold": 450,
      "occupancyPct": 90.0,
      "revenue": 225000000
    }
  ],
  "categoryBreakdown": [
    { "name": "VVIP", "ticketsSold": 50, "revenue": 75000000, "sharePct": 42.0 }
  ],
  "eventActivity": {
    "openCount": 6,
    "closedCount": 2,
    "upcoming": [...],
    "recentClosed": [...]
  }
}
```

---

## 11. Uploads (Backblaze B2 — `/api/uploads`)

### `POST /api/uploads` — 🔴 super admin, rate limit 10/15 menit

Upload file gambar (`multipart/form-data`) dengan auto crop & kompresi WebP:
- Field: `file` (wajib) + `kind` (`banner` 16:9 | `profile` 1:1 | `venue` 9:16)
- Maksimal: 10 MB, MIME: `image/png`, `image/jpeg`, `image/webp`.

Response `201`:
```jsonc
{
  "data": {
    "url": "https://f005.backblazeb2.com/file/ggtix-assets/uploads/2026/<uuid>.webp",
    "thumbUrl": "..._thumb.webp",
    "key": "uploads/2026/<uuid>.webp"
  }
}
```

---

## 12. Digital Tickets & QR Check-In (`/api/tickets`)

| Method | Path | Auth | Body / Query / Param | Respon |
| --- | --- | --- | --- | --- |
| GET | `/tickets/order/:orderId` | 🟣/🔵 | Param `orderId` (UUID) | 200 `{ data: { order, tickets: [...] } }` |
| POST | `/tickets/check-in` | 🔵 (Staff/Admin) | `{ qrCodeValue: string, eventId: uuid }` | 200 `{ data: { message, ticket, order, event } }` / `409 ALREADY_CHECKED_IN` / `403 WRONG_EVENT` |
| GET | `/tickets/stats/:eventId` | 🔵 (Staff/Admin) | Param `eventId` (UUID) | 200 `{ data: { eventId, totalTickets, checkedIn, remaining, checkedInPct, byCategory: [...] } }` |

---

## 13. Payments & Midtrans Gateway (`/api/payments`)

| Method | Path | Auth | Body / Param | Respon |
| --- | --- | --- | --- | --- |
| POST | `/payments/midtrans/token` | 🟣 (Customer) | `{ orderId: uuid }` | 201 `{ data: { snapToken, redirectUrl, orderId, grossAmount } }` |
| POST | `/payments/midtrans/notification` | 🟢 (Public Webhook) | JSON payload callback Midtrans | 200 `{ status: "ok", message, orderId, orderStatus }` |
| POST | `/payments/expire-pending` | 🔵 (Admin) | — | 200 `{ message, expiredCount, refundedQuotaCount }` |

---

## 14. Endpoint Target Fase Selanjutnya (Phase 5)

| Fitur | Target Endpoint | Status |
| --- | --- | --- |
| **Promo Code Validation** | `POST /api/promo/validate` | Planned (Phase 5) |
| **FCM Device Registration** | `POST /api/notifications/fcm/register` | Planned (Phase 5) |

---

Dokumen dibangun langsung dari kode backend (authoritative) dan disinkronkan dengan PRD Dokumen Konsep Lengkap.