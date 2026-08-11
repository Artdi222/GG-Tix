# GG Tix — Dokumen Konsep Lengkap

> **Platform Penjualan Tiket Konser Gaming & Pop Culture Indonesia**
>
> Versi: `1.0` · Terakhir diperbarui: `2026-08-08` · Status: **Living Document**

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
Kebutuhan: Kelola seluruh event, artis, tiket, verifikasi order, lihat analytics
Akses: CRUD event, CRUD artis, verifikasi order, dashboard analytics
```

```
Nama: Siti — Staff GG Tix
Role: Staff
Kebutuhan: Verifikasi order masuk, scan QR check-in di venue
Akses: Read event, verifikasi order, scan QR (tidak bisa create/delete event)
```

### 2.3 Matriks Role & Permission

| Aksi | Super Admin | Staff | Customer |
| --- | --- | --- | --- |
| CRUD Event | Ya | Tidak | Tidak |
| CRUD Artis | Ya | Tidak | Tidak |
| CRUD Kategori Tiket | Ya | Tidak | Tidak |
| Verifikasi Order | Ya | Ya | Tidak |
| Lihat Dashboard Analytics | Ya | Ya | Tidak |
| Scan QR Check-In | Ya | Ya | Tidak |
| Browse Event | Ya | Ya | Ya |
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
        STORE["Object Storage<br/>(Payment Proofs)"]
    end

    MA -->|HTTPS /api| API
    WA -->|HTTPS /api| API
    API --> DB
    API <-->|Webhook + API| PG
    API -->|Send Push| PUSH
    API -->|Upload/Download| STORE
```

### 3.2 Arsitektur Komunikasi

| Dari | Ke | Protokol | Deskripsi |
| --- | --- | --- | --- |
| Mobile App | Backend API | HTTPS REST | Semua operasi customer |
| Web Dashboard | Backend API | HTTPS REST | Semua operasi admin |
| Backend API | PostgreSQL | TCP (postgres) | Data persistence |
| Backend API | Midtrans | HTTPS | Create payment, check status |
| Midtrans | Backend API | HTTPS Webhook | Payment notification callback |
| Backend API | FCM | HTTPS | Push notification ke mobile |

### 3.3 Arsitektur Frontend (Admin Web)

```mermaid
graph LR
    subgraph "Nuxt 4 App"
        Pages["Pages<br/>/events, /orders,<br/>/artists, /login"]
        Components["Components<br/>EventFormModal,<br/>AppLogo, dll"]
        Composables["Composables<br/>useApi, useAuth"]
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
| **Frontend (Admin)** | Nuxt | 4.5.x | SSR framework Vue 3 |
| **UI Kit** | Nuxt UI | 4.10.x | Komponen UI + icons |
| **CSS** | TailwindCSS | 4.3.x | Utility-first CSS |
| **Validasi (FE)** | Valibot | 1.4.x | Schema validation |
| **Backend** | Hono | 4.12.x | Lightweight web framework |
| **Runtime** | Bun | Latest | Pengganti Node.js, lebih cepat |
| **ORM** | Drizzle ORM | 0.40.x | Type-safe SQL |
| **Database** | PostgreSQL | — | Via Docker Compose |
| **Auth** | Jose (JWT) | 6.0.x | JSON Web Token |
| **Validasi (BE)** | Zod | 3.24.x | Schema validation |
| **Package Manager** | pnpm | 11.18.x | Untuk frontend |

### 4.2 Stack Direncanakan

| Layer | Teknologi | Status | Catatan |
| --- | --- | --- | --- |
| **Mobile App** | React Native | Planned | Customer-facing app (iOS + Android) |
| **Payment** | Midtrans | Planned | Payment gateway otomatis |
| **Push Notif** | Firebase Cloud Messaging | Planned | Notifikasi ke mobile |
| **Object Storage** | Backblaze B2 (S3-compatible) | Implemented (GGT-03) | Upload event banner, foto artis, denah venue (WebP) |
| **Social Login** | Google/Apple Sign-In | Future | Roadmap masa depan |

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

    EVENTS {
        uuid id PK
        varchar title
        uuid artist_id FK
        varchar publisher_name
        varchar venue
        varchar city
        timestamp date_time
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
| **Admins** | Tim internal GG Tix (super_admin, staff) | Creates events, verifies orders |
| **Customers** | Pembeli tiket (end user di mobile app) | Places orders |
| **Artists** | Artis/performer yang tampil di konser | Has many events |
| **Events** | Konser/event yang dijual tiketnya | Has categories, receives orders |
| **Ticket Categories** | Jenis tiket (VVIP, VIP, Reguler) per event | Belongs to event, has price & quota |
| **Orders** | Transaksi pembelian tiket | Links customer - event - category |
| **Payment Proofs** | Bukti pembayaran (rencana: otomatis via Midtrans) | Belongs to order |
| **Tickets** | Tiket digital dengan QR Code unik | Belongs to order, used for check-in |

### 5.3 Aturan Data Penting

| Aturan | Detail |
| --- | --- |
| **ID** | Semua menggunakan UUID (string), bukan integer auto-increment |
| **Harga** | Tipe `numeric(12,2)`, dikirim sebagai **string** di API (`"750000.00"`) |
| **Status Event** | Hanya 2 nilai: `open` dan `closed` |
| **Status Order** | 3 nilai: `pending` -> `verified` atau `rejected` |
| **Quota** | `quota_remaining` berkurang saat order dibuat, bertambah saat order rejected |
| **Batas Pembelian** | Maksimal **4 tiket per order per event** |
| **QR Code** | Unique per tiket, digunakan untuk check-in di venue |

---

## 6. Fitur Utama (Core Features)

### 6.1 Fitur Customer (Mobile App — React Native)

#### Autentikasi

| Fitur | Deskripsi | Status |
| --- | --- | --- |
| Register | Daftar dengan nama, email, password | Backend ready |
| Login | Email + password | Backend ready |
| Auto-refresh token | Access token 1 jam, refresh token 7 hari | Backend ready |
| Logout | Hapus token di client | Backend ready |
| Social login (Google/Apple) | OAuth2 social sign-in | Future roadmap |

#### Browse & Discovery

| Fitur | Deskripsi | Status |
| --- | --- | --- |
| Daftar event | List semua event terbuka dengan search, filter kota/status | Backend ready |
| Detail event | Info lengkap + daftar kategori tiket + sisa kuota | Backend ready |
| Profil artis | Bio, foto, daftar event artis tersebut | Backend ready |
| Wishlist / Reminder | "Ingatkan saya saat tiket dijual" | Planned |

#### Pembelian Tiket

| Fitur | Deskripsi | Status |
| --- | --- | --- |
| Buat order | Pilih event -> kategori -> jumlah (maks 4) -> submit | Backend ready |
| Pembayaran (Midtrans) | VA, QRIS, e-wallet, kartu kredit | Planned |
| Riwayat order | List order sendiri (`/orders/me`) dengan pagination | Backend ready |
| Status order real-time | Lihat status pending/verified/rejected | Backend ready |

#### Tiket Digital

| Fitur | Deskripsi | Status |
| --- | --- | --- |
| E-ticket dengan QR Code | QR code unik per tiket untuk check-in | DB schema ready |
| Download / screenshot tiket | Simpan tiket untuk akses offline | Planned |

#### Notifikasi

| Fitur | Deskripsi | Status |
| --- | --- | --- |
| Push notification | Tiket hampir habis, event baru, status order | Planned |
| In-app notification | Notifikasi dalam aplikasi | Planned |

#### Promo

| Fitur | Deskripsi | Status |
| --- | --- | --- |
| Kode promo / voucher | Diskon persentase atau nominal tetap | Planned |
| Apply promo saat checkout | Input kode -> validasi -> diskon otomatis | Planned |

---

### 6.2 Fitur Admin (Web Dashboard — Nuxt)

#### Dashboard Analytics

| Fitur | Deskripsi | Status |
| --- | --- | --- |
| KPI Cards | Total events, tiket terjual, revenue, upcoming, pending verifikasi | Partial (PRD GGT-02) |
| Overall Stats | Breakdown per status: verified, pending, rejected | Backend ready |
| Per-Event Stats | Revenue, tiket terjual, occupancy % per event | Planned (GGT-02) |
| Per-Category Stats | Revenue share per kategori tiket | Planned (GGT-02) |
| Trend Chart | Penjualan harian (line chart) | Planned (GGT-02) |
| Event Activity | Upcoming events, recently closed events | Backend ready |

#### Manajemen Event

| Fitur | Deskripsi | Status |
| --- | --- | --- |
| CRUD Event | Buat, edit, hapus event konser | Implemented |
| Toggle Status | Buka/tutup penjualan tiket | Implemented |
| CRUD Kategori Tiket | Kelola jenis tiket (VVIP/VIP/Reguler) + harga + kuota | Backend ready |
| Filter & Search | Filter kota, status; search nama event/venue | Implemented |

#### Manajemen Artis

| Fitur | Deskripsi | Status |
| --- | --- | --- |
| CRUD Artis | Buat, edit, hapus artis/performer | Backend ready |
| Proteksi hapus | Tidak bisa hapus artis yang masih punya event | Backend ready |

#### Verifikasi Transaksi

| Fitur | Deskripsi | Status |
| --- | --- | --- |
| List semua order | Filter status, search ID/nama customer | Implemented |
| Verifikasi / Tolak | Approve atau reject order pending | Implemented |
| Auto-refund kuota | Kuota kembali saat order di-reject | Backend ready |

#### QR Scanner (Check-In)

| Fitur | Deskripsi | Status |
| --- | --- | --- |
| Scan QR tiket | Scan QR code -> validasi -> mark checked_in | Planned |
| Check-in stats | Jumlah sudah check-in vs total tiket per event | Planned (GGT-02) |

---

### 6.3 Fitur Antrian Virtual (Waiting Room)

> Fitur krusial untuk mencegah server crash saat tiket baru rilis ("war tiket").

| Aspek | Detail |
| --- | --- |
| **Kapan Aktif** | Saat admin mengaktifkan mode "war tiket" pada event tertentu |
| **Mekanisme** | Customer masuk antrian -> mendapat nomor urut -> dialihkan ke halaman pembelian saat giliran |
| **Kapasitas** | Batch release (misal: 100 orang per batch setiap 2 menit) |
| **Fairness** | First-come-first-served berdasarkan waktu masuk antrian |
| **UI** | Loading screen dengan estimasi waktu tunggu + posisi antrian |
| **Status** | Planned — memerlukan implementasi WebSocket/SSE |

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
    G -->|Tidak| I["Tampilkan Error<br/>(email sudah terdaftar, dll)"]
    I --> E
    C --> J["POST /api/auth/customer/login"]
    J --> K{"Berhasil?"}
    K -->|Ya| L["Simpan Access Token<br/>+ Refresh Token"]
    L --> M["Masuk ke Home"]
    K -->|Tidak| N{"429 Rate Limited?"}
    N -->|Ya| O["Tampilkan: Terlalu banyak<br/>percobaan. Coba lagi nanti."]
    N -->|Tidak| P["Tampilkan: Email/password salah"]
    O --> C
    P --> C
    H --> C
```

### 7.2 Flow Customer: Browse & Beli Tiket

```mermaid
flowchart TD
    A["Home Screen"] --> B["Browse Daftar Event<br/>GET /api/events"]
    B --> C["Search / Filter<br/>(kota, artis, status)"]
    C --> D["Tap Event Card"]
    D --> E["Halaman Detail Event<br/>GET /api/events/:id"]
    E --> F["Lihat Kategori Tiket<br/>+ Sisa Kuota + Harga"]
    F --> G["Pilih Kategori Tiket"]
    G --> H["Pilih Jumlah<br/>(1-4 tiket)"]
    H --> I["Tap 'Beli Tiket'"]
    I --> J{"Customer sudah login?"}
    J -->|Tidak| K["Redirect ke Login"]
    K --> J
    J -->|Ya| L["Review Order<br/>(Event, Kategori, Qty, Total)"]
    L --> M{"Ada Kode Promo?"}
    M -->|Ya| N["Input Kode Promo<br/>-> Validasi -> Apply Diskon"]
    M -->|Tidak| O["Lanjut ke Pembayaran"]
    N --> O
    O --> P["POST /api/orders<br/>{eventId, categoryId, quantity}"]
    P --> Q{"Berhasil?"}
    Q -->|Ya| R["Redirect ke Midtrans<br/>Payment Page"]
    Q -->|Tidak 409| S["Tiket tidak mencukupi!<br/>Tersisa X tiket."]
    Q -->|Tidak 403| T["Event sudah ditutup!"]
    S --> F
    T --> B
    R --> U{"Pembayaran Berhasil?"}
    U -->|Ya (webhook)| V["Order status: verified<br/>Generate QR Ticket"]
    V --> W["Tampilkan E-Ticket<br/>dengan QR Code"]
    U -->|Tidak / Expire| X["Order status tetap pending<br/>-> expired setelah timeout"]
```

### 7.3 Flow Customer: Lihat Tiket & Check-In

```mermaid
flowchart TD
    A["Tab Tiket Saya"] --> B["GET /api/orders/me"]
    B --> C["List Order + Status"]
    C --> D["Tap Order Verified"]
    D --> E["Tampilkan E-Ticket<br/>dengan QR Code"]
    E --> F["Hari H Konser"]
    F --> G["Tunjukkan QR Code<br/>di Pintu Masuk"]
    G --> H["Staff Scan QR<br/>dengan Scanner App"]
    H --> I{"QR Valid?"}
    I -->|Ya, belum check-in| J["Check-in Berhasil!<br/>checked_in = true"]
    I -->|Ya, sudah check-in| K["Tiket Sudah Digunakan"]
    I -->|Tidak valid| L["QR Code Tidak Dikenali"]
```

### 7.4 Flow Admin: Kelola Event

```mermaid
flowchart TD
    A["Login Admin<br/>POST /api/auth/admin/login"] --> B["Dashboard"]
    B --> C["Sidebar -> Event Konser"]
    C --> D["Halaman Manajemen Event"]
    D --> E["Klik 'Tambah Event'"]
    E --> F["Form: Title, Artis, Publisher,<br/>Venue, Kota, Tanggal/Waktu"]
    F --> G["POST /api/events"]
    G --> H["Event Dibuat (status: open)"]
    H --> I["Tambah Kategori Tiket"]
    I --> J["POST /api/events/:id/categories<br/>{name, price, quotaTotal}"]
    J --> K["Ulangi untuk setiap kategori<br/>(VVIP, VIP, Reguler)"]
    K --> L["Event Siap Dijual"]

    D --> M["Klik Toggle Status"]
    M --> N["PATCH /api/events/:id/status<br/>{status: closed}"]
    N --> O["Penjualan Ditutup"]

    D --> P["Klik Edit"]
    P --> Q["PUT /api/events/:id"]

    D --> R["Klik Hapus"]
    R --> S["DELETE /api/events/:id"]
```

### 7.5 Flow Admin: Verifikasi Order

```mermaid
flowchart TD
    A["Halaman Orders"] --> B["GET /api/orders<br/>?status=pending"]
    B --> C["List Order Pending"]
    C --> D["Review Detail Order<br/>(Customer, Event, Kategori, Qty, Total)"]
    D --> E{"Keputusan Admin"}
    E -->|Setujui| F["PATCH /api/orders/:id/verify<br/>{decision: verified}"]
    F --> G["Status: verified<br/>QR Ticket dibuat"]
    E -->|Tolak| H["PATCH /api/orders/:id/verify<br/>{decision: rejected}"]
    H --> I["Status: rejected<br/>Kuota dikembalikan"]
```

### 7.6 Flow Pembayaran (Midtrans — Planned)

```mermaid
sequenceDiagram
    participant C as Customer App
    participant BE as Backend API
    participant MT as Midtrans
    participant DB as Database

    C->>BE: POST /api/orders {eventId, categoryId, qty}
    BE->>DB: Check quota (SELECT FOR UPDATE)
    DB-->>BE: Quota available
    BE->>DB: Create order (status: pending), deduct quota
    BE->>MT: Create Snap Transaction (orderId, amount)
    MT-->>BE: Snap Token + Redirect URL
    BE-->>C: {orderId, paymentUrl, snapToken}

    C->>MT: User completes payment (VA/QRIS/e-wallet)
    MT->>BE: POST /webhook/midtrans (notification)
    BE->>DB: Update order status: verified
    BE->>DB: Generate QR tickets
    BE-->>C: Push Notification: "Pembayaran berhasil!"

    Note over C,MT: Jika payment timeout/gagal
    MT->>BE: POST /webhook/midtrans (expired/failure)
    BE->>DB: Update order status: rejected
    BE->>DB: Restore quota (quota_remaining += qty)
```

### 7.7 Flow Token Refresh

```mermaid
sequenceDiagram
    participant App as App / Dashboard
    participant BE as Backend API

    App->>BE: Request dengan Access Token
    BE-->>App: 401 Unauthorized (token expired)

    App->>BE: POST /api/auth/refresh {refreshToken}
    alt Refresh token valid
        BE-->>App: {data: {token: "new_access_token"}}
        App->>BE: Retry original request dengan token baru
        BE-->>App: 200 OK (response normal)
    else Refresh token expired/invalid
        BE-->>App: 401 Unauthorized
        App->>App: Clear session -> redirect ke Login
    end
```

### 7.8 Flow Antrian Virtual / Waiting Room (Planned)

```mermaid
flowchart TD
    A["Customer buka halaman event<br/>(saat mode war tiket aktif)"] --> B["Masuk Waiting Room"]
    B --> C["Dapat Nomor Antrian<br/>+ Estimasi Waktu Tunggu"]
    C --> D{"Giliran?"}
    D -->|Belum| E["Tampilkan Progress Bar<br/>+ Posisi Antrian"]
    E --> D
    D -->|Ya| F["Redirect ke Halaman Pembelian<br/>(session 10 menit)"]
    F --> G{"Selesai beli<br/>dalam 10 menit?"}
    G -->|Ya| H["Order Dibuat"]
    G -->|Tidak| I["Session expired<br/>-> kembali ke antrian"]
```

---

## 8. API Contract Summary

> Detail lengkap: lihat dokumen [Backend API Contract — Panduan Integrasi Frontend.md](file:///home/artdi/Projects/GG%20Tix/prd/Backend%20API%20Contract%20-%20Panduan%20Integrasi%20Frontend.md)

### 8.1 Base URL & Format

| Item | Detail |
| --- | --- |
| **Base URL** | `http://localhost:3000/api` (dev) |
| **Auth Header** | `Authorization: Bearer <accessToken>` |
| **Response sukses** | `{ data: {...} }` atau `{ data: [...], pagination: {...} }` |
| **Response error** | `{ error: "message", fields?: {...} }` |
| **ID format** | UUID string |
| **Harga format** | String decimal (`"750000.00"`) |

### 8.2 Endpoint Summary

| Group | Method | Path | Auth | Deskripsi |
| --- | --- | --- | --- | --- |
| **Auth** | POST | `/auth/admin/login` | Public | Login admin |
| | POST | `/auth/customer/login` | Public | Login customer |
| | POST | `/auth/customer/register` | Public | Register customer |
| | POST | `/auth/refresh` | Public | Refresh access token |
| | GET | `/auth/me` | Auth | Get current user info |
| **Events** | GET | `/events` | Public | List events (paginated, filterable) |
| | GET | `/events/:id` | Public | Detail event + categories + artist |
| | POST | `/events` | Super Admin | Create event |
| | PUT | `/events/:id` | Super Admin | Update event |
| | PATCH | `/events/:id/status` | Super Admin | Toggle open/closed |
| | DELETE | `/events/:id` | Super Admin | Delete event |
| **Categories** | GET | `/events/:eventId/categories` | Public | List ticket categories |
| | POST | `/events/:eventId/categories` | Super Admin | Create category |
| | PUT | `/categories/:id` | Super Admin | Update category |
| | DELETE | `/categories/:id` | Super Admin | Delete category |
| **Artists** | GET | `/artists` | Public | List artists (paginated) |
| | GET | `/artists/:id` | Public | Detail artist |
| | POST | `/artists` | Super Admin | Create artist |
| | PUT | `/artists/:id` | Super Admin | Update artist |
| | DELETE | `/artists/:id` | Super Admin | Delete artist |
| **Uploads** | POST | `/uploads` | Super Admin | Upload gambar (crop WebP ke B2) — GGT-03 |
| **Venues** | GET | `/venues` | Admin | List venues (paginated) |
| | GET | `/venues/:id` | Admin | Detail venue |
| | POST | `/venues` | Super Admin | Create venue |
| | PUT | `/venues/:id` | Super Admin | Update venue |
| | DELETE | `/venues/:id` | Super Admin | Delete venue |
| **Orders** | POST | `/orders` | Customer | Create order |
| | GET | `/orders/me` | Customer | My orders (paginated) |
| | GET | `/orders` | Admin | All orders (paginated, filterable) |
| | PATCH | `/orders/:id/verify` | Admin | Verify/reject order |
| **Dashboard** | GET | `/dashboard/summary` | Admin | Dashboard summary stats |
| **Health** | GET | `/health` | Public | Health check |

### 8.3 Endpoint yang Direncanakan (Belum Ada)

| Method | Path | Deskripsi | PRD |
| --- | --- | --- | --- |
| GET | `/dashboard/trend` | Trend penjualan per hari | GGT-02 |
| GET | `/dashboard/events` | Detail analytics per event | GGT-02 |
| POST | `/payments/midtrans/notification` | Midtrans webhook callback | TBD |
| POST | `/tickets/:id/check-in` | Scan QR check-in | TBD |
| GET | `/tickets/order/:orderId` | Get tickets for an order | TBD |
| POST | `/promo/validate` | Validasi kode promo | TBD |

---

## 9. Keamanan & Performa

> Detail lengkap: lihat dokumen [GGT-01 - Backend Security & Performance Hardening.md](file:///home/artdi/Projects/GG%20Tix/prd/GGT-01%20-%20Backend%20Security%20%26%20Performance%20Hardening.md)

### 9.1 Keamanan (Sudah Diimplementasi)

| Aspek | Implementasi | Status |
| --- | --- | --- |
| **Rate Limiting** | Auth: 10 req/15 menit/IP, Order: 20 req/15 menit | Terpasang |
| **CORS** | Origin whitelist via env `CORS_ORIGINS` | Terpasang |
| **JWT Hardening** | No fallback secret, fail-fast jika `JWT_SECRET` kosong | Terpasang |
| **Access Token TTL** | 1 jam (dipendekkan dari 7 hari) | Terpasang |
| **Refresh Token** | 7 hari, endpoint `/auth/refresh` | Terpasang |
| **Body Size Limit** | Maks 1 MB (konfigurabel, response 413 jika melebihi) | Terpasang |
| **Atomic Transactions** | `SELECT FOR UPDATE` pada pembelian tiket (anti race condition) | Terpasang |
| **Password Hashing** | Bun.password.hash (bcrypt) | Terpasang |

### 9.2 Performa (Sudah Diimplementasi)

| Aspek | Implementasi | Status |
| --- | --- | --- |
| **Pagination** | Semua list endpoint: default 10, max 100 | Terpasang |
| **Database Indexes** | events(city, status, artistId), orders(status, eventId, customerId) | Terpasang |
| **Dashboard Parallelization** | `Promise.all` untuk 5 query dashboard | Terpasang |
| **Optimized Update** | `.returning()` langsung, tanpa double query | Terpasang |

### 9.3 Kebijakan Anti-Calo

| Mekanisme | Detail |
| --- | --- |
| **Batas pembelian** | Maks 4 tiket per order per event |
| **Rate limiting** | 20 order/15 menit per IP |
| **Atomic quota** | Row-level lock mencegah overselling |
| **Waiting room** | (Planned) Antrian virtual saat war tiket |
| **No resale** | Tidak ada fitur transfer/jual ulang tiket |

### 9.4 Kebijakan Refund

| Kondisi | Kebijakan |
| --- | --- |
| **Customer minta refund sendiri** | Tidak bisa — semua penjualan bersifat final |
| **Event dibatalkan oleh organizer** | Full refund otomatis ke semua pembeli |
| **Pembayaran gagal/expired** | Otomatis — kuota dikembalikan, order tetap pending/expired |

---

## 10. Roadmap & Fase Pengembangan

### 10.1 Overview Timeline

```mermaid
gantt
    title GG Tix Development Roadmap
    dateFormat  YYYY-MM-DD
    axisFormat  %b %Y

    section Phase 1 - Foundation
    Backend Core (Auth, Events, Orders)       :done, p1a, 2026-07-01, 2026-08-07
    Admin Dashboard (Nuxt UI)                 :done, p1b, 2026-07-15, 2026-08-07
    Security & Performance (GGT-01)           :done, p1c, 2026-08-01, 2026-08-07

    section Phase 2 - Analytics & Polish
    Dashboard Analytics (GGT-02)              :active, p2a, 2026-08-08, 30d
    Frontend-Backend Integration Sync         :p2b, 2026-08-08, 14d
    Cleanup Legacy Code (concerts/venues)     :p2c, 2026-08-15, 7d

    section Phase 3 - Payment & Tickets
    Midtrans Payment Integration              :p3a, 2026-09-08, 30d
    QR Ticket Generation                      :p3b, 2026-09-15, 14d
    QR Scanner (Admin Check-in)               :p3c, 2026-09-22, 14d

    section Phase 4 - Mobile App
    React Native Setup & Auth                 :p4a, 2026-10-08, 21d
    Event Browse & Detail                     :p4b, 2026-10-22, 14d
    Checkout & Payment Flow                   :p4c, 2026-11-01, 21d
    E-Ticket & QR Display                     :p4d, 2026-11-15, 14d

    section Phase 5 - Growth Features
    Push Notifications (FCM)                  :p5a, 2026-12-01, 14d
    Promo Code / Voucher System               :p5b, 2026-12-08, 14d
    Wishlist & Reminder                       :p5c, 2026-12-15, 14d
    Virtual Queue / Waiting Room              :p5d, 2027-01-01, 30d
```

### 10.2 Detail Per Fase

#### Phase 1 — Foundation (DONE)

> Backend core + Admin dashboard dasar

| Deliverable | Status |
| --- | --- |
| Auth system (admin + customer, JWT, refresh token) | Selesai |
| CRUD Events, Artists, Ticket Categories | Selesai |
| Order system (create, list, verify/reject) | Selesai |
| Admin dashboard (Nuxt 4 + Nuxt UI) | Selesai |
| Security hardening (GGT-01) | Selesai |
| Database schema + seed data | Selesai |

#### Phase 2 — Analytics & Polish (IN PROGRESS)

> Dashboard analytics + cleanup integrasi frontend-backend

| Deliverable | PRD | Status |
| --- | --- | --- |
| Dashboard summary expansion (KPI cards) | GGT-02 (DASH-02) | Planned |
| Trend penjualan endpoint | GGT-02 (DASH-01) | Planned |
| Occupancy per event | GGT-02 (DASH-03, DASH-04) | Planned |
| Detail event analytics | GGT-02 (DASH-05) | Planned |
| Filter rentang tanggal | GGT-02 (DASH-06) | Planned |
| Chart rendering (line, bar, donut) | GGT-02 (DASH-08) | Planned |
| Hapus dummy data & sync API | GGT-02 (DASH-08) | Planned |
| Hapus halaman `/concerts` (legacy) | — | Planned |
| Hapus halaman `/venues` (legacy) | — | Planned |

#### Phase 3 — Payment & Tickets

> Integrasi Midtrans + sistem tiket digital

| Deliverable | Status |
| --- | --- |
| Midtrans Snap integration (backend) | Planned |
| Payment webhook handler | Planned |
| Auto-verify order saat payment sukses | Planned |
| Auto-expire order saat payment timeout | Planned |
| QR code generation per tiket (post-payment) | Planned |
| QR scanner page (admin) | Planned |
| Check-in endpoint + validasi | Planned |

#### Phase 4 — Mobile App (React Native)

> Customer-facing mobile application

| Deliverable | Status |
| --- | --- |
| React Native project setup | Planned |
| Auth screens (login, register) | Planned |
| Home screen (event list, search, filter) | Planned |
| Event detail screen + ticket categories | Planned |
| Order/checkout flow + Midtrans payment | Planned |
| Order history screen | Planned |
| E-ticket display + QR code | Planned |
| Profile screen | Planned |

#### Phase 5 — Growth Features

> Fitur-fitur untuk pertumbuhan & engagement

| Deliverable | Status |
| --- | --- |
| Push notification (FCM) — event baru, status order, tiket hampir habis | Planned |
| Promo code / voucher system | Planned |
| Wishlist / reminder "Ingatkan saat tiket dijual" | Planned |
| Virtual queue / waiting room untuk war tiket | Planned |
| Social login (Google/Apple) | Future |

---

## 11. Deployment & Infrastruktur

### 11.1 Environment Saat Ini (Development)

| Komponen | Detail |
| --- | --- |
| **Backend** | `bun run --hot src/index.ts` -> port 3000 |
| **Frontend** | `nuxt dev` -> port 3001 |
| **Database** | PostgreSQL via Docker Compose |
| **CORS** | Auto-allow `localhost:5173`, `localhost:3001`, `localhost:3000` |

### 11.2 Opsi Deployment Production

| Opsi | Pro | Kontra | Cocok Untuk |
| --- | --- | --- | --- |
| **PaaS (Railway/Render)** | Simple deploy, auto-scale, managed DB | Biaya naik saat traffic tinggi | Fase awal, tim kecil |
| **VPS (DigitalOcean/Hetzner)** | Murah, full control | Setup manual (nginx, SSL, PM2) | Budget terbatas |
| **Cloud (AWS/GCP)** | Scalable, enterprise-grade | Kompleks, learning curve tinggi | Scale besar |

### 11.3 Infrastruktur yang Dibutuhkan

```mermaid
graph TB
    subgraph "Production Infrastructure"
        LB["Load Balancer / Reverse Proxy<br/>(nginx / Caddy)"]
        APP1["Backend API Instance 1"]
        APP2["Backend API Instance 2"]
        NUXT["Nuxt (SSR/SSG)"]
        PG["PostgreSQL<br/>(Managed)"]
        REDIS["Redis<br/>(Rate Limit, Queue, Cache)"]
        S3["Object Storage<br/>(Payment Proofs, Assets)"]
        CDN["CDN<br/>(Static Assets)"]
    end

    LB --> APP1
    LB --> APP2
    LB --> NUXT
    APP1 --> PG
    APP2 --> PG
    APP1 --> REDIS
    APP2 --> REDIS
    APP1 --> S3
    NUXT --> CDN
```

### 11.4 Environment Variables

| Variable | Deskripsi | Contoh |
| --- | --- | --- |
| `DATABASE_URL` | PostgreSQL connection string | `postgres://user:pass@host:5432/ggtix` |
| `JWT_SECRET` | Secret key untuk JWT (min 32 char) | `super-secret-key-at-least-32-chars` |
| `JWT_ACCESS_TTL` | Access token TTL | `1h` |
| `JWT_REFRESH_TTL` | Refresh token TTL | `7d` |
| `CORS_ORIGINS` | Allowed origins (comma-separated) | `https://admin.ggtix.com` |
| `PORT` | Backend port | `3000` |
| `MIDTRANS_SERVER_KEY` | Midtrans server key | (from Midtrans dashboard) |
| `MIDTRANS_CLIENT_KEY` | Midtrans client key | (from Midtrans dashboard) |
| `B2_KEY_ID` | Backblaze B2 application key ID (GGT-03) | (from B2 dashboard) |
| `B2_APPLICATION_KEY` | Backblaze B2 application key (GGT-03) | (from B2 dashboard) |
| `B2_BUCKET` | Nama bucket B2 (public) | `ggtix-assets` |
| `IMAGE_MAX_BYTES` | Batas ukuran file upload (default 10 MB) | `10485760` |

---

## 12. Glossary

| Istilah | Definisi |
| --- | --- |
| **Event** | Konser atau acara yang dijual tiketnya di GG Tix. Di backend disebut `Event`, bukan `Concert`. |
| **Ticket Category** | Jenis tiket dalam sebuah event (misal: VVIP, VIP, Reguler), masing-masing punya harga dan kuota sendiri. |
| **Order** | Transaksi pembelian tiket oleh customer. Status: pending -> verified atau rejected. |
| **Ticket** | Tiket digital individual dengan QR code unik. Satu order bisa menghasilkan beberapa tiket (sesuai quantity). |
| **Quota** | Jumlah tiket yang tersedia (`quota_remaining`) dari total yang dialokasikan (`quota_total`). |
| **Check-In** | Proses validasi tiket saat customer masuk venue — scan QR code -> mark `checked_in = true`. |
| **War Tiket** | Istilah untuk situasi di mana banyak customer berlomba membeli tiket saat penjualan dibuka (high traffic spike). |
| **Waiting Room** | Antrian virtual yang melindungi server dari crash saat war tiket. |
| **Super Admin** | Admin dengan akses penuh: CRUD event, artis, kategori tiket. |
| **Staff** | Admin dengan akses terbatas: verifikasi order, scan QR, lihat dashboard. |
| **Midtrans Snap** | Layanan payment gateway Midtrans yang menyediakan halaman pembayaran siap pakai. |
| **Rate Limiting** | Pembatasan jumlah request per waktu untuk mencegah abuse (brute-force, spam order). |
| **Atomic Transaction** | Operasi database yang terjamin utuh — jika gagal, semua perubahan di-rollback. |

---

> **Dokumen ini adalah living document.** Diperbarui seiring perkembangan produk.
>
> **Referensi terkait:**
> - [Backend API Contract](file:///home/artdi/Projects/GG%20Tix/prd/Backend%20API%20Contract%20-%20Panduan%20Integrasi%20Frontend.md)
> - [GGT-01: Security & Performance](file:///home/artdi/Projects/GG%20Tix/prd/GGT-01%20-%20Backend%20Security%20%26%20Performance%20Hardening.md)
> - [GGT-02: Dashboard Analytics](file:///home/artdi/Projects/GG%20Tix/prd/GGT-02%20-%20Dashboard%20Analytics%20Penjualan%20Tiket.md)
> - [PRD Template](file:///home/artdi/Projects/GG%20Tix/prd/KODE-PRD%20-%20JUDUL.md)
