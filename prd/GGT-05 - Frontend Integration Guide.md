# GGT-05 - Frontend Integration Guide
**Digital Ticket Generation & QR Check-In System**

Backend sudah siap. Berikut panduan integrasi untuk frontend.

---

## ✅ Backend Implementation Summary

### Auto-Generate Tickets
- Saat admin verify order (`PATCH /api/orders/:id/verify` dengan `decision: "verified"`), backend **otomatis** membuat `quantity` tiket di tabel `tickets`
- Setiap tiket mendapat `qr_code_value` unique: format `tix_{uuid}`
- Idempotent: jika tiket sudah ada untuk order tersebut, tidak duplikat

### Database Schema
```sql
tickets:
  - id: uuid (PK)
  - order_id: uuid (FK to orders, cascade on delete)
  - qr_code_value: varchar(255) unique
  - checked_in: boolean (default false)
  - checked_in_at: timestamp (nullable)
```

---

## 📡 API Endpoints

### 1. GET /api/tickets/order/:orderId
**Akses:** Customer (own order only) atau Admin (all orders)

**Response 200:**
```json
{
  "data": {
    "order": {
      "id": "uuid",
      "eventTitle": "Westlife Live in Jakarta",
      "eventDate": "2024-12-25T19:00:00Z",
      "venueName": "",
      "categoryName": "VIP",
      "quantity": 2,
      "status": "verified"
    },
    "tickets": [
      {
        "id": "uuid",
        "qrCodeValue": "tix_abc123...",
        "qrCodeDataUrl": "data:image/png;base64,iVBORw0KG...",
        "checkedIn": false,
        "checkedInAt": null
      }
    ]
  }
}
```

**Error 404:** Order tidak ditemukan atau belum punya tiket (status bukan `verified`)  
**Error 403:** Customer coba akses order orang lain

**Frontend Flow - Customer:**
1. Setelah order verified, customer buka halaman `/my-orders/:orderId/tickets`
2. Fetch `GET /api/tickets/order/:orderId` dengan Bearer token customer
3. Tampilkan list tiket dengan QR code image (`qrCodeDataUrl` siap pakai di `<img src="...">`)
4. Tiap tiket tampilkan badge status: hijau jika `checkedIn: true`, abu-abu jika false
5. Download/print button untuk simpan e-ticket sebagai PDF atau image

**Frontend Flow - Admin:**
1. Di halaman order detail admin (`/admin/orders/:orderId`), tambahkan tab "Tickets"
2. Fetch sama endpoint, tampilkan list tiket dengan status check-in

---

### 2. POST /api/tickets/check-in
**Akses:** Admin only

**Request Body:**
```json
{
  "qrCodeValue": "tix_abc123...",
  "eventId": "uuid-event-id"
}
```

**Response 200 - Success:**
```json
{
  "data": {
    "status": "SUCCESS",
    "ticket": {
      "id": "uuid",
      "qrCodeValue": "tix_abc123...",
      "checkedIn": true,
      "checkedInAt": "2024-12-25T18:45:00Z"
    },
    "order": {
      "customerName": "John Doe",
      "categoryName": "VIP",
      "quantity": 2
    },
    "event": {
      "title": "Westlife Live in Jakarta"
    }
  }
}
```

**Error Responses:**

| Status | Error | Message | Handling |
|--------|-------|---------|----------|
| 404 | `TICKET_NOT_FOUND` | QR code tidak dikenali | Flash merah + buzz sound |
| 403 | `WRONG_EVENT` | Tiket bukan untuk event ini | Flash kuning + buzz sound |
| 409 | `ALREADY_CHECKED_IN` | Tiket sudah digunakan | Flash kuning + tampilkan `checkedInAt` |

**Frontend Flow - Scanner Page:**
1. Admin buka `/scanner`, pilih event dari dropdown (pre-fetch list events dengan status `open`)
2. Aktifkan kamera dengan library QR scanner (rekomendasi: `html5-qrcode` atau `@zxing/browser`)
3. Saat QR code terdetect, extract `qrCodeValue` lalu POST ke endpoint ini
4. **Visual feedback:**
   - Success: flash hijau fullscreen + ding sound + tampilkan nama customer & kategori selama 2 detik
   - Error 404/403: flash merah + buzz sound + tampilkan error message
   - Error 409 (double scan): flash kuning + buzz + tampilkan "Sudah check-in pada {checkedInAt}"
5. Auto-reset scanner setelah 2 detik, siap scan berikutnya
6. Fallback: input manual field untuk ketik `qrCodeValue` jika kamera rusak/QR blur

---

### 3. GET /api/tickets/stats/:eventId
**Akses:** Admin only

**Response 200:**
```json
{
  "data": {
    "eventId": "uuid",
    "eventTitle": "Westlife Live in Jakarta",
    "totalTickets": 1500,
    "checkedIn": 856,
    "remaining": 644,
    "checkedInPct": 57.1,
    "byCategory": [
      {
        "categoryName": "VIP",
        "total": 300,
        "checkedIn": 285,
        "remaining": 15,
        "checkedInPct": 95.0
      },
      {
        "categoryName": "Regular",
        "total": 1200,
        "checkedIn": 571,
        "remaining": 629,
        "checkedInPct": 47.6
      }
    ]
  }
}
```

**Error 404:** Event tidak ditemukan

**Frontend Flow - Scanner Page:**
1. Di bawah scanner interface, tampilkan real-time stats dengan auto-refresh setiap 5 detik
2. Layout:
   ```
   📊 Check-in Progress
   ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
   856 / 1500 (57.1%)
   [=========>         ] Progress bar
   
   By Category:
   VIP:     285 / 300   (95.0%)
   Regular: 571 / 1200  (47.6%)
   ```
3. Update counter langsung setelah POST check-in success (optimistic update + refetch)

---

## 🎨 UI Components Suggestions

### Customer Ticket Card
```
┌─────────────────────────────────┐
│ 🎟️ Westlife Live in Jakarta     │
│ VIP • 25 Dec 2024, 19:00        │
│                                 │
│   [QR Code Image 300x300]       │
│                                 │
│ Ticket ID: tix_abc123...        │
│ Status: ✅ Ready / 🚫 Used      │
│                                 │
│ [Download] [Share]              │
└─────────────────────────────────┘
```

### Scanner Interface
```
┌─────────────────────────────────┐
│ Event: [Westlife Live ▼]       │
├─────────────────────────────────┤
│                                 │
│    [Camera Feed dengan         │
│     QR code overlay frame]     │
│                                 │
├─────────────────────────────────┤
│ Manual Input:                   │
│ [________________] [Check In]   │
├─────────────────────────────────┤
│ 📊 856 / 1500 (57.1%)          │
│ [=========>         ]           │
└─────────────────────────────────┘
```

---

## 🔐 Security Notes

1. **Customer endpoint protection:** Backend sudah cek `customerId` vs `user.sub` untuk GET tickets
2. **Admin-only check-in:** Middleware `adminOnly` enforce
3. **QR uniqueness:** `qr_code_value` unique constraint di DB, collision impossible
4. **Event scope enforcement:** Backend validasi `eventId` match dengan tiket order

---

## 📦 Recommended Libraries

### QR Scanner (Frontend)
```bash
npm install html5-qrcode
# atau
npm install @zxing/browser
```

**Sample Code:**
```typescript
import { Html5Qrcode } from 'html5-qrcode';

const scanner = new Html5Qrcode("qr-reader");
scanner.start(
  { facingMode: "environment" },
  { fps: 10, qrbox: 250 },
  async (qrCodeValue) => {
    await checkInTicket(qrCodeValue, eventId);
  }
);
```

### Audio Feedback
```typescript
const ding = new Audio('/sounds/success.mp3');
const buzz = new Audio('/sounds/error.mp3');

// On success:
ding.play();

// On error:
buzz.play();
```

---

## 🧪 Testing Checklist

### Customer Flow
- [ ] Order verified → tiket otomatis muncul di `/my-orders/:id/tickets`
- [ ] QR code tampil dengan benar (scan dengan real phone camera → valid)
- [ ] Download/print e-ticket working
- [ ] Customer tidak bisa akses tiket order lain (403)

### Admin Scanner Flow
- [ ] Pilih event → kamera aktif
- [ ] Scan valid QR → flash hijau + ding + tampil nama customer
- [ ] Scan QR wrong event → flash kuning + buzz + error message
- [ ] Scan QR double → flash kuning + tampil waktu check-in pertama
- [ ] Scan invalid QR → flash merah + buzz
- [ ] Manual input fallback working
- [ ] Live counter update real-time

### Stats Display
- [ ] Angka total, checked-in, remaining akurat
- [ ] Persentase benar (2 decimal places)
- [ ] By-category breakdown match dengan realita
- [ ] Auto-refresh every 5s working

---

## 🚀 Next Steps (Frontend)

1. **Customer Portal:**
   - Buat halaman `/my-orders/:orderId/tickets`
   - Render QR codes dengan `<img src={qrCodeDataUrl}>`
   - Implementasi download/print dengan `html2canvas` + `jspdf`

2. **Admin Scanner:**
   - Buat halaman `/scanner`
   - Integrasi library QR scanner
   - Implementasi visual feedback (flash colors + sound)
   - Fetch event list untuk dropdown selector

3. **Admin Dashboard Stats:**
   - Embed stats widget di halaman `/events/:eventId`
   - Real-time polling (5 detik interval)
   - Optional: WebSocket untuk live update tanpa polling

---

**Backend Ready ✅**  
Contact backend dev jika ada issue atau butuh custom endpoint tambahan.
