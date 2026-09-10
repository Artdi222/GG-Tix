**PRD - GG Tix - Dashboard Analytics Penjualan Tiket**
**GGT-02 - Penjualan Tiket Analitik & Visualisasi**

| MODUL
**Dashboard Analytics** | PERSONA
**Admin, Staff** | PLATFORM
**REST API (Hono + Bun) + Nuxt Frontend** | PRIORITAS
**Phase 2** | STATUS
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

**Background Context**
Backend GG Tix sudah memiliki endpoint `GET /api/dashboard/summary` (auth admin) yang mengembalikan `overallStats`, `eventActivity` (upcoming/recentClosed), `byEvent`, dan `byCategory`. Namun endpoint tersebut belum mencakup seluruh kebutuhan visualisasi dashboard penjualan tiket konser. Dashboard frontend (Nuxt) saat ini masih memakai dummy data (`server/api/dummy/dashboard/stats`, `upcoming`) yang bentuk maupun nilainya tidak sinkron dengan API nyata. Belum tersedia data time-series (trend penjualan), occupancy per event, check-in stats, jumlah pesanan pending, ataupun filter rentang tanggal — data yang dibutuhkan untuk chart (line, bar, pie/donut) dan operasional harian.

Selain itu, audit integrasi frontend ↔ backend menemukan miskomunikasi lebih luas yang menjadi dependency dari modul ini: frontend memakai nama `Concerts` dan `Venues` sedangkan backend memakai `Events` dan tidak memiliki modul venue sama sekali. Detail kontrak API lengkap untuk frontend ada di dokumen terpisah: **"Backend API Contract — Panduan Integrasi Frontend"**.

**Problem Definition**
**Apa problem / job yang dituju?**
Admin tidak bisa memantau tren penjualan, tingkat keterisian (occupancy) per konser, dan antrian verifikasi secara real-time karena API analitik tidak lengkap dan frontend terhambat data dummy.

**Siapa yang menghadapi problem ini & seberapa penting?**
Admin & staff yang mengelola operasional konser dan keputusan promosi. Pentingnya: **Tinggi** — tanpa analitik yang akurat, keputusan harga/kuota/promosi bergeser pada intuisi, dan verifikasi manual berisiko terlambat.

**Bagaimana mereka menyelesaikannya hari ini?**
Dashboard menampilkan dummy data statis; admin harus mengecek data per-query manual atau menunggu laporan. Tidak ada tampilan tren, occupancy, maupun pending-action.

**Jobs To Be Done**
- "Sebagai admin, saya ingin melihat tren penjualan dari waktu ke waktu supaya bisa menentukan momen peluncuran promosi."
- "Sebagai admin, saya ingin melihat occupancy per konser supaya tahu tiket mana yang hampir sold-out."
- "Sebagai staff, saya ingin melihat jumlah pesanan yang menunggu verifikasi supaya tidak ada yang telat diproses."
- "Sebagai admin, saya ingin memfilter dashboard berdasarkan rentang waktu supaya analisis periode tertentu jadi presisi."
- "Sebagai admin, saya ingin melihat kehadiran (check-in) per event supaya bisa menghitung tingkat kedatangan."

**Scope of Work**
- **DASH-01** — Endpoint `GET /api/dashboard/trend?days=` → penjualan (tiket + revenue) per hari, **hanya status `verified`**
- **DASH-02** — Perluas `GET /api/dashboard/summary`: tambahkan `totalEvents`, `totalTicketsSold`, `totalRevenue`, `upcomingShows` (count), `pendingVerifications`
- **DASH-03** — Perkayaan per-event: sertakan `capacity` (dari `SUM(ticket_categories.quota_total)`), `sold`, dan `occupancyPct`
- **DASH-04** — Perluas `byEvent` / `byCategory` dengan `occupancyPct` dan `revenueShare` (persen terhadap total)
- **DASH-05** — Endpoint `GET /api/dashboard/events?eventId=` → detail tiap event: `capacity`, `sold`, `checkedIn` (join tabel `tickets`)
- **DASH-06** — Dukung filter `?days=` (default 7, max 90) dan `?from=&to=` pada `trend` dan `summary`
- **DASH-07** — Penghitungan check-in stats (count `checked_in`) per event melalui join tabel `tickets`
- **DASH-08** — Frontend: hapus dummy `server/api/dummy/dashboard/*`, pasang proxy `/api` → backend, tambah klien API terautentikasi, render kartu KPI + chart (line trend, bar per-event, donut share kategori)

**Out of Scope**
- Payment gateway integration
- Export/print PDF atau Excel
- File upload / storage payment proof (sudah dianggap di luar GGT-01)
- Modul venue (CRUD venue + upload gambar) — di-cover PRD terpisah, endpoint belum ada di backend
- Analitik korelasi marketing / acquisition channel
- Rekomendasi harga otomatis

**Spesifikasi Field**

| **Field** | **Tipe / Input** | **Aturan & Batasan** | **Wajib** | **Contoh** |
| --- | --- | --- | --- | --- |
| **days** | query integer | Default 7, min 1, max 90 | Tidak | `/api/dashboard/trend?days=30` |
| **from** | query date (ISO) | `yyyy-mm-dd`, berlaku di trend & events | Tidak (salah satu) | `?from=2026-07-01&to=2026-08-01` |
| **to** | query date (ISO) | `yyyy-mm-dd`, harus >= from | Tidak (salah satu) | `?to=2026-08-01` |
| **eventId** | query uuid | Filter detail per event | Tidak | `?eventId=<uuid>` |

> Aturan khusus: jika `from`/`to` digunakan bersama, keduanya wajib; backend menolak jika hanya salah satu (400). Default rentang = `days` relatif terhadap hari ini.

**State [Nama Alur] (sesuai Figma)**

| **Komponen / State** | **Kondisi / Data** | **Perilaku** | **Aksi** | **Referensi** |
| --- | --- | --- | --- | --- |
| **Kartu KPI** | Tidak ada data | Menampilkan 0, tidak error | Tetap render | `summary` |
| **Chart trend** | `days` tidak valid / format salah | Return 400 `INVALID_DATE_RANGE` | Frontend menampilkan alert | `trend` |
| **Chart trend** | Tidak ada order verified pada rentang | Array kosong `[]` | Frontend menampilkan empty-state | `trend` |
| **Daftar event** | Ada filter `eventId` | Hanya menampilkan event itu | Selalu render | `events` |
| **Detail event** | Belum ada check-in | `checkedIn = 0`, `attendancePct = 0` | Render donut 0% | `events` |

**Forecasted Impact Metrics**
- Overview dashboard cukup dengan 2 request paralel: `summary` + `trend`.
- Verifikasi pending tidak terlewat karena KPI terlihat real-time.
- Occupancy tiap event tersedia secara real-time (bukan hitung manual).
- Waktu analisis promosi per event turun dari manual (jam) ke realtime (detik).

**User Flow**
Alur Dashboard Overview. Langkah ringkas: (1) Admin membuka dashboard. (2) Frontend memanggil `GET /api/dashboard/summary` dan `GET /api/dashboard/trend?days=30` (paralel). (3) API (auth + admin) mengembalikan data teragregasi. (4) Frontend merender kartu KPI + chart. (5) Admin menekan tombol filter rentang tanggal → fetch ulang dengan `from`/`to`.

Alur Detail Event. Langkah ringkas: (1) Admin pilih event / klik chart. (2) Frontend memanggil `GET /api/dashboard/events?eventId=<id>`. (3) API mengembalikan `capacity`, `sold`, `checkedIn`, `occupancyPct`. (4) Frontend render occupancy bar + check-in stat.

> Kondisi khusus: format tanggal selalu `yyyy-mm-dd`; waktu dihitung terhadap timezone server (UTC). Frontend format dengan `Intl` sesuai locale.

**Design**
Figma: N/A (akan diisi saat UX sign-off).
Chart yang didukung:
- **Line** — trend revenue & ticket terjual per hari.
- **Bar** — tickets/event.
- **Donut/Pie** — share revenue per kategori tiket.
Rendering di frontend dengan chart library (keputusan: @nuxt/ui built-in vs ECharts vs ApexCharts — dibahas saat sprint planning).

**User Stories & Acceptance Criteria**

| **User Story** | **Acceptance Criteria** | **Est Points** | **Notes** |
| --- | --- | --- | --- |
| Sebagai admin, saya ingin melihat tren penjualan harian sehingga dapat menentukan momen promosi. | - `GET /api/dashboard/trend?days=30` mengembalikan array harian `{date, tickets, revenue}` - Hanya order `verified` yang dihitung - Default `days=7`, max 90 - Format `date` = `yyyy-mm-dd` | 5 | DASH-01 |
| Sebagai admin, saya ingin KPI sekilas di halaman dashboard. | - `/summary` menambahkan `totalEvents`, `totalTicketsSold`, `totalRevenue`, `upcomingShows`, `pendingVerifications` - Data `overallStats`/`byEvent` tetap backward compatible | 3 | DASH-02 |
| Sebagai admin, saya ingin melihat occupancy per event. | - `byEvent` menyertakan `capacity`, `sold`, `occupancyPct` - `occupancyPct` = `sold / capacity * 100` - Berbasis `SUM(quota_total) - SUM(quota_remaining)` | 3 | DASH-03 |
| Sebagai admin, saya ingin melihat porsi revenue tiap kategori tiket. | - `byCategory` menyertakan `revenueShare` (persen) - `byEvent` & `byCategory` diurutkan revenue descending | 2 | DASH-04 |
| Sebagai admin, saya ingin detail per event + check-in. | - `GET /api/dashboard/events` menampilkan `capacity`, `sold`, `checkedIn`, `occupancyPct`, `attendancePct` - `attendancePct = checkedIn / sold * 100` - Join table `tickets` via `orders` | 5 | DASH-05, DASH-07 |
| Sebagai admin, saya ingin filter rentang tanggal. | - `?days` dan `?from=&to=` didukung pada `trend` & `summary` - `from` tanpa `to` → 400 - `days` > 90 diklamp - Default 7 | 3 | DASH-06 |
| Sebagai admin, saya ingin dashboard frontend terhubung ke data nyata. | - Dummy `server/api/dummy/dashboard/*` dihapus - Proxy `/api` → backend terpasang - Kartu KPI & chart render dari API - Empty-state muncul bila tidak ada data | 5 | DASH-08 |

Total estimasi: **26 points**.

**Wording (Microcopy)**

| **Kondisi / Field** | **Wording (Bahasa Indonesia)** | **Catatan** |
| --- | --- | --- |
| **Tidak ada data** | "Tidak ada data penjualan untuk periode ini." | Empty-state chart |
| **Rentang tanggal tidak valid** | "Rentang tanggal tidak valid. Silakan periksa tanggal awal dan akhir." | HTTP 400 |
| **Perlu auth** | "Silakan login terlebih dahulu." | HTTP 401 |
| **Akses ditolak** | "Anda tidak memiliki akses ke dashboard ini." | HTTP 403 |
| **Counter pending** | "Verifikasi menunggu dikerjakan." | KPI |

| Dependency: Frontend perlu menghapus dummy `server/api/dummy/dashboard/*`, memasang proxy `/api` ke backend (`http://localhost:3000`), dan mengirim token di header `Authorization: Bearer <token>`. Detail lengkap: dokumen "Backend API Contract — Panduan Integrasi Frontend". |
| --- |

Dokumen disusun berdasarkan hasil review backend GG Tix (gap analitik dashboard). Semua field, chart library, dan estimasi poin bersifat tentatif dan perlu disesuaikan saat sprint planning / UX sign-off.
