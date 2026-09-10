**PRD - GG Tix - Modul Backend API**  
**GGT-01 - Backend Security & Performance Hardening**

| MODUL  
**Backend API** | PERSONA  
**Developer, Admin, Customer** | PLATFORM  
**REST API (Hono + Bun)** | PRIORITAS  
**Phase 1 — Critical** | STATUS  
**Draft** |
| --- | --- | --- | --- | --- |

**DACI Framework**

| **Driver** | Engineering Team |
| --- | --- |
| **Approver** | Product Owner |
| --- | --- |
| **Contributor** | Backend Developer |
| --- | --- |
| **Informed** | Frontend Developer, QA |
| --- | --- |

**Background Context**  
Backend API GG Tix sudah berjalan dengan fitur utama (auth, event CRUD, order/ticketing, dashboard) namun belum dilengkapi mekanisme keamanan dan optimasi performa yang memadai untuk environment production. Saat ini tidak ada rate limiting pada endpoint kritis (login, register, order), CORS terbuka untuk semua origin, JWT memiliki fallback secret yang hardcoded, transaksi order rentan race condition karena tidak menggunakan row-level lock, serta beberapa endpoint mengembalikan seluruh data tanpa pagination. Dokumen ini menjadi acuan untuk hardening backend sebelum go-live.  
**Problem Definition**  
**Apa problem / job yang dituju?**  
Backend API belum siap production: rentan brute-force, race condition pada pembelian tiket, dan response yang tidak ter-paginasi bisa menyebabkan degradasi performa seiring pertumbuhan data.  
**Siapa yang menghadapi problem ini & seberapa penting?**  
Seluruh pengguna sistem — customer yang membeli tiket (data integrity & keamanan akun), admin yang mengelola event (performa dashboard), dan tim engineering (maintainability & reliability). Tingkat kepentingan: **Kritis** — jika tidak ditangani sebelum launch, sistem rentan eksploitasi dan data korupsi.  
**Bagaimana mereka menyelesaikannya hari ini?**  
Saat ini tidak ada mitigasi. Endpoint login bisa di-brute-force tanpa batas, dua pembelian concurrent bisa meng-oversell kuota tiket, dan response tanpa pagination membebani network + client.  
**Jobs To Be Done**  
• "Sebagai developer, saya ingin endpoint auth dilindungi rate limiter, supaya mencegah brute-force attack."  
• "Sebagai customer, saya ingin pembelian tiket atomic dan aman dari race condition, supaya kuota tiket tidak oversold."  
• "Sebagai admin, saya ingin dashboard dan list endpoint merespons cepat, supaya operasional harian tidak terhambat."  
• "Sebagai developer, saya ingin konfigurasi CORS dan JWT aman by default, supaya tidak ada misconfiguration di production."  
**Scope of Work**  
• **SEC-01** — Rate limiting pada endpoint auth (login, register) dan order placement  
• **SEC-02** — CORS origin restriction (whitelist frontend domain)  
• **SEC-03** — JWT secret hardening (fail-fast jika env var kosong) + kurangi expiry ke 1 jam + refresh token flow  
• **SEC-04** — Request body size limit  
• **SEC-05** — Row-level lock (SELECT FOR UPDATE / atomic deduct) pada transaksi order  
• **PERF-01** — Pagination pada GET /api/artists dan GET /api/orders/me  
• **PERF-02** — Database index pada kolom yang sering difilter (events.city, events.status, events.artistId, orders.status, orders.eventId, orders.customerId)  
• **PERF-03** — Parallelisasi query dashboard (Promise.all)  
• **PERF-04** — Eliminasi double query pada updateEvent & updateEventStatus  
**Out of Scope**  
• Perubahan frontend (dihandle di PRD terpisah)  
• Payment gateway integration  
• File upload / image storage untuk payment proof  
• E2E / load testing infrastructure  
• CI/CD pipeline changes  
**Spesifikasi Field**

| **Field** | **Tipe / Input** | **Aturan & Batasan** | **Wajib** | **Catatan** |
| --- | --- | --- | --- | --- |
| **Rate Limit Window** | Konfigurasi (env) | Default: 15 menit | Ya | Berlaku per IP address |
| **Rate Limit Max Requests (Auth)** | Konfigurasi (env) | Default: 10 req / window | Ya | Untuk /auth/admin/login, /auth/customer/login, /auth/customer/register |
| **Rate Limit Max Requests (Order)** | Konfigurasi (env) | Default: 20 req / window | Ya | Untuk POST /orders |
| **CORS Allowed Origins** | Konfigurasi (env) | Comma-separated list | Ya | Contoh: `http://localhost:3001,https://ggtix.com` |
| **JWT_SECRET** | Environment variable | Minimal 32 karakter, wajib diisi | Ya | Aplikasi crash saat boot jika kosong |
| **JWT Access Token Expiry** | Konfigurasi | Default: 1 jam | Ya | Shortened dari 7 hari |
| **JWT Refresh Token Expiry** | Konfigurasi | Default: 7 hari | Ya | New — untuk refresh flow |
| **Body Size Limit** | Konfigurasi | Default: 1 MB | Ya | Berlaku global untuk semua POST/PUT/PATCH |
| **Pagination Default Limit** | Konfigurasi | Default: 10, Max: 100 | Ya | Berlaku untuk semua list endpoint |

**State Perubahan Backend**

| **Komponen / State** | **Kondisi / Data** | **Perilaku** | **Aksi** | **Referensi** |
| --- | --- | --- | --- | --- |
| **Rate Limiter** | Request melebihi batas | Return 429 Too Many Requests | Client harus retry setelah window reset | `src/lib/middleware.ts` |
| **CORS** | Origin tidak ada di whitelist | Request ditolak oleh browser (preflight fail) | — | `src/index.ts` |
| **JWT Secret** | `JWT_SECRET` env kosong | Aplikasi throw error saat boot, tidak bisa start | Developer harus set env var | `src/lib/auth.ts` |
| **Refresh Token** | Access token expired | Client kirim refresh token ke POST /auth/refresh | Return access token baru | `src/routes/auth.ts` |
| **Order Transaction** | 2 concurrent order pada kuota terakhir | Hanya 1 yang sukses, lainnya dapat 409 INSUFFICIENT_QUOTA | Row-level lock memastikan atomicity | `src/repositories/order.repository.ts` |
| **Body Limit** | Request body > 1 MB | Return 413 Payload Too Large | — | `src/index.ts` |
| **Paginated Artists** | GET /api/artists tanpa param | Default page=1 limit=10 | Sama seperti events pagination | `src/routes/artists.ts` |
| **Paginated Customer Orders** | GET /api/orders/me tanpa param | Default page=1 limit=10 | Return dengan pagination metadata | `src/routes/orders.ts` |

**Forecasted Impact Metrics**  
• Brute-force attack surface turun 95% — rate limiter membatasi 10 attempt/15 menit per IP.  
• Race condition pada order dieliminasi — zero oversold tickets.  
• Dashboard response time turun ~40-60% — parallelisasi 5 query sequential.  
• GET /api/artists response size turun ~90% (dari semua row ke 10/halaman).  
• Query filter performance naik 3-10x — dengan proper database indexes.  
**User Flow**  
Alur Rate-Limited Login. Langkah ringkas: (1) Customer submit login form. (2) Backend cek rate limit counter per IP. (3a) Jika di bawah batas → proses login normal. (3b) Jika melebihi batas → return 429 dengan header `Retry-After`. (4) Frontend tampilkan pesan "Terlalu banyak percobaan, coba lagi nanti."

Alur Atomic Ticket Purchase. Langkah ringkas: (1) Customer submit order. (2) Backend mulai transaction + SELECT FOR UPDATE pada ticket_categories row. (3) Cek quotaRemaining >= quantity. (4a) Jika cukup → deduct quota, insert order, commit. (4b) Jika tidak cukup → return 409, rollback. (5) Lock dilepas setelah commit/rollback.

Alur Refresh Token. Langkah ringkas: (1) Client mendeteksi access token expired (401 response). (2) Client kirim POST /auth/refresh dengan refresh token. (3a) Jika refresh token valid → return access token baru. (3b) Jika refresh token expired/invalid → return 401, client redirect ke login. (4) Client retry request original dengan access token baru.

**Design**  
Figma: N/A (backend-only changes, no UI impact). Mencakup: middleware layer, repository layer, database schema migration.  
**User Stories & Acceptance Criteria**

| **User Story** | **Acceptance Criteria** | **Est Points** | **Notes** |
| --- | --- | --- | --- |
| Sebagai developer, saya ingin rate limiting pada auth endpoints agar mencegah brute-force. | - Login/register dibatasi 10 req/15 menit per IP  - Request ke-11 mendapat 429 + header Retry-After  - Rate limit counter reset setelah window berakhir | 3 | SEC-01. Gunakan in-memory Map, upgrade ke Redis jika multi-instance. |
| Sebagai developer, saya ingin CORS hanya menerima origin yang di-whitelist agar mencegah unauthorized cross-origin request. | - CORS origin diambil dari env var `CORS_ORIGINS`  - Request dari origin lain ditolak (preflight fail)  - Localhost tetap diizinkan di development | 1 | SEC-02 |
| Sebagai developer, saya ingin aplikasi crash saat boot jika JWT_SECRET kosong agar tidak ada secret default di production. | - Startup throw error jika `JWT_SECRET` tidak diset atau kosong  - Hardcoded fallback dihapus  - Access token expiry dipendekkan ke 1 jam | 2 | SEC-03 |
| Sebagai developer, saya ingin body size limit agar mencegah OOM dari payload besar. | - Semua POST/PUT/PATCH dibatasi 1 MB  - Request melebihi batas mendapat 413  - Limit bisa dikonfigurasi via env var | 1 | SEC-04 |
| Sebagai customer, saya ingin pembelian tiket aman dari overselling agar kuota tiket akurat. | - Order transaction menggunakan row-level lock  - Concurrent order pada kuota terakhir: hanya 1 sukses  - Quota deduction atomic (bukan read-then-write terpisah) | 3 | SEC-05. Paling kritis — berpotensi data corrupt. |
| Sebagai developer, saya ingin refresh token flow agar user tidak perlu login ulang setiap jam. | - POST /auth/refresh endpoint menerima refresh token  - Return access token baru (1 jam)  - Refresh token berlaku 7 hari  - Invalid/expired refresh token → 401 | 5 | SEC-03 lanjutan |
| Sebagai customer, saya ingin GET /api/artists dan GET /api/orders/me ter-paginasi agar response cepat. | - Default page=1 limit=10, max limit=100  - Response menyertakan pagination metadata (page, limit, totalCount, totalPages)  - Backward compatible (tanpa query param = halaman 1) | 3 | PERF-01 |
| Sebagai developer, saya ingin database index pada kolom yang sering difilter agar query lebih cepat. | - Index ditambahkan: events(city), events(status), events(artistId), orders(status), orders(eventId), orders(customerId)  - Migration script dibuat via drizzle-kit generate | 2 | PERF-02 |
| Sebagai admin, saya ingin dashboard merespons cepat agar operasional harian efisien. | - 5 query dashboard dijalankan parallel (Promise.all)  - Response time turun minimal 40%  - Tidak ada perubahan pada response shape | 2 | PERF-03 |
| Sebagai developer, saya ingin menghilangkan double query pada update event agar efisien. | - updateEvent dan updateEventStatus tidak memanggil findEventById setelah update  - Data dikembalikan dari `.returning()` langsung  - Response shape tetap sama | 1 | PERF-04 |

**Wording (Microcopy)**

| **Kondisi / Field** | **Wording (Bahasa Indonesia)** | **Catatan** |
| --- | --- | --- |
| **Rate limit exceeded** | "Terlalu banyak percobaan. Silakan coba lagi dalam {X} menit." | {X} = sisa waktu window |
| **CORS rejected** | (tidak ada response body — browser block) | Hanya terlihat di console browser |
| **JWT_SECRET missing** | "FATAL: JWT_SECRET environment variable is required" | Log saat startup, bahasa Inggris untuk developer |
| **Body too large** | "Request body terlalu besar. Maksimal 1 MB." | HTTP 413 |
| **Insufficient quota (concurrent)** | "Tiket tidak mencukupi. Tersisa {available} tiket." | Sama seperti existing, tapi sekarang atomic |
| **Refresh token expired** | "Sesi Anda telah berakhir. Silakan login kembali." | HTTP 401 |

| Dependency: Frontend perlu menghandle response 429 (rate limit) dan implement refresh token flow (auto-retry dengan token baru saat 401). PRD frontend terpisah perlu dibuat untuk sisi client. |
| --- |

Dokumen ini disusun berdasarkan hasil code review backend GG Tix. Semua scope item harus di-review dan di-approve sebelum kickoff. Estimasi poin bersifat tentatif dan perlu disesuaikan saat sprint planning. Migration database (index) harus dijalankan di staging terlebih dahulu sebelum production.
