**PRD - GG Tix - Object Storage & Upload Gambar**
**GGT-03 - Backblaze B2, Upload Asset, Event Banner, & Modul Venue**

| MODUL
**Backend API** | PERSONA
**Admin, Super Admin** | PLATFORM
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

Backend GG Tix belum memiliki sarana penyimpanan file gambar. Saat ini `artists.photoUrl`, `events.*`, dan bukti bayar hanya berupa URL string manual; tabel `payment_proofs` tidak punya endpoint upload, tabel `events` tidak punya kolom gambar sama sekali (gap dari "Dokumen Konsep Lengkap" — event konser selalu tampil lewat teks saja). Modul venue (CRUD + upload gambar) sudah ada UI-nya di frontend (`VenueFormModal.vue`, menunggu `POST /api/venues` multipart) namun tidak ada entitas `venues` dan endpoint-nya di backend. Konsep menetapkan object storage sebagai `TBD (S3/Cloudflare R2)`; diputuskan memakai **Backblaze B2** (S3-compatible) karena biaya penyimpanan + egress gratis, dan ada alasan kebijakan menunda upload payment proof sampai Midtrans aktif. Konteks visual tiap entitas berbeda rasio: foto profil artis `1:1`, banner event `16:9`, denah venue `9:16` (atau `4:5`) — sehingga upload harus bisa crop otomatis ke rasio target per jenis konten, bukan sekadar simpan file asli.

**Problem Definition**

**Apa problem / job yang dituju?**
Backend tidak bisa menyimpan gambar: super admin tidak bisa upload banner event atau foto artis, dan modul venue yang ditunggu frontend tidak ada endpoint sama sekali.

**Siapa yang menghadapi problem ini & seberapa penting?**
Super Admin/Admin yang mengelola event & artis (perlu visual agar halaman event menarik), dan frontend yang menunggu endpoint venue. Pentingnya: **Tinggi** — gambar adalah kebutuhan dasar UX/catalog, dan venue modal frontend sudah menunggu.

**Bagaimana mereka menyelesaikannya hari ini?**
Memasukkan URL eksternal manual (Unsplash) atau preview `URL.createObjectURL` lokal yang hilang setelah reload. Tidak ada entitas venue — frontend modal berhenti di TODO comment `replace with POST /api/venues`.

**Jobs To Be Done**
- "Sebagai super admin, saya ingin upload/banner foto artis & banner event, supaya catalog konser terlihat visual."
- "Sebagai super admin, saya ingin CRUD venue + upload denah/area venue, supaya frontend & customer tahu layout lokasi."
- "Sebagai developer, saya ingin endpoint upload yang seragam dan aman, supaya semua resource gambar memakai satu jalur upload."

**Scope of Work**
- **UPL-01** — Storage layer Backblaze B2 (S3-compatible) + konfigurasi env (fail-fast jika B2 key belum diset) + helper upload/download/delete URL & key
- **UPL-02** — Endpoint `POST /api/uploads` (admin multipart, param `kind`) → validasi tipe/size via magic bytes, key unik, upload ke bucket, return `{ url, thumbUrl, key }`
- **UPL-03** — Image processing di backend: crop-ke-rasio target per `kind` (Sharp): `profile` 1:1, `banner` 16:9, `venue` 9:16; konversi SEMUA gambar utama (WebP 85%) + `_thumb` (square maks 400px, WebP 80%) ke B2, DB hanya menyimpan URL utama
- **UPL-04** — Kolom baru `events.imageUrl` + set/update via CRUD event (menerima URL hasil upload)
- **UPL-05** — Upload foto artis: kolom `artists.photoUrl` diisi lewat flow upload (tetap mendukung URL manual sebagai fallback)
- **UPL-06** — Modul venue baru: tabel `venues` (id UUID, name, address, latitude, longitude, imageUrl) + endpoint CRUD ter-paginasi (super admin: write; admin: read)
- **UPL-07** — Body size limit & upload handler multipart (dipisah dari batas JSON umum agar gambar sampai 10 MB bisa mengalir)
- **UPL-08** — Migration, seed venue contoh, dan update dokumen API Contract
- **UPL-09** — Automatic B2 Cleanup: Service hapus file B2 (utama + `_thumb`) secara otomatis ketika entity (venue/event/artist) dihapus atau gambarnya diganti/di-update

**Out of Scope**
- Upload payment proof / bukti bayar (ditunda — alur manual akan digantikan Midtrans; tabel `payment_proofs` tetap ada tanpa endpoint)
- Upload langsung dari client ke B2 via presigned URL (arsitektur) — backend tetap menjadi proxy
- Image processing real-time on-the-fly (contoh: transform URL B2) — variasi diproses saat upload, disimpan permanen
- Public CDN / Cloudflare access rules — bucket B2 public polos
- Modifikasi frontend venue page secara menyeluruh (hanya menyesuaikan alur upload 2-step & interface ID UUID di `VenueFormModal.vue`)

**Spesifikasi Field**

| **Field** | **Tipe / Input** | **Aturan & Batasan** | **Wajib** | **Contoh** |
| --- | --- | --- | --- | --- |
| **file** | multipart `file` | `image/png`, `image/jpeg`, `image/webp`; maks **10 MB** (divalidasi via magic bytes) | Ya | `@logo.png` |
| **kind** | string (multipart, bukan JSON) | Satu dari: `profile` (1:1), `banner` (16:9), `venue` (9:16); default `profile` | Tidak | `banner` |
| **url** | string (response) | URL permanen hasil utama di bucket B2 (format WebP) | Ya | `https://.../banner.webp` |
| **thumbUrl** | string (response) | URL varian kecil (square maks 400px, format WebP) | Ya | `https://.../banner_thumb.webp` |
| **key** | string | key unik upload `<uuid>.webp` | Ya | `uploads/2026/ab12.webp` |
| **events.imageUrl** | string URL | Valid URL saat create/update event; opsional | Tidak | `https://.../banner.webp` |
| **latitude / longitude** | number (decimal) | Range `-90..90` / `-180..180` | Ya (venue) | `-6.2192` |
| **imageUrl (venue)** | string URL | Hasil dari `/api/uploads` | Tidak | `https://.../layout.webp` |
| **B2_KEY_ID** | env | Application Key ID B2 | Ya | (dari dashboard B2) |
| **B2_APPLICATION_KEY** | env | Application Key B2 | Ya | (dari dashboard B2) |
| **B2_BUCKET** | env | Nama bucket (hanya huruf/angka/tanda hubung) | Ya | `ggtix-assets` |
| **IMAGE_MAX_BYTES** | env | Batas ukuran file, default `10485760` (10 MB) | Tidak | `10485760` |

> Aturan khusus upload: hanya gambar 3 MIME yang diizinkan (PNG, JPEG, WebP) dan divalidasi via buffer magic bytes oleh Sharp; maks 10 MB; rate limit `10 req/15 menit`. Nama file + ekstensi dinormalisasi server-side (tidak percaya nama client); disimpan dengan path `uploads/<tahun>/<uuid>.webp`. Response berisi `{ url, thumbUrl, key }` — DB (event/artis/venue) hanya menyimpan **`url` utama**.
> Rasio target per `kind`: `profile` → crop center `1:1` (maks 800px) ; `banner` → `16:9` (maks 1600px); `venue` → `9:16` (maks 900px). Semua hasil utama dan `thumbUrl` dikonversi ke format **WebP** (utama 85%, thumbnail 80%). Original upload TIDAK disimpan — file yang diproses (crop + resize) adalah hasil akhir di bucket.

**State [Upload Asset] (sesuai Figma)**

| **Komponen / State** | **Kondisi / Data** | **Perilaku** | **Aksi** | **Referensi** |
| --- | --- | --- | --- | --- |
| **Upload Gallery** | `file` bukan gambar / corrupt | Return 400 `INVALID_FILE_TYPE` | Frontend menampilkan warning | `uploads` |
| **Upload Gallery** | `file` > 10 MB | Return 413 `UPLOAD_TOO_LARGE` | Frontend menampilkan warning | `uploads` |
| **Upload Gallery** | Upload sukses | Return 201 `{ data: { url, thumbUrl, key } }` | Frontend pakai `url` di form (event/artis/venue) | `uploads` |
| **B2 not configured** | Env B2 kosong | Fail-fast saat boot | Developer isi env B2 credentials | `index.ts` |
| **Form Event** | img banner kosong | Simpan tanpa image | Tetap simpan event | `events` |
| **Form Venue** | `imageUrl` kosong | Venue tetap tersimpan (tanpa gambar) | Form tetap valid | `venues` |

**Forecasted Impact Metrics**
- Catalog event & artis bisa punya visual siap-pakai (fixed ratio + WebP + thumbnail) — hemat bandwidth egress B2.
- Semua gambar konsisten rasio per konteks (1:1 / 16:9 / 9:16) → UI tidak perlu `object-fit`/handling aspect-ratio.
- Automatic B2 cleanup mencegah bucket B2 membengkak dengan file sampah dari entity yang dihapus / diganti.
- Endpoint venue baru mengaktifkan modul frontend yang sudah ada (0 → 5 endpoint).
- Upload terpusat 1 endpoint → audit file & penegakkan type/size/ratio seragam.

**User Flow**
Alur Upload Banner Event. Langkah ringkas: (1) Admin buka form event, pilih file gambar. (2) Frontend `POST /api/uploads` (multipart, `kind=banner`, Bearer token). (3) Backend validasi magic bytes + size, generate `<uuid>.webp`, crop 16:9 + buat `_thumb.webp`. (4) Backend simpan hasil ke B2 dan return `{ url, thumbUrl, key }`. (5) Frontend set `imageUrl` pada payload create/update event → hanya `url` yang tersimpan di kolom `events.imageUrl`.

Alur CRUD Venue (2-Step Flow). Langkah ringkas: (1) Admin buka modal venue. (2) Isi nama/alamat/lat/lng dan/atau upload denah via `/api/uploads` (`kind=venue`, rasio 9:16). (3) Frontend menerima `{ url }` lalu menyertakannya dalam JSON payload `POST /api/venues` (`{ name, address, latitude, longitude, imageUrl }`). (4) Backend validates & insert (ID tipe UUID) → return venue. (5) List venue tampil ter-paginasi via `GET /api/venues`.

> Kondisi khusus: Jika admin memperbarui gambar suatu entity atau menghapus entity (DELETE `/api/venues/:id`), backend akan mengekstrak key file B2 dari `imageUrl` lama dan otomatis menghapus 2 objek dari B2 (file utama `<key>` dan thumbnail `<key_base>_thumb.webp`).

**Design**
Figma: N/A (backend-only; UI form disesuaikan di frontend).
Endpoint baru:
- `POST /api/uploads` — multipart `file` + form `kind` → `{ data: { url, thumbUrl, key } }` (super admin auth)
- `GET  /api/venues` — list ter-paginasi (+ `q` search) → `{ data, pagination }` (admin auth)
- `POST /api/venues` — `{ name, address, latitude, longitude, imageUrl? }` (super admin)
- `PUT  /api/venues/:id` — partial update (super admin)
- `DELETE /api/venues/:id` — hapus venue + hapus gambar B2 jika ada (super admin)
- `GET  /api/venues/:id` — detail (admin auth)

> `events.venue` tetap kolom string (backward compatible) — tabel `venues` berdiri sendiri untuk kelola master lokasi + denah. Venue tidak punya FK ke event.

Pipeline gambar (Sharp, per `kind`):

| `kind` | Rasio | Dimensi hasil | Digunakan untuk | Format Output |
| --- | --- | --- | --- | --- |
| `profile` | `1:1` | 800x800 (center-crop) | Foto artis | WebP (85%) |
| `banner` | `16:9` | 1600x900 (center-crop) | Banner/poster event | WebP (85%) |
| `venue` | `9:16` | 900x1600 (center-crop) | Denah venue (modal mobile) | WebP (85%) |

Untuk setiap upload, backend menyimpan 2 objek di B2: hasil utama WebP (dengan rasio sesuai tabel) + `<key_base>_thumb.webp` (400x400, WebP 80%). File asli upload TIDAK disimpan.

Tabel baru:
```sql
venues(id uuid pk default gen_random_uuid(), name varchar(200) not null, address text not null,
       latitude numeric(10,7), longitude numeric(10,7),
       image_url text, created_at timestamptz default now())
```
Kolom baru: `ALTER TABLE events ADD COLUMN image_url text;`

**User Stories & Acceptance Criteria**

| **User Story** | **Acceptance Criteria** | **Est Points** | **Notes** |
| --- | --- | --- | --- |
| Sebagai super admin, saya ingin upload gambar lewat satu endpoint sehingga semua entity bisa pakai URL hasilnya. | - `POST /api/uploads` menerima multipart `file` + `kind` - Validasi magic bytes (png/jpeg/webp), maks 10 MB, salah → 400/413 - Return 201 `{ data: { url, thumbUrl, key } }` - Key unik `<uuid>.webp`, path `uploads/<tahun>/` - Rate limit 10/15 menit | 5 | UPL-01, UPL-02 |
| Sebagai super admin, saya ingin gambar otomatis di-crop ke rasio & dikonversi ke WebP. | - `kind=profile` → 1:1, `banner` → 16:9, `venue` → 9:16 - Dimensi hasil mengikuti tabel pipeline dalam format WebP 85% - Thumbnail 400px WebP 80% dibuat - File asli tidak disimpan di bucket | 5 | UPL-03 |
| Sebagai super admin, saya ingin setiap event punya banner image. | - Migrasi menambah `events.image_url` - Form create/update menerima `imageUrl` (URL valid atau kosong) - Response event menyertakan `imageUrl` | 3 | UPL-04 |
| Sebagai super admin, saya ingin foto artis bisa di-upload (bukan URL manual). | - `photoUrl` pada create/update artist tetap valid URL - Alur frontend pakai hasil `/api/uploads` (kind=profile) - Tanpa regresi pada list/detail artist | 2 | UPL-05 |
| Sebagai super admin, saya ingin CRUD venue + upload denah area. | - Tabel (ID UUID) & 5 endpoint `/venues` tersedia (list + pagination) - Write hanya super admin, read admin - `latitude/longitude` divalidasi range - Venue response menyertakan `imageUrl` | 5 | UPL-06 |
| Sebagai developer, saya ingin upload-handling terpisah dari body JSON agar tidak bentrok. | - Request multipart tidak kena limit JSON umum - Lint/typecheck (`bun run check`) hijau - Env B2 wajib diset | 2 | UPL-07 |
| Sebagai developer, saya ingin B2 dibersihkan dari gambar terhapus/terganti. | - Menghapus venue/event/artist atau mengganti gambar akan menghapus file utama & `_thumb` di B2 secara otomatis | 3 | UPL-09 |
| Sebagai developer, saya ingin dokumentasi API mutakhir. | - API Contract diperbarui: endpoint upload + venues + `imageUrl` - Seed menyertakan minimal 2 venue contoh | 1 | UPL-08 |

Total estimasi: **26 points**.

**Wording (Microcopy)**

| **Kondisi / Field** | **Wording (Bahasa Indonesia)** | **Catatan** |
| --- | --- | --- |
| **Bukan gambar** | "File harus berupa gambar (PNG, JPG, atau WebP)." | HTTP 400 |
| **File terlalu besar** | "Ukuran gambar maksimal 10 MB." | HTTP 413 |
| **`kind` tidak dikenal** | "Jenis gambar tidak diketahui." | HTTP 400 |
| **Upload sukses** | (tidak perlu toast; URL langsung dipakai) | 201 |
| **Env B2 kosong (prod)** | "FATAL: B2 storage not configured (B2_KEY_ID, B2_APPLICATION_KEY, B2_BUCKET)" | Log saat boot |

| Dependency: Frontend `VenueFormModal.vue` dan halaman modal event/artis memakai `POST /api/uploads` kemudian memakai `url` hasilnya di field `imageUrl`/`photoUrl`. Detail lengkap endpoint di dokumen "Backend API Contract — Panduan Integrasi Frontend". |
| --- |

Dokumen disusun berdasarkan gap-analisis "Dokumen Konsep Lengkap" dan catatan `TODO` di `VenueFormModal.vue`. Keputusan arsitektur: file di-crop/resize server-side (Sharp) sesuai rasio target, hasil utama + thumbnail disimpan di B2, DB hanya menyimpan URL utama; file asli upload tidak disimpan. Migration dijalankan di staging dulu sebelum production; objek B2 dianggap immutable.