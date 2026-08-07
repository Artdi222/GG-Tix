# Backend API Contract — Panduan Integrasi Frontend GG Tix

> Dokumen ini menjelaskan **endpoint, bentuk request/response, dan aturan auth** yang tersedia di backend GG Tix (Hono + Bun + PostgreSQL).
> Tujuan: menyamakan pemahaman antara tim frontend dan backend agar tidak ada miskomunikasi (field, nama endpoint, tipe data).

**Base URL**: `http://localhost:3000/api` (dev). Frontend dev di `http://localhost:3001`.
**Semua path di bawah sudah dengan prefix `/api`.**

| Prioritas | Status |
| --- | --- |
| Disusun dari kode backend (authoritative) | ✓ Update: `2026-08-07` |

---

## 1. Hal Penting yang Sering Salah di Frontend

| Topik | Backend (Kebenaran) | Frontend (Sebelumnya keliru) |
| --- | --- | --- |
| **Nama resource konser** | `Events` → `/api/events` | Memakai `/api/concerts` dan field `name` |
| **Modul venue** | **Belum ada** di backend (venue = string `venue` di event) | Halaman `/venues` + CRUD + upload gambar |
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
- `fields` hanya muncul saat validasi (422).
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
> Tidak ada endpoint `POST /auth/logout` di backend; logout = buang token di client.

---

## 4. Events / Konser (`/api/events`)

> **Backend menyebut konser = `Event`.** Frontend selama ini memakai "Concert / concat".

### Model Event (response)
```jsonc
{
  "id": "uuid",
  "title": "Wuthering Waves Live 2026",
  "artistId": "uuid",
  "publisherName": "Kuro Games",
  "venue": "Gelora Bung Karno",
  "city": "Jakarta",
  "dateTime": "2026-10-12T19:00:00.000Z",
  "status": "open"     // "open" | "closed"
  "createdBy": "uuid",
  "createdAt": "2026-..."
}
```
Catatan: detail (`GET /events/:id`) menyertakan relasi `artist` dan `ticketCategories`.

| Method | Path | Auth | Body / Query | Respon |
| --- | --- | --- | --- | --- |
| GET | `/events` | 🟢 | Query: `search`, `artistId`, `city`, `status open/closed`, `page`, `limit` (default 10, max 100) | `{ data, pagination }` |
| GET | `/events/:id` | 🟢 | pathParam é | `{ data: eventWithArtistAndCategories }` |
| POST | `/events` | 🔴 | `{ title, artistId, publisherName, venue, city, dateTime(ISO), status? }` | 201 `{ data }` |
| PUT | `/events/:id` | 🔴 | Partial dari create body | `{ data }` |
| PATCH | `/events/:id/status` | 🔴 | `{ status: "open"|"closed" }` | `{ data }` |
| DELETE | `/events/:id` | 🔴 | — | `{ message }` |

> 🚨 **Tidak ada field `capacity`/`ticketsSold`/`status` 4-nilai pada event** di backend. Maping untuk frontend:
> - `capacity` = jumlah kuota kategori → `ticketCategories` sum `quotaTotal` (didapat dari GET `/events/:id`).
> - `ticketsSold` = berdasar order (belum ada di GET list, lihat dashboard untuk aggregate).
> - Status frontend "On Sale / Almost Sold Out / Sold Out / Draft" **bukan** status backend; disarankan dihitung frontend dari data (atau tambah TBD di PRD).

---

## 5. Ticket Categories (`/api/events/:eventId/categories`, `/api/categories/:id`)

Model kategori:
```jsonc
{ "id": "uuid", "eventId": "uuid", "name": "VIP", "price": "750000.00", "quotaTotal": 100, "quotaRemaining": 67 }
```

| Method | Path | Auth | Body / Query | Respon |
| --- | --- | --- | --- | --- |
| GET | `/events/:eventId/categories` | 🟢 | — | `{ data: [category] }` |
| POST | `/events/:eventId/categories` | 🔴 | `{ name, price(dec), quotaTotal }` | 201 `{ data }` |
| PUT | `/categories/:id` | 🔴 | Partial `{ name?, price?, quotaTotal? }` | `{ data }` |
| DELETE | `/categories/:id` | 🔴 | — | `{ message }` |

> `quotaRemaining` di-set = `quotaTotal` saat create; turun tiap order; naik saat order direject. `price` kirim string desimal (`"750000.00"`).

---

## 6. Artists (`/api/artists`)

Model:
```jsonc
{ "id": "uuid", "name": "Rover Ensemble", "bio": "...", "photoUrl": "https://...", "createdAt": "..." }
```

| Method | Path | Auth | Body / Query | Respon |
| --- | --- | --- | --- | --- |
| GET | `/artists` | 🟢 | Query `q` / `search`, `page`, `limit` | `{ data, pagination }` |
| GET | `/artists/:id` | 🟢 | — | `{ data }` |
| POST | `/artists` | 🔴 | `{ name, bio?, photoUrl? }` | 201 `{ data }` |
| PUT | `/artists/:id` | 🔴 | Partial | `{ data }` |
| DELETE | `/artists/:id` | 🔴 | — | `{ message, data }` (gagal 400 bila punya event) |

> `photoUrl` adalah **URL string** (bukan upload file) di backend.

---

## 7. Orders (`/api/orders`)

Model order (dari `GET /api/orders`):
```jsonc
{
  "id": "uuid",
  "customer": { "id": "uuid", "name": "Sari Dewi", "email": "sari@example.com" },
  "event": { "title": "...", "dateTime": "..." },
  "category": { "name": "VIP" },
  "quantity": 2,
  "totalPrice": "3000000.00",   // string
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

- Error khusus order: `404 EVENT_NOT_FOUND`, `403 EVENT_CLOSED`, `404 CATEGORY_NOT_FOUND`, `409 INSUFFICIENT_QUOTA`, `404 ORDER_NOT_FOUND`, `409 ORDER_ALREADY_PROCESSED`.

---

## 8. Dashboard (`/api/dashboard`)

### `GET /api/dashboard/summary` (🔵 admin)
Response saat ini:
```jsonc
{
  "overallStats": {
    "verified": { "tickets": 0, "revenue": 0 },
    "pending":  { "tickets": 0, "revenue": 0 },
    "rejected": { "tickets": 0, "revenue": 0 }
  },
  "eventActivity": {
    "openCount": 5, "closedCount": 1,
    "upcoming":   [{ "id": "...", "title": "...", "dateTime": "...", "city": "..." }],  // max 5
    "recentClosed": [...]
  },
  "byEvent":    [{ "eventId": "...", "title": "...", "ticketsSold": 0, "revenue": 0 }],
  "byCategory": [{ "categoryId": "...", "name": "...", "ticketsSold": 0, "revenue": 0 }]
}
```
> Direncanakan bertambah di **GGT-02**: `totalEvents`, `totalTicketsSold`, `totalRevenue`, `upcomingShows`, `pendingVerifications`, `capacity`/`sold`/`occupancyPct` per event, dan `revenueShare`.

### `GET /api/dashboard/trend` — *(belum ada di kode, direncanakan GGT-02)*
### `GET /api/dashboard/events` — *(belum ada di kode, direncanakan GGT-02)*
> ⚠️ Kedua endpoint analitik trend & detail-event **belum diimplementasikan** di backend; baru direncanakan di PRD GGT-02. Frontend jangan andalkan dulu sampai implementasi.

---

## 9. Health (`/api/health`)

`GET /api/health` 🟢 → `{ status: "ok" }` (lihat file).

---

## 10. Ringkasan: Endpoint yang Belum Ada di Backend (Gap)
Barang yang frontend harapkan tapi **belum ada** di backend — perlu PRD + implementasi backend:

| Fitur | Gap |
| --- | --- |
| **Venue (CRUD + upload gambar)** | Tidak ada tabel `venues`/endpoint `venues`. Venue hanya string di event. |
| **Upload gambar** (venue/photo) | Tidak ada endpoint multipart upload (body limit kini 10MB, siap; belum ada storage/route). |
| **`/api/concerts`, `/api/venues`** | Frontend varian "Conc" bukan nama resource backend; pakailah `/api/events`. |
| **Dashboard trend / detail** | Belum diimplementasi (GGT-02). |
| **Logout** | Tidak ada endpoint; logout di client. |
| **Pagination default cap** | Sudah ada di list endpoint (`page` default 1, `limit` default 10, max 100). |

---

## 11. Checklist Integrasi Frontend
1. Pasang **proxy** di Nuxt agar `/api` → `http://localhost:3000/api` (atau gunakan runtime config + `$fetch`).
2. Implement klien API wrapper yang: kirim `Authorization: Bearer`, tangani `401` → auto-refresh, `429`, dan parse error `{error, fields}`.
3. Gunakan **tipe `string` untuk id** (uuid) dan **string untuk nominal uang**; parse dengan `Number()`/format IDR bila perlu.
4. Gunakan nama **`event`** (pakai `/api/events`), bukan `concert`.
5. Status event: gunakan `open`/`closed` dari backend, bukan enum 4 nilai.

---

Dokumen dibangun dari kode backend (authoritative). Perbarui setiap kali model/endpoint berubah.