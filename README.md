[README.md](https://github.com/user-attachments/files/25479151/README.md)
# 🏪 PermitAkaun

[![Website](https://img.shields.io/badge/Website-permitakaun.kumim.my-blue)](https://permitakaun.kumim.my/)
[![License](https://img.shields.io/badge/License-MIT-green.svg)](LICENSE)
[![Tech Stack](https://img.shields.io/badge/Tech-Next.js%20%7C%20TypeScript%20%7C%20Supabase-black)]()

> **Sistem Pengurusan Permit PBT & Akaun untuk Peniaga dan Penganjur**

PermitAkaun adalah platform digital yang direka khas untuk membantu peniaga dan penganjur menguruskan permit PBT (Pihak Berkuasa Tempatan), sewaan tapak, dan akaun kewangan dengan lebih cekap dan sistematik.

---

## ✨ Ciri-Ciri Utama

### 📋 Pengurusan Permit & Lokasi
- 🗺️ **Integrasi Google Maps** - Cari dan papar lokasi dengan mudah
- 📍 **Kategori Acara** - Sokongan untuk Expo, Bazar Ramadhan, Bazar Raya, Foodtruck
- 🏢 **Pengurusan Lot** - Urus jumlah lot dan ketersediaan
- 📸 **Muat Naik Gambar** - Lampiran gambar lokasi untuk rujukan

### 💰 Modul Kewangan (7 Tabung)
Sistem akaun berlapis automatik:
- 💼 **Operating** - Perbelanjaan operasi harian
- 🏛️ **Tax** - Tabung cukai
- 🕌 **Zakat** - Tabung zakat perniagaan
- 💎 **Saving** - Tabung simpanan
- 📊 **Pembahagian Automatik** - Agihan dana mengikut peratusan tetap
- 📝 **Penjanaan Dokumen** - Resit, Invois, Payment Voucher automatik

### 👥 Pengurusan Pengguna Multi-Peranan
| Peranan | Penerangan |
|---------|------------|
| **👤 Admin** | Pengurusan keseluruhan sistem, kelulusan permit, laporan |
| **🏢 Organizer** | Penganjur acara, pengurusan lokasi & peniaga |
| **🛒 Tenant** | Peniaga, permohonan permit, pembayaran sewa |
| **👨‍💼 Staff** | Staf organizer, bantu urus transaksi |

### 💳 Sistem Langganan & Bayaran
- 💳 **Payment Gateway** - Integrasi Billplz & Chip-in
- 📦 **Pelan Berperingkat**:
  - 🥉 **RM19/bulan** - Pelan Asas
  - 🥈 **RM39/bulan** - Pelan Standard
  - 🥇 **RM99/bulan** - Pelan Premium
- 🎁 **Tempoh Percubaan** - 14 hari percubaan percuma
- 📧 **Notifikasi Emel** - Makluman automatik via Brevo

### 📊 Dashboard & Laporan
- 📈 **Ringkasan Kutipan** - Paparan visual kutipan harian/bulanan
- ⚠️ **Tunggakan** - Senarai penyewa tertunggak
- 📋 **Sejarah Penyewa** - Rekod penyewaan terdahulu
- 🖨️ **Cetakan Laporan** - Muat turun laporan PDF

---

## 🛠️ Tech Stack

| Kategori | Teknologi |
|----------|-----------|
| **Frontend** | Next.js 14, React, TypeScript, Tailwind CSS |
| **Backend** | Next.js API Routes, Server Actions |
| **Database** | Supabase (PostgreSQL) |
| **Authentication** | Supabase Auth |
| **Payment** | Billplz, Chip-in |
| **Email** | Brevo (Sendinblue) |
| **Maps** | Google Maps API |
| **Hosting** | Vercel |

---

## 🚀 Bermula

### Prasyarat
- Node.js 18+
- pnpm/npm/yarn
- Akaun Supabase
- Akaun Billplz/Chip-in (untuk pembayaran)

### Pemasangan

```bash
# 1. Klon repositori
git clone https://github.com/webdevsha/permitakaun-6608e2f.git
cd permitakaun-6608e2f

# 2. Pasang dependencies
pnpm install

# 3. Tetapkan environment variables
cp .env.example .env.local

# 4. Isi environment variables berikut:
# - NEXT_PUBLIC_SUPABASE_URL
# - NEXT_PUBLIC_SUPABASE_ANON_KEY
# - SUPABASE_SERVICE_ROLE_KEY
# - BILLPLZ_API_KEY
# - BILLPLZ_X_SIGNATURE
# - BREVO_API_KEY

# 5. Jalankan server pembangunan
pnpm dev
```

Aplikasi akan berjalan di `http://localhost:3000`

---

## 📁 Struktur Projek

```
permitakaun-6608e2f/
├── app/                    # Next.js App Router
│   ├── (dashboard)/        # Dashboard routes (protected)
│   ├── api/                # API routes
│   ├── bayar/              # Payment pages
│   └── login/              # Authentication
├── components/             # React components
│   ├── ui/                 # UI components (shadcn)
│   └── modules/            # Feature modules
├── lib/                    # Utilities & helpers
├── types/                  # TypeScript types
├── supabase/               # Supabase migrations & SQL
├── scripts/                # Utility scripts
└── public/                 # Static assets
```

---

## 🗄️ Skema Database

### Jadual Utama
- `profiles` - Profil pengguna (Admin, Organizer, Tenant, Staff)
- `locations` - Lokasi acara/tapak
- `rentals` - Rekod sewaan
- `transactions` - Transaksi kewangan
- `organizer_tenants` - Hubungan organizer-tenant (many-to-many)
- `subscriptions` - Langganan pengguna
- `payments` - Rekod pembayaran

### Ciri Keselamatan
- 🔒 **RLS Policies** - Row Level Security untuk data isolation
- 🛡️ **Role-based Access** - Kawalan akses berdasarkan peranan
- 🔐 **Encrypted Data** - Data sensitif dienkripsi

---

## 📸 Screenshots

| Dashboard | Modul Akaun | Pengurusan Lokasi |
|-----------|-------------|-------------------|
| ![Dashboard](docs/images/dashboard.png) | ![Akaun](docs/images/akaun.png) | ![Lokasi](docs/images/lokasi.png) |

---

## 📝 Dokumentasi

- [📋 DEVELOPMENT_WORK_LOG](DEVELOPMENT_WORK_LOG.md) - Log kerja pembangunan
- [🏗️ DATABASE_ARCHITECTURE](DATABASE_ARCHITECTURE.md) - Arkitektur pangkalan data
- [🔗 DATABASE_RELATIONSHIPS](DATABASE_RELATIONSHIPS.md) - Hubungan jadual
- [👥 TENANT_ORGANIZER_WORKFLOW](TENANT_ORGANIZER_WORKFLOW.md) - Aliran kerja

---

## 🤝 Penyumbang

Projek ini dibangunkan oleh:

**[webdevsha](https://github.com/webdevsha)** - Pembangun Utama

---

## 📄 Lesen

Projek ini dilesenkan di bawah [MIT License](LICENSE).

---

## 📞 Hubungi Kami

- 🌐 **Website:** [permitakaun.kumim.my](https://permitakaun.kumim.my/)
- 📧 **Email:** hai@shafiranoh.com
- 💬 **WhatsApp:** [Hubungi Kami](https://wa.me/60123456789)

---

<p align="center">
  Dibuat dengan ❤️ untuk komuniti peniaga Malaysia
</p>
