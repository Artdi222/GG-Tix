# GG Tix — Dokumen Konsep Lengkap

> **Platform Penjualan Tiket Konser Game Culture Indonesia**
>
> Versi: `1.2` · Terakhir diperbarui: `2026-08-18` · Status: **Living Document**

---

## Daftar Isi

1. [Visi & Misi Produk](#1-visi--misi-produk)
2. [Target Pengguna & Persona](#2-target-pengguna--persona)
3. [Arsitektur Sistem](#3-arsitektur-sistem)
4. [Tech Stack](#4-tech-stack)
5. [Data Model & Entity Relationship](#5-data-model--entity-relationship)
6. [Fitur Utama (Core Features)](#6-fitur-utama-core-features)
7. [User Flow Lengkap](#7-user-flow-lengkap)
8. [API Contract Summary](#8-api-contract-summary)
9. [Keamanan & Performa](#9-keamanan--performa)
10. [Roadmap & Fase Pengembangan](#10-roadmap--fase-pengembangan)
11. [Deployment & Infrastruktur](#11-deployment--infrastruktur)
12. [Glossary](#12-glossary)

---

## 1. Visi & Misi Produk

### Visi

Menjadi **platform tiket konser #1** untuk komunitas **gaming dan pop culture** di Indonesia — tempat di mana gamer, wibu, dan penggemar budaya pop bisa dengan mudah menemukan, membeli, dan menikmati konser dari game dan franchise favorit mereka.

### Misi

- Menyediakan pengalaman pembelian tiket konser yang **cepat, aman, dan anti-calo**
- Mengkurasi event konser game & pop culture berkualitas tinggi di seluruh Indonesia
- Memberikan admin/organizer **dashboard analitik real-time** untuk pengambilan keputusan operasional
- Membangun **ekosistem komunitas** gaming Indonesia melalui event-event musik dan budaya pop

### Value Proposition

| Untuk | Value |
| --- | --- |
| **Customer (Gamer/Fan)** | Satu tempat untuk semua tiket konser game — mudah, cepat, aman |
| **Admin/Organizer** | Dashboard lengkap: kelola event, verifikasi order, lihat analytics real-time |
| **Publisher Game** | Channel distribusi tiket yang terpercaya dengan data engagement komunitas |

### Business Model

GG Tix dioperasikan secara **internal** — semua event dikurasi dan dikelola langsung oleh tim GG Tix. Tidak ada model marketplace/multi-tenant. Revenue berasal dari **margin penjualan tiket** dan potensi sponsorship.

### Target Market

- **Region**: Indonesia saja
- **Bahasa**: Bahasa Indonesia (utama)
- **Mata Uang**: Rupiah (IDR)
- **Demografi**: Komunitas gaming, anime, dan pop culture usia 16-35 tahun

---

## 2. Target Pengguna & Persona

### 2.1 Customer (Mobile App)

```
Nama: Sari — Gamer Casual
Usia: 22 tahun, mahasiswi di Jakarta
Kebiasaan: Main Genshin Impact & Wuthering Waves setiap hari
Kebutuhan: Beli tiket konser game favorit dengan cepat, tanpa antri fisik
Pain Point: Tiket habis karena calo, proses pembelian ribet, tidak tahu ada event
```

```
Nama: Andi — Hardcore Gamer
Usia: 28 tahun, pekerja IT di Surabaya
Kebiasaan: Kolektor merchandise, sering nonton konser bareng teman (beli 3-4 tiket)
Kebutuhan: Notifikasi saat tiket baru rilis, promo/diskon, beli tiket untuk grup
Pain Point: Server crash saat war tiket, batas beli terlalu ketat
```

### 2.2 Admin (Web Dashboard)

```
Nama: Budi — Super Admin GG Tix
Role: Super Admin
Kebutuhan: Kelola seluruh event, venue, artis, tiket, admin/staff, verifikasi order, lihat analytics
Akses: CRUD event, CRUD venue, CRUD artis, CRUD admin/staff, verifikasi order, dashboard analytics
```

```
Nama: Siti — Staff GG Tix
Role: Staff
Kebutuhan: Verifikasi order masuk, scan QR check-in di venue
Akses: Read event/venue/artis, verifikasi order, scan QR (tidak bisa create/edit/delete event, venue, artis, dan admin)
```

### 2.3 Matriks Role & Permission

| Aksi | Super Admin | Staff | Customer |
| --- | --- | --- | --- |
| CRUD Event | Ya | Tidak | Tidak |
| CRUD Venue | Ya | Tidak | Tidak |
| CRUD Artis | Ya | Tidak | Tidak |
| CRUD Kategori Tiket | Ya | Tidak | Tidak |
| CRUD Admin / Staff | Ya | Tidak | Tidak |
| Lihat Daftar Customer | Ya | Ya | Tidak |
| Verifikasi Order | Ya | Ya | Tidak |
| Lihat Dashboard Analytics | Ya | Ya | Tidak |
| Scan QR Check-In | Ya | Ya | Tidak |
| Upload Gambar (B2 Object Storage) | Ya | Tidak | Tidak |
| Browse Event & Artis | Ya | Ya | Ya |
| Buat Order / Beli Tiket | Tidak | Tidak | Ya |
| Lihat Tiket Sendiri | Tidak | Tidak | Ya |
| Riwayat Order Sendiri | Tidak | Tidak | Ya |

---

## 3. Arsitektur Sistem

### 3.1 Arsitektur High-Level

```mermaid
graph TB
    subgraph "Client Layer"
        MA["Mobile App<br/>(React Native)<br/>Customer-facing"]
        WA["Web Dashboard<br/>(Nuxt 4 + Nuxt UI)<br/>Admin Panel"]
    end

    subgraph "API Layer"
        API["Backend API<br/>(Hono + Bun)<br/>REST API"]
    end

    subgraph "Data Layer"
        DB["PostgreSQL<br/>(Drizzle ORM)"]
    end

    subgraph "External Services"
        PG["Midtrans<br/>Payment Gateway"]
        PUSH["Push Notification<br/>Service (FCM)"]
        STORE["Backblaze B2 Storage<br/>(Assets, Banners, Seatmaps)"]
    end

    MA -->|HTTPS /api| API
    WA -->|HTTPS /api| API
    API --> DB
    API <-->|Webhook + API| PG
    API -->|Send Push| PUSH
    API -->|Upload / Download WebP| STORE
```

### 3.2 Arsitektur Komunikasi

| Dari | Ke | Protokol | Deskripsi |
| --- | --- | --- | --- |
| Mobile App | Backend API | HTTPS REST | Semua operasi customer |
| Web Dashboard | Backend API | HTTPS REST | Semua operasi admin |
| Backend API | PostgreSQL | TCP (postgres) | Data persistence via Drizzle ORM |
| Backend API | Midtrans | HTTPS | Inisiasi Snap Token & Cek Status |
| Midtrans | Backend API | HTTPS Webhook | Payment notification callback |
| Backend API | Backblaze B2 | HTTPS S3 API | Upload gambar, kompresi WebP, & storage |
| Backend API | FCM | HTTPS | Push notification ke mobile app |

### 3.3 Arsitektur Frontend (Admin Web)

```mermaid
graph LR
    subgraph "Nuxt 4 App"
        Pages["Pages<br/>/events, /venues, /artists,<br/>/orders, /users, /scanner, /login"]
        Components["Components<br/>EventFormModal, CategoryManagerModal,<br/>VenueModal, AdminModal, dll"]
        Composables["Composables<br/>useApi, useAuth, useUpload"]
        Layouts["Layouts<br/>default (sidebar + topbar)"]
    end

    Pages --> Components
    Pages --> Composables
    Pages --> Layouts
    Composables -->|"$fetch + Bearer Token"| API["Backend API"]
```

---

## 4. Tech Stack

### 4.1 Stack Saat Ini (Sudah Diimplementasi)

| Layer | Teknologi | Versi | Catatan |
| --- | --- | --- | --- |
| **Frontend (Admin)** | Nuxt | 4.5.x | SSR & Client framework Vue 3 |
| **UI Kit** | Nuxt UI | 4.10.x | Komponen UI, form, modal, & icons |
| **CSS** | TailwindCSS | 4.3.x | Utility-first styling |
| **Validasi (FE)** | Valibot | 1.4.x | Schema validation form frontend |
| **QR Scanner (Web)** | HTML5-QRCode | 2.3.x | Kamera & manual scanner check-in di venue |
| **Backend** | Hono | 4.12.x | Lightweight web framework di atas Bun |
| **Runtime** | Bun | Latest | JavaScript/TypeScript runtime performa tinggi |
| **ORM** | Drizzle ORM | 0.40.x | Type-safe SQL ORM |
| **Database** | PostgreSQL | 16 | Relational database via Docker Compose |
| **Auth** | Jose (JWT) | 6.0.x | JSON Web Token (Access 1h + Refresh 7d) |
| **Validasi (BE)** | Zod | 3.24.x | Schema validation request payload |
| **Image Processing** | Sharp | 0.33.x | Kompresi WebP otomatis saat upload |
| **Object Storage** | Backblaze B2 | S3 API | Storage publik untuk banner, venue, seatmap |
| **Payment Gateway** | Midtrans (Snap) | Core API / Snap | Integrasi Snap token, webhook payment notification, auto-expire |
| **Digital Tickets & QR** | `qrcode` / SVG | Latest | Generasi tiket digital ber-QR unik per order verified |
| **Package Manager** | Bun / pnpm | — | Workspace package management |

### 4.2 Stack Direncanakan (Fase Selanjutnya)

| Layer | Teknologi | Status | Catatan |
| --- | --- | --- | --- |
| **Mobile App** | React Native / Expo | Active / Next (Phase 4) | Aplikasi customer (iOS & Android) |
| **Push Notification** | Firebase Cloud Messaging | Planned (Phase 5) | Notifikasi tiket rilis, update status order |
| **Virtual Queue** | Redis + SSE / WebSocket | Planned (Phase 5) | Ruang tunggu saat war tiket |

---

## 5. Data Model & Entity Relationship

### 5.1 Entity Relationship Diagram

```mermaid
erDiagram
    ADMINS {
        uuid id PK
        varchar name
        varchar email UK
        text password_hash
        enum role "super_admin | staff"
        timestamp created_at
    }

    CUSTOMERS {
        uuid id PK
        varchar name
        varchar email UK
        text password_hash
        timestamp created_at
    }

    ARTISTS {
        uuid id PK
        varchar name
        text bio
        text photo_url
        timestamp created_at
    }

    VENUES {
        uuid id PK
        varchar name
        text address
        varchar city
        text image_url
        integer sort_order
        timestamp created_at
    }

    EVENTS {
        uuid id PK
        varchar title
        uuid artist_id FK
        varchar publisher_name
        uuid venue_id FK
        timestamp date_time
        timestamp end_date_time
        text description
        integer max_tickets_per_order
        text[] tags
        text seatmap_url
        text image_url
        integer sort_order
        enum status "open | closed"
        uuid created_by FK
        timestamp created_at
    }

    TICKET_CATEGORIES {
        uuid id PK
        uuid event_id FK
        varchar name
        numeric price "precision 12 scale 2"
        integer quota_total
        integer quota_remaining
        text[] benefits
        integer sort_order
    }

    ORDERS {
        uuid id PK
        uuid customer_id FK
        uuid event_id FK
        uuid category_id FK
        integer quantity
        numeric total_price "precision 12 scale 2"
        enum status "pending | verified | rejected"
        timestamp created_at
        uuid verified_by FK
        timestamp verified_at
    }

    PAYMENT_PROOFS {
        uuid id PK
        uuid order_id FK
        text image_url
        timestamp uploaded_at
    }

    TICKETS {
        uuid id PK
        uuid order_id FK
        varchar qr_code_value UK
        boolean checked_in "default false"
    }

    ADMINS ||--o{ EVENTS : "creates"
    ARTISTS ||--o{ EVENTS : "performs at"
    VENUES ||--o{ EVENTS : "hosts"
    EVENTS ||--o{ TICKET_CATEGORIES : "has"
    EVENTS ||--o{ ORDERS : "receives"
    CUSTOMERS ||--o{ ORDERS : "places"
    TICKET_CATEGORIES ||--o{ ORDERS : "belongs to"
    ORDERS ||--o{ PAYMENT_PROOFS : "has"
    ORDERS ||--o{ TICKETS : "generates"
    ADMINS ||--o{ ORDERS : "verifies"
```

### 5.2 Penjelasan Entitas

| Entitas | Deskripsi | Relasi Utama |
| --- | --- | --- |
| **Admins** | Tim internal GG Tix (`super_admin`, `staff`) | Membuat event, memverifikasi order |
| **Customers** | Akun pengguna/pembeli tiket (mobile/web) | Membuat order transaksi |
| **Artists** | Artis, komposer, atau grup musik yang tampil | Relasi ke banyak event |
| **Venues** | Lokasi gedung/hall konser beserta alamat & kota | Menampung banyak event |
| **Events** | Konser gaming/pop culture yang diadakan | Terhubung ke artist, venue, admin, categories |
| **Ticket Categories** | Tier tiket (VVIP, VIP, Reguler) + benefits & harga | Milik event, dipesan di order |
| **Orders** | Transaksi pembelian tiket konser | Menghubungkan customer, event, dan category |
| **Payment Proofs** | Bukti bayar manual (arsip/fallback) | Milik order |
| **Tickets** | Tiket digital individual dengan QR Code unik | Dihasilkan dari order verified, digunakan check-in |

### 5.3 Aturan Data Penting

| Aturan | Detail |
| --- | --- |
| **ID** | Semua entitas menggunakan UUID v4 (string) |
| **Harga** | Tipe `numeric(12,2)`, diformat sebagai string di API (`"750000.00"`) |
| **Status Event** | `open` (tiket dijual) atau `closed` (penjualan ditutup) |
| **Status Order** | `pending` -> `verified` atau `rejected` |
| **Quota Management** | `quota_remaining` dikurangi seketika secara atomik (`SELECT FOR UPDATE`), dan direfund otomatis jika order ditolak/gagal |
| **Batas Pembelian** | Dikonfigurasi per event melalui `max_tickets_per_order` (default 4) |
| **QR Code Tiket** | Nilai string unik per tiket digital untuk keperluan scanner check-in |

---

## 6. Fitur Utama (Core Features)

### 6.1 Fitur Admin (Web Dashboard — Nuxt 4)

#### Dashboard Analytics
| Fitur | Deskripsi | Status |
| --- | --- | --- |
| KPI Cards | Total event, total tiket terjual, revenue, upcoming, order pending | Implemented |
| Tren Penjualan | Line chart tren penjualan harian & revenue | Implemented |
| Occupancy per Event | Progress bar occupancy (%) dan perbandingan kuota per event | Implemented |
| Revenue Share Kategori | Donut/Pie chart proporsi penjualan tier tiket (VVIP/VIP/dll) | Implemented |
| Event Activity | List upcoming events dan recent closed events | Implemented |

#### Manajemen Event & Venue
| Fitur | Deskripsi | Status |
| --- | --- | --- |
| CRUD Event | Buat, edit, hapus konser (title, artis, publisher, venue, tanggal, seatmap, banner) | Implemented |
| Toggle Status Event | Buka/tutup penjualan tiket seketika | Implemented |
| CRUD Kategori & Benefit | Kelola tier tiket, harga, kuota, urutan, dan daftar benefit tier | Implemented |
| CRUD Venue | Kelola master gedung/venue, alamat, kota, dan denah/foto | Implemented |
| Filter & Search | Filter kota, status, publisher; pencarian nama event/venue | Implemented |

#### Manajemen Artis & Media
| Fitur | Deskripsi | Status |
| --- | --- | --- |
| CRUD Artis | Buat, edit, hapus artis/performer + foto & biografi | Implemented |
| Proteksi Relasi | Pencegahan penghapusan artis/venue yang masih memiliki event aktif | Implemented |
| Upload Media B2 | Integrasi Backblaze B2 dengan kompresi WebP otomatis untuk banner & foto | Implemented |

#### Manajemen Transaksi & Order
| Fitur | Deskripsi | Status |
| --- | --- | --- |
| List Order | Filter status (pending/verified/rejected), pencarian customer/event | Implemented |
| Verifikasi / Tolak | Approve transaksi atau tolak dengan auto-refund kuota | Implemented |
| Histori Verifikasi | Pencatatan siapa admin yang memverifikasi dan timestamp verifikasi | Implemented |

#### Manajemen Tim & Pelanggan
| Fitur | Deskripsi | Status |
| --- | --- | --- |
| Data Pelanggan | List customer terdaftar beserta email dan tanggal registrasi | Implemented |
| Tim Admin/Staff | CRUD staf/admin internal dengan assign role `super_admin` / `staff` | Implemented |

#### QR Scanner (Check-In)
| Fitur | Deskripsi | Status |
| --- | --- | --- |
| Scan QR Tiket | Kamera scanner QR code tiket di pintu masuk venue (`/scanner`) | Implemented |
| Manual Input QR | Input kode tiket manual jika kamera bermasalah | Implemented |
| Check-in Stats | Monitoring real-time jumlah pengunjung yang sudah check-in di venue | Implemented |

---

### 6.2 Fitur Customer (Mobile App / API)

#### Autentikasi & Akun
| Fitur | Deskripsi | Status |
| --- | --- | --- |
| Register & Login | Pendaftaran dan autentikasi customer berbasis email/password | Backend ready |
| Session & Token Rotation | Access token 1 jam + refresh token 7 hari (`/api/auth/refresh`) | Backend ready |
| Social Login | Google / Apple Sign-In | Future Roadmap |

#### Browse & Discovery
| Fitur | Deskripsi | Status |
| --- | --- | --- |
| Browse & Search Event | List event konser dengan filter kota, publisher, artis | Backend ready |
| Detail Event & Seatmap | Info konser lengkap, seatmap venue, daftar kategori & sisa kuota | Backend ready |
| Detail Artis | Portofolio artis dan daftar konser terkait | Backend ready |
| Wishlist & Reminder | Fitur pengingat saat tiket konser dibuka | Planned (Phase 5) |

#### Pembelian Tiket & Pembayaran
| Fitur | Deskripsi | Status |
| --- | --- | --- |
| Pemesanan Tiket | Pemilihan kategori & quantity dengan atomic locking anti-oversell | Backend ready |
| Midtrans Snap Payment | Integrasi pembayaran otomatis (QRIS, VA, GoPay/ShopeePay, Kartu) | Implemented (Backend) |
| Riwayat Transaksi | List transaksi customer (`/api/orders/me`) | Backend ready |

#### E-Ticket & Digital QR
| Fitur | Deskripsi | Status |
| --- | --- | --- |
| E-Ticket dengan QR Unik | Tiket digital yang diterbitkan setelah pesanan terverifikasi | Implemented |
| Akses Tiket Offline | Simpan tiket digital untuk kemudahan check-in tanpa koneksi | Planned (Phase 4) |

#### Antrian Virtual & Promo
| Fitur | Deskripsi | Status |
| --- | --- | --- |
| Waiting Room | Antrian virtual untuk meratakan lonjakan traffic saat war tiket rilis | Planned (Phase 5) |
| Promo & Voucher | Input kode promo diskon nominal/persen | Planned (Phase 5) |

---

## 7. User Flow Lengkap

### 7.1 Flow Customer: Registrasi & Login

```mermaid
flowchart TD
    A["Buka App"] --> B{"Sudah punya akun?"}
    B -->|Ya| C["Masukkan Email + Password"]
    B -->|Tidak| D["Tap 'Daftar'"]
    D --> E["Input: Nama, Email, Password"]
    E --> F["POST /api/auth/customer/register"]
    F --> G{"Berhasil?"}
    G -->|Ya| H["Redirect ke Login"]
    G -->|Tidak| I["Tampilkan Error (Email sudah terdaftar, dll)"]
    I --> E
    C --> J["POST /api/auth/customer/login"]
    J --> K{"Berhasil?"}
    K -->|Ya| L["Simpan Access Token + Refresh Token"]
    L --> M["Masuk ke Home Screen"]
    K -->|Tidak 429| N["Tampilkan: Terlalu banyak percobaan. Tunggu sebentar."]
    K -->|Tidak 401| O["Tampilkan: Email atau password salah"]
    N --> C
    O --> C
```

### 7.2 Flow Customer: Browse, Beli Tiket & Pembayaran (Midtrans)

```mermaid
flowchart TD
    A["Home Screen"] --> B["Browse Daftar Event<br/>GET /api/events"]
    B --> C["Filter Kota / Publisher / Cari Event"]
    C --> D["Pilih Event Card"]
    D --> E["Detail Event & Seatmap<br/>GET /api/events/:id"]
    E --> F["Pilih Kategori Tiket & Qty (1-4)"]
    F --> G["Tap 'Beli Tiket'"]
    G --> H{"Sudah Login?"}
    H -->|Tidak| I["Arahkan ke Login Customer"]
    I --> H
    H -->|Ya| J["POST /api/orders<br/>{eventId, categoryId, quantity}"]
    J --> K{"Quota Tersedia & Event Open?"}
    K -->|Tidak| L["Error: Tiket Habis / Event Ditutup"]
    K -->|Ya| M["Order Created (Status: pending)<br/>Dapatkan Midtrans Snap Token"]
    M --> N["Tampilkan Halaman Pembayaran Midtrans (QRIS / VA / E-Wallet)"]
    N --> O{"Customer Membayar?"}
    O -->|Ya (Settlement Callback)| P["Webhook Midtrans -> Order: verified<br/>Generate QR Tickets"]
    P --> Q["E-Ticket Terbit di Tab 'Tiket Saya'"]
    O -->|Expired / Cancelled| R["Webhook Midtrans -> Order: rejected<br/>Quota Dikembalikan Otomatis"]
```

### 7.3 Flow Check-In di Pintu Masuk Konser (QR Scanner)

```mermaid
flowchart TD
    A["Customer Membuka E-Ticket di App"] --> B["Tunjukkan QR Code di Gate Venue"]
    B --> C["Staff Membuka Halaman Scanner di Dashboard<br/>(/scanner)"]
    C --> D["Scan QR Code Tiket (Kamera / Input Manual)"]
    D --> E["POST /api/tickets/check-in<br/>{qrCodeValue, eventId}"]
    E --> F{"Validasi Tiket"}
    F -->|QR Valid & Belum Check-in| G["Check-in BERHASIL!<br/>Set checked_in = true<br/>Bunyikan Suara Sukses"]
    F -->|QR Valid Tapi Sudah Pernah Check-in| H["PERINGATAN: Tiket Sudah Digunakan!<br/>Tampilkan Waktu Check-In Sebelumnya"]
    F -->|QR Tidak Dikenali / Event Salah| I["ERROR: Tiket Tidak Valid"]
```

---

## 8. API Contract Summary

> Rujukan detail lengkap ada pada dokumen [Backend API Contract — Panduan Integrasi Frontend.md](file:///home/artdi/Projects/GG%20Tix/prd/Backend%20API%20Contract%20-%20Panduan%20Integrasi%20Frontend.md)

### 8.1 Base URL & Standar Response

| Item | Standar |
| --- | --- |
| **Base URL** | `http://localhost:3000/api` (dev) |
| **Header Auth** | `Authorization: Bearer <accessToken>` |
| **Format Sukses** | `{ "data": { ... } }` atau `{ "data": [ ... ], "pagination": { ... } }` |
| **Format Error** | `{ "error": "Pesan error", "fields": { ... } }` |
| **Tipe Data ID** | UUID v4 (string) |
| **Tipe Data Harga** | String desimal (`"750000.00"`) |

### 8.2 Daftar Endpoint Aktif

| Group | Method | Path | Auth / Role | Deskripsi |
| --- | --- | --- | --- | --- |
| **Auth** | POST | `/auth/admin/login` | Public | Login tim admin / staff |
| | POST | `/auth/customer/login` | Public | Login customer |
| | POST | `/auth/customer/register` | Public | Registrasi akun customer |
| | POST | `/auth/refresh` | Public | Refresh token JWT |
| | GET | `/auth/me` | Logged In | Dapatkan profil user saat ini |
| **Events** | GET | `/events` | Public | List konser (filter kota, status, publisher, pagination) |
| | GET | `/events/:id` | Public | Detail konser lengkap (artist, venue, ticket categories) |
| | POST | `/events` | Super Admin | Buat konser baru |
| | PUT | `/events/:id` | Super Admin | Update data konser |
| | PATCH | `/events/:id/status` | Super Admin | Buka / tutup penjualan tiket |
| | DELETE | `/events/:id` | Super Admin | Hapus konser |
| **Categories**| GET | `/events/:eventId/categories` | Public | List kategori tiket konser |
| | POST | `/events/:eventId/categories` | Super Admin | Tambah kategori tiket (+ benefits, quota, sortOrder) |
| | PUT | `/categories/:id` | Super Admin | Update kategori tiket |
| | DELETE | `/categories/:id` | Super Admin | Hapus kategori tiket |
| **Venues** | GET | `/venues` | Admin | List master venue |
| | GET | `/venues/:id` | Admin | Detail venue |
| | POST | `/venues` | Super Admin | Buat master venue baru |
| | PUT | `/venues/:id` | Super Admin | Update data venue |
| | DELETE | `/venues/:id` | Super Admin | Hapus venue |
| **Artists** | GET | `/artists` | Public | List artis konser |
| | GET | `/artists/:id` | Public | Detail artis & event terkait |
| | POST | `/artists` | Super Admin | Tambah artis baru |
| | PUT | `/artists/:id` | Super Admin | Update artis |
| | DELETE | `/artists/:id` | Super Admin | Hapus artis |
| **Uploads** | POST | `/uploads` | Super Admin | Upload gambar ke Backblaze B2 (auto WebP) |
| **Orders** | POST | `/orders` | Customer | Buat order tiket (atomic lock quota) |
| | GET | `/orders/me` | Customer | Riwayat pesanan tiket customer |
| | GET | `/orders` | Admin | List seluruh order transaksi |
| | PATCH | `/orders/:id/verify` | Admin | Verifikasi atau tolak order manual |
| **Tickets** | GET | `/tickets/order/:orderId` | Customer / Admin | Mengambil daftar tiket QR per order |
| | POST | `/tickets/check-in` | Admin (Staff) | Validasi & mark check-in tiket di venue |
| | GET | `/tickets/stats/:eventId` | Admin (Staff) | Statistik real-time check-in per event |
| **Payments** | POST | `/payments/midtrans/token` | Customer | Inisiasi token Midtrans Snap |
| | POST | `/payments/midtrans/notification` | Public (Webhook) | Webhook callback status pembayaran dari Midtrans |
| | POST | `/payments/expire-pending` | Admin | Pembersihan/sweep order kadaluarsa otomatis |
| **Users** | GET | `/customers` | Admin | List data pelanggan |
| | GET | `/admins` | Admin | List tim internal admin/staff |
| | POST | `/admins` | Super Admin | Buat akun admin/staff baru |
| | PUT | `/admins/:id` | Super Admin | Update data/role admin |
| | DELETE | `/admins/:id` | Super Admin | Hapus akun admin/staff |
| **Dashboard**| GET | `/dashboard/summary` | Admin | Summary metrics, tren, occupancy, category breakdown |
| **Health** | GET | `/health` | Public | Health check server |

### 8.3 Endpoint Target Fase Selanjutnya (Phase 5)

| Method | Path | Auth / Role | Deskripsi |
| --- | --- | --- | --- |
| POST | `/promo/validate` | Customer | Validasi kode voucher promo |
| POST | `/notifications/fcm/register` | Customer | Registrasi token FCM perangkat mobile |

---

## 9. Keamanan & Performa

### 9.1 Keamanan Sistem

| Aspek | Kebijakan & Implementasi |
| --- | --- |
| **Rate Limiting** | Auth: 10 request / 15 menit per IP; Order: 20 request / 15 menit per IP |
| **CORS Whitelisting** | Whitelist origin ketat melalui variabel environment `CORS_ORIGINS` |
| **JWT Secrets & Fail-Fast** | Wajib `JWT_SECRET` minimal 32 karakter, no hardcoded fallback, fail-fast saat startup jika kosong |
| **Token Lifetime** | Access token 1 jam (minimalkan dampak token leak), Refresh token 7 hari |
| **Atomic Quota Locking** | `SELECT FOR UPDATE` pada baris kategori tiket saat checkout untuk mencegah over-selling saat war tiket |
| **Password Hashing** | Bcrypt via native `Bun.password.hash` |
| **Payload Size Protection**| Batas maksimal request body 1 MB untuk endpoint JSON |

### 9.2 Optimasi Performa Database

- **Pagination Standar**: Semua endpoint list dilengkapi limit dan offset (default 10, max 100).
- **Index Strategis**: Index pada `events(publisher_name, status, artist_id, venue_id)`, `orders(status, event_id, customer_id)`, `venues(name)`.
- **Query Parallelization**: Dashboard summary dieksekusi secara asinkron paralel (`Promise.all`).

---

## 10. Roadmap & Fase Pengembangan

### 10.1 Status Fase Saat Ini

```mermaid
gantt
    title GG Tix Project Status & Roadmap
    dateFormat  YYYY-MM-DD
    axisFormat  %b %Y

    section Phase 1 - Foundation (DONE)
    Core Auth, Events, Orders API             :done, p1a, 2026-07-01, 2026-08-07
    Admin Dashboard Foundation (Nuxt 4)       :done, p1b, 2026-07-15, 2026-08-07
    Security Hardening (GGT-01)               :done, p1c, 2026-08-01, 2026-08-07

    section Phase 2 - Analytics, Media & Polish (DONE)
    Dashboard Analytics Expansion (GGT-02)    :done, p2a, 2026-08-08, 2026-08-14
    Backblaze B2 Uploads & WebP (GGT-03)      :done, p2b, 2026-08-10, 2026-08-14
    Schema Enrichment, Users & Session (GGT-04):done, p2c, 2026-08-12, 2026-08-15

    section Phase 3 - Tickets & Payments (DONE)
    Digital Ticket QR Generation (GGT-05)     :done, p3a, 2026-08-16, 2026-08-17
    Admin QR Scanner Page /scanner (GGT-05)   :done, p3b, 2026-08-16, 2026-08-17
    Midtrans Payment Gateway (GGT-06)         :done, p3c, 2026-08-17, 2026-08-18
    Unified Middleware & RBAC (GGT-07)        :done, p3d, 2026-08-17, 2026-08-18

    section Phase 4 - Mobile App (ACTIVE / NEXT)
    React Native Setup & Auth                 :active, p4a, 2026-08-19, 14d
    Event Discovery & Ticket Purchase         :p4b, 2026-09-02, 21d
    Digital Ticket & Offline QR View          :p4c, 2026-09-23, 14d

    section Phase 5 - Growth Features (PLANNED)
    Push Notification (FCM)                   :p5a, 2026-10-10, 14d
    Promo / Voucher Engine                    :p5b, 2026-10-24, 14d
    Virtual Queue / Waiting Room              :p5c, 2026-11-10, 21d
```

### 10.2 Rincian Deliverable Per Fase

#### Phase 1 — Foundation ✅ (Selesai)
- Autentikasi JWT (Admin & Customer), Refresh Token, Role matrix.
- CRUD Events, Artists, Ticket Categories.
- Order placement dengan database transaction lock & manual verification.
- Security hardening (GGT-01).

#### Phase 2 — Analytics, Storage & Schema Enrichment ✅ (Selesai)
- Dashboard Analytics lengkap (KPI, chart tren, occupancy, revenue share tier) — PRD GGT-02.
- Upload media Backblaze B2 dengan kompresi WebP otomatis — PRD GGT-03.
- Master Management Venue (`/venues`) & relasi FK `events.venue_id` — PRD GGT-04.
- Field enrichment (`benefits`, `seatmap_url`, `tags`, `sort_order`, `description`) — PRD GGT-04.
- Session persistence fix & User Management (`/users`) — PRD GGT-04.

#### Phase 3 — Tickets, QR Scanner & Payment Gateway ✅ (Selesai)
- **Generasi Tiket Digital**: Pembuatan record tabel `tickets` dengan nilai QR unik otomatis saat order berstatus `verified` — PRD GGT-05.
- **QR Scanner & Check-In**: Endpoint check-in tiket dan implementasi halaman UI `/scanner` untuk operasional staf venue di hari H konser — PRD GGT-05.
- **Midtrans Payment Integration**: Integrasi Midtrans Snap & webhook auto-verification dan auto-refund saat transaksi gagal/expired — PRD GGT-06.
- **Unified Middleware & RBAC Architecture**: Request ID tracing, memory sliding rate limiter, audit trail & API route gatekeeping — PRD GGT-07.

#### Phase 4 — Mobile App (React Native) 📱 (Fokus Aktif Selanjutnya)
- Frontend mobile untuk customer (iOS & Android).
- Discovery konser, checkout flow, e-ticket viewer, dan profil customer.

#### Phase 5 — Growth & Scale Features ⚡ (Direncanakan)
- Push Notification (FCM) untuk pengingat konser dan status order.
- Sistem Promo Code & Voucher Diskon.
- Virtual Waiting Room untuk war tiket rilis besar.

---

## 11. Deployment & Infrastruktur

### 11.1 Environment Development Lokal

| Komponen | Perintah / Konfigurasi | Port |
| --- | --- | --- |
| **Backend** | `bun dev` (Hono dengan hot reload) | `3000` |
| **Frontend** | `bun dev` (Nuxt SSR dev server) | `3001` |
| **Database** | Docker Compose PostgreSQL 16 | `5432` |

### 11.2 Environment Variables Backend (`.env`)

| Variable | Deskripsi | Contoh |
| --- | --- | --- |
| `DATABASE_URL` | PostgreSQL connection string | `postgres://user:pass@localhost:5432/ggtix` |
| `JWT_SECRET` | Secret key JWT (min 32 karakter) | `your-super-secret-key-32-chars-long` |
| `JWT_ACCESS_TTL` | Access token lifetime | `1h` |
| `JWT_REFRESH_TTL` | Refresh token lifetime | `7d` |
| `CORS_ORIGINS` | Origin yang diizinkan | `http://localhost:3001,http://localhost:3000` |
| `PORT` | Backend port | `3000` |
| `B2_KEY_ID` | Backblaze B2 Key ID | `005...` |
| `B2_APPLICATION_KEY` | Backblaze B2 Application Key | `K005...` |
| `B2_BUCKET` | Nama bucket B2 public | `ggtix-assets` |
| `IMAGE_MAX_BYTES` | Batas ukuran upload (default 10 MB) | `10485760` |
| `MIDTRANS_SERVER_KEY` | Midtrans server key | `SB-Mid-server-...` |
| `MIDTRANS_CLIENT_KEY` | Midtrans client key | `SB-Mid-client-...` |

---

## 12. Glossary

| Istilah | Definisi |
| --- | --- |
| **Event** | Konser atau pertunjukan musik yang dijual tiketnya di GG Tix. |
| **Venue** | Gedung atau lokasi fisik tempat konser berlangsung yang memiliki kapasitas dan alamat. |
| **Ticket Category** | Kategori/tier tiket dalam konser (seperti VVIP, VIP, Festival, Reguler) beserta harga, kuota, dan benefit khusus. |
| **Order** | Transaksi pemesanan tiket oleh customer. |
| **Ticket** | Tiket digital individual dengan QR Code unik yang diterbitkan setelah order berstatus `verified`. |
| **Check-In** | Proses verifikasi dan validasi tiket pengunjung di pintu masuk venue konser menggunakan scanner QR. |
| **War Tiket** | Momen pembukaan penjualan tiket konser di mana banyak pengguna mengakses sistem secara bersamaan. |
| **Waiting Room** | Antrian virtual untuk mengatur laju pengguna yang masuk ke proses pembelian saat terjadi lonjakan traffic. |

---

> **Dokumen ini adalah living document.** Diperbarui seiring perkembangan siklus rilis dan kebutuhan produk.
>
> **Dokumen Terkait:**
> - [Backend API Contract](file:///home/artdi/Projects/GG%20Tix/prd/Backend%20API%20Contract%20-%20Panduan%20Integrasi%20Frontend.md)
> - [GGT-01: Backend Security & Performance](file:///home/artdi/Projects/GG%20Tix/prd/GGT-01%20-%20Backend%20Security%20%26%20Performance%20Hardening.md)
> - [GGT-02: Dashboard Analytics Penjualan Tiket](file:///home/artdi/Projects/GG%20Tix/prd/GGT-02%20-%20Dashboard%20Analytics%20Penjualan%20Tiket.md)
> - [GGT-03: Object Storage & Upload Gambar (B2)](file:///home/artdi/Projects/GG%20Tix/prd/GGT-03%20-%20Object%20Storage%20%26%20Upload%20Gambar%20(Backblaze%20B2).md)
> - [GGT-04: Schema Enrichment, Session Persistence & Dashboard Completion](file:///home/artdi/Projects/GG%20Tix/prd/GGT-04%20-%20Schema%20Enrichment,%20Session%20Persistence%20&%20Dashboard%20Completion.md)
> - [GGT-05: Digital Ticket Generation & QR Check-In System](file:///home/artdi/Projects/GG%20Tix/prd/GGT-05%20-%20Digital%20Ticket%20Generation%20%26%20QR%20Check-In%20System.md)
> - [GGT-06: Midtrans Payment Gateway Integration](file:///home/artdi/Projects/GG%20Tix/prd/GGT-06%20-%20Midtrans%20Payment%20Gateway%20Integration.md)
> - [GGT-07: Unified Middleware Architecture, RBAC & API Gatekeeping System](file:///home/artdi/Projects/GG%20Tix/prd/GGT-07%20-%20Unified%20Middleware%20Architecture,%20RBAC%20%26%20API%20Gatekeeping%20System.md)
> - [GGT-08: Role-Based Access Control & Gate Staff Operational Management](file:///home/artdi/Projects/GG%20Tix/prd/GGT-08%20-%20Role-Based%20Access%20Control%20%26%20Gate%20Staff%20Operational%20Management.md)
> - [GGT-10: System Settings, Profile Management & Platform Configuration](file:///home/artdi/Projects/GG%20Tix/prd/GGT-10%20-%20System%20Settings,%20Profile%20Management%20%26%20Platform%20Configuration.md)

