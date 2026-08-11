# GGT-04: Schema Enrichment, Session Persistence & Dashboard Completion

Implementasi field backend yang kurang, perbaikan session/cache, seatmap custom per event, dan halaman users + scanner di admin dashboard.

> [!NOTE]
> PRD lengkap: [GGT-04 PRD](file:///home/artdi/Projects/GG%20Tix/prd/GGT-04%20-%20Schema%20Enrichment,%20Session%20Persistence%20%26%20Dashboard%20Completion.md)

## Proposed Changes

Perubahan dikelompokkan berdasarkan layer (Database → Backend → Frontend) dan diurutkan berdasarkan dependency.

---

### 1. Database Schema Migration

> [!IMPORTANT]
> Semua migration harus dijalankan sebelum perubahan backend/frontend lainnya.

#### [MODIFY] [schema.ts](file:///home/artdi/Projects/GG%20Tix/backend/src/db/schema.ts)

**ticket_categories:**
- Tambah `benefits` (`text[]`, default `[]`)
- Tambah `sortOrder` (`integer`, default `0`)

**events:**
- Tambah `description` (`text`, opsional)
- Tambah `endDateTime` (`timestamp`, opsional)
- Tambah `maxTicketsPerOrder` (`integer`, default `4`)
- Tambah `tags` (`text[]`, default `[]`)
- Tambah `seatmapUrl` (`text`, opsional)
- Tambah `venueId` (`uuid`, FK ke `venues.id`, opsional — nanti jadi wajib setelah migrasi data)
- Tambah `sortOrder` (`integer`, default `0`)
- Hapus `venue` (`varchar`)
- Hapus `city` (`varchar`)

**venues:**
- Hapus `latitude` dan `longitude`
- Tambah `city` (`varchar(100)`, wajib)
- Tambah `sortOrder` (`integer`, default `0`)

**events relations:** tambah relasi `venue` → `one(venues)`

#### [MODIFY] [seed.ts](file:///home/artdi/Projects/GG%20Tix/backend/src/db/seed.ts)
- Update seed data events dengan field baru
- Update seed data venues (tambah city, hapus lat/long)
- Tambah benefits ke seed ticket categories

---

### 2. Backend — Repository Layer

#### [MODIFY] [category.repository.ts](file:///home/artdi/Projects/GG%20Tix/backend/src/repositories/category.repository.ts)
- `CreateCategoryInput`: tambah `benefits` (string[]), `sortOrder` (number)
- `UpdateCategoryInput`: tambah `benefits`, `sortOrder`
- `findCategoriesByEventId`: order by `sortOrder ASC`
- `createCategory`: simpan benefits + sortOrder
- `updateCategory`: handle benefits + sortOrder

#### [MODIFY] [event.repository.ts](file:///home/artdi/Projects/GG%20Tix/backend/src/repositories/event.repository.ts)
- `CreateEventInput`: tambah `description`, `endDateTime`, `maxTicketsPerOrder`, `tags`, `seatmapUrl`, `venueId`, `sortOrder`. Hapus `venue` + `city`
- `UpdateEventInput`: idem
- `findEventById`: include relasi `venue`
- `findEvents`: include relasi `venue`, order by `sortOrder ASC`
- `createEvent` + `updateEvent`: handle field baru

#### [MODIFY] [venue.repository.ts](file:///home/artdi/Projects/GG%20Tix/backend/src/repositories/venue.repository.ts)
- Hapus lat/long dari input interfaces
- Tambah `city` dan `sortOrder`
- Order by `sortOrder ASC`

#### [NEW] [admin.repository.ts](file:///home/artdi/Projects/GG%20Tix/backend/src/repositories/admin.repository.ts)
- `findAdmins(filters)` — list admin/staff (paginated, searchable)
- `createAdmin(data)` — create admin/staff
- `updateAdmin(id, data)` — update admin/staff
- `deleteAdmin(id)` — delete admin/staff

#### [NEW] [customer.repository.ts](file:///home/artdi/Projects/GG%20Tix/backend/src/repositories/customer.repository.ts) — jika belum ada query list
- `findCustomers(filters)` — list customers (paginated, searchable)

---

### 3. Backend — Service Layer

#### [MODIFY] [category.service.ts](file:///home/artdi/Projects/GG%20Tix/backend/src/services/category.service.ts)
- `CreateCategoryDTO` + `UpdateCategoryDTO`: tambah `benefits`, `sortOrder`

#### [MODIFY] [event.service.ts](file:///home/artdi/Projects/GG%20Tix/backend/src/services/event.service.ts)
- Field baru di `CreateEventDTO` / `UpdateEventDTO`
- Validasi `endDateTime >= dateTime`
- Validasi `venueId` exists

#### [MODIFY] [venue.service.ts](file:///home/artdi/Projects/GG%20Tix/backend/src/services/venue.service.ts)
- Hapus lat/long, tambah `city` + `sortOrder`

#### [NEW] [admin.service.ts](file:///home/artdi/Projects/GG%20Tix/backend/src/services/admin.service.ts)
- CRUD admin/staff
- Validasi: tidak bisa hapus diri sendiri
- Password hashing saat create

#### [NEW] [customer.service.ts](file:///home/artdi/Projects/GG%20Tix/backend/src/services/customer.service.ts) — tambah `listCustomers()`

---

### 4. Backend — Route Layer

#### [MODIFY] [categories.ts](file:///home/artdi/Projects/GG%20Tix/backend/src/routes/categories.ts)
- Zod schema: tambah `benefits` (z.array(z.string()).optional()), `sortOrder` (z.number().int().optional())

#### [MODIFY] [event.ts](file:///home/artdi/Projects/GG%20Tix/backend/src/routes/event.ts)
- Zod schema: tambah semua field baru, hapus `venue` + `city`

#### [MODIFY] [venues.ts](file:///home/artdi/Projects/GG%20Tix/backend/src/routes/venues.ts)
- Zod schema: hapus lat/long, tambah `city` + `sortOrder`

#### [NEW] [admins.ts](file:///home/artdi/Projects/GG%20Tix/backend/src/routes/admins.ts)
- `GET /api/admins` (admin-only)
- `POST /api/admins` (super_admin-only)
- `PUT /api/admins/:id` (super_admin-only)
- `DELETE /api/admins/:id` (super_admin-only)

#### [NEW] [customers.ts](file:///home/artdi/Projects/GG%20Tix/backend/src/routes/customers.ts)
- `GET /api/customers` (admin-only)

#### [MODIFY] [index.ts](file:///home/artdi/Projects/GG%20Tix/backend/src/index.ts)
- Mount new routes: `/admins`, `/customers`

---

### 5. Frontend — Session & Auth Fix

#### [MODIFY] [useApi.ts](file:///home/artdi/Projects/GG%20Tix/frontend/app/composables/useApi.ts)
- `useCookie('ggtix_access_token', { maxAge: 3600 })`
- `useCookie('ggtix_refresh_token', { maxAge: 604800 })`

#### [MODIFY] [useAuth.ts](file:///home/artdi/Projects/GG%20Tix/frontend/app/composables/useAuth.ts)
- Tambah `initSession()` — auto fetchMe() jika token ada
- Export `initSession` untuk dipanggil saat app mount

#### [NEW] [auth.global.ts](file:///home/artdi/Projects/GG%20Tix/frontend/app/middleware/auth.global.ts)
- Nuxt route middleware: redirect ke `/login` jika tidak ada token (kecuali di halaman `/login`)
- Auto `fetchMe()` saat pertama kali navigate jika user belum di-restore

---

### 6. Frontend — Dashboard Pages

#### [NEW] [users/index.vue](file:///home/artdi/Projects/GG%20Tix/frontend/app/pages/users/index.vue)
- 2 tab: "Pelanggan" (read-only) + "Tim Admin" (CRUD untuk super admin)
- Tab Pelanggan: list customers, search, pagination
- Tab Tim Admin: list admin/staff, create/edit/delete modal (super admin only)

#### [NEW] [scanner/index.vue](file:///home/artdi/Projects/GG%20Tix/frontend/app/pages/scanner/index.vue)
- Placeholder page dengan QR scanner mockup
- Info text: "QR Scanner akan diimplementasi di Phase 3"

#### [MODIFY] [EventFormModal.vue](file:///home/artdi/Projects/GG%20Tix/frontend/app/components/EventFormModal.vue)
- Tambah field: description (textarea), endDateTime (datetime-local), tags (chip input), venueId (dropdown dari GET /api/venues), seatmapUrl (upload), maxTicketsPerOrder (number)
- Hapus field: venue (string input), city (string input)

#### [MODIFY] [CategoryManagerModal.vue](file:///home/artdi/Projects/GG%20Tix/frontend/app/components/CategoryManagerModal.vue)
- Tambah sortOrder input per kategori
- Hapus dummy data fallback (benefits sekarang dari BE)

#### [MODIFY] [VenueFormModal.vue](file:///home/artdi/Projects/GG%20Tix/frontend/app/components/VenueFormModal.vue)
- Hapus lat/long fields
- Tambah city field
- Tambah sortOrder field

---

### 7. Frontend — Events & Venues Page Updates

#### [MODIFY] [events/index.vue](file:///home/artdi/Projects/GG%20Tix/frontend/app/pages/events/index.vue)
- Update event card/table: venue/city dari relasi venue bukan dari string fields
- Tampilkan tags sebagai badges

#### [MODIFY] [venues/index.vue](file:///home/artdi/Projects/GG%20Tix/frontend/app/pages/venues/index.vue)
- Hapus lat/long dari table columns
- Tambah city column
- Tambah sortOrder column

---

## User Review Required

> [!IMPORTANT]
> **Breaking Change: Event venue field migration**
> - Field `venue` (string) dan `city` (string) di tabel events akan **dihapus** dan diganti `venueId` (FK)
> - Perlu migration step: untuk setiap event yang ada, buat venue baru di tabel venues berdasarkan string venue/city, lalu set venueId
> - Ini berpengaruh ke semua endpoint event (create, update, list, detail)

> [!WARNING]
> **Breaking Change: Venue lat/long removal**
> - Field `latitude` dan `longitude` akan dihapus dari venues
> - Jika ada data venue dengan lat/long di database, data akan hilang (tapi karena YAGNI dan tidak ada fitur map, ini acceptable)

## Verification Plan

### Automated Tests
```bash
# 1. Jalankan migration
cd backend && bun run drizzle-kit generate && bun run drizzle-kit migrate

# 2. Re-seed database
bun run src/db/seed.ts

# 3. Test backend endpoints
bun test

# 4. Test frontend build
cd frontend && pnpm build
```

### Manual Verification
- [ ] Login admin → refresh browser → masih login (session persist)
- [ ] Buat event baru dengan semua field baru (description, endDateTime, tags, venueId, seatmap)
- [ ] Buat kategori tiket dengan benefits + sortOrder
- [ ] Buka halaman /users → tab Pelanggan dan Tim Admin
- [ ] Super admin: create/edit/delete staff
- [ ] Buka halaman /scanner → lihat placeholder
- [ ] Edit venue → city ada, lat/long tidak ada
- [ ] Event detail menampilkan seatmap custom (jika ada) atau fallback ke venue image
