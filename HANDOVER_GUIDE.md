# Panduan Serah Terima Sistem — PermitAkaun
**Versi:** 1.0 | **Tarikh:** Februari 2026

---

## Ringkasan

Dokumen ini menerangkan langkah-langkah untuk memindahkan sistem PermitAkaun daripada persekitaran pembangunan semasa kepada akaun GitHub, Vercel, dan Supabase milik klien sendiri.

**Stack teknologi:**
- **Frontend/Backend:** Next.js 14 (App Router)
- **Database + Auth:** Supabase (PostgreSQL)
- **Hosting:** Vercel
- **Pembayaran:** Billplz (production) + CHIP (sandbox)
- **Storage:** Supabase Storage (resit/receipt)

---

## Bahagian A — Tanggungjawab Pembangun (Dev)

### A1. Sediakan Repository GitHub

1. Buat repository baru di GitHub (private atau public — cadangan: **private**)
2. Buka terminal di folder projek:
   ```bash
   git init  # jika belum ada
   git remote add origin https://github.com/[USERNAME_KLIEN]/permitakaun.git
   git add .
   git commit -m "Initial handover commit"
   git push -u origin main
   ```
3. Pastikan fail berikut **TIDAK** disertakan dalam commit (semak `.gitignore`):
   - `.env.local`
   - `.env`
   - `node_modules/`
4. Hantar kepada klien: **URL repository** dan jemput sebagai Collaborator (atau pindahkan ownership)

---

### A2. Eksport Schema & Data Supabase

**Pilihan 1 — Guna Supabase CLI (disyorkan):**
```bash
# Login ke Supabase
npx supabase login

# Eksport schema (struktur jadual, RLS, fungsi, trigger)
npx supabase db dump --db-url "[URL_DB_SEMASA]" -f schema_export.sql

# Eksport data (jika perlu bawa data sedia ada)
npx supabase db dump --db-url "[URL_DB_SEMASA]" --data-only -f data_export.sql
```

**Pilihan 2 — Manual melalui Supabase Dashboard:**
- Pergi ke **Project Settings → Database**
- Guna butang **"Backups"** untuk muat turun backup penuh
- Atau salin semua fail SQL dalam folder `/sql/` — ia mengandungi semua migration schema

> ⚠️ **Penting:** Folder `/supabase/migrations/` dan `/supabase/schema.sql` dalam projek ini sudah mengandungi semua struktur database. Ini adalah sumber utama untuk setup Supabase klien.

---

### A3. Senarai Semua Kunci Rahsia (Secrets)

Hantar kepada klien secara selamat (guna 1Password, Bitwarden, atau encrypted email) maklumat berikut:

| Kunci | Keterangan | Di mana dapat |
|-------|-----------|---------------|
| `NEXT_PUBLIC_SUPABASE_URL` | URL projek Supabase | Supabase Dashboard → Project Settings → API |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Kunci awam Supabase | Supabase Dashboard → Project Settings → API |
| `SUPABASE_SERVICE_ROLE_KEY` | Kunci servis (rahsia) | Supabase Dashboard → Project Settings → API |
| `BILLPLZ_API_KEY` | Production Billplz | Portal Billplz klien |
| `BILLPLZ_X_SIGNATURE` | Signature Billplz | Portal Billplz klien |
| `BILLPLZ_COLLECTION_ID` | ID koleksi Billplz | Portal Billplz klien |
| `BILLPLZ_SANDBOX_*` | Kunci ujian Billplz | Portal Billplz (sandbox) |
| `CHIP_API_KEY` | CHIP payment key | Portal CHIP klien |
| `CHIP_BRAND_ID` | CHIP brand ID | Portal CHIP klien |
| `NEXT_PUBLIC_PAYMENT_MODE` | `live` atau `sandbox` | Set mengikut keperluan |

> 🔐 **JANGAN hantar kunci ini melalui WhatsApp atau email biasa tanpa enkripsi.**

---

## Bahagian B — Tanggungjawab Klien

### B1. Buat Akaun & Setup GitHub

1. Daftar / log masuk di [github.com](https://github.com)
2. Terima jemputan Collaborator daripada pembangun (semak emel)
3. **Opsional (jika mahu ownership penuh):**
   - Minta pembangun **Transfer Repository** kepada akaun klien
   - Pergi ke repository → Settings → Danger Zone → Transfer

---

### B2. Buat Projek Supabase Baharu

1. Pergi ke [supabase.com](https://supabase.com) → Log masuk / Daftar
2. Klik **"New Project"**
3. Isi:
   - **Name:** `permitakaun` (atau nama pilihan)
   - **Database Password:** Simpan password ini — ia tidak boleh diambil semula
   - **Region:** `Southeast Asia (Singapore)` — paling dekat dengan pengguna Malaysia
4. Tunggu projek siap (~2 minit)

#### B2a. Import Schema Database

> ⚠️ **PENTING — RLS (Row Level Security):**
> Semua polisi keselamatan (RLS) terletak dalam fail-fail di folder `/sql/` — **bukan** dalam `supabase/schema.sql` sahaja. Anda **mesti** jalankan fail-fail `/sql/` untuk RLS berfungsi dengan betul.

Setelah projek Supabase siap:

1. Pergi ke **SQL Editor** dalam Supabase Dashboard
2. Buka fail `supabase/schema.sql` daripada repository
3. Copy semua kandungannya → Paste dalam SQL Editor → Klik **Run**
4. **Wajib** jalankan fail-fail SQL dalam folder `/sql/` mengikut urutan berikut (tandakan ✓ selepas selesai):
   - [ ] `create_admins_staff_tables_fixed.sql`
   - [ ] `migrate_transactions_akaun.sql`
   - [ ] `fix_admin_transactions_columns.sql`
   - [ ] `fix_admin_rls_policies.sql`
   - [ ] `fix_transactions_rls_v4.sql`
   - [ ] Lain-lain mengikut keperluan

5. Dapatkan kunci API baharu dari: **Project Settings → API**
   - `Project URL`
   - `anon public key`
   - `service_role key` (klik "Reveal")

#### B2b. Setup Auth (Pengguna)

1. Pergi ke **Authentication → Settings**
2. Tetapkan **Site URL** kepada domain Vercel klien (contoh: `https://permitakaun.vercel.app`)
3. Tambah **Redirect URLs:**
   - `https://permitakaun.vercel.app/**`
   - `http://localhost:3000/**` (untuk development)
4. Pastikan **Email Auth** diaktifkan

#### B2c. Setup Storage

1. Pergi ke **Storage** dalam Supabase Dashboard
2. Buat bucket baharu bernama `receipts` (atau semak nama bucket asal)
3. Set policy: **Authenticated users can upload, public can read**

---

### B3. Deploy ke Vercel

1. Pergi ke [vercel.com](https://vercel.com) → Log masuk / Daftar
2. Klik **"Add New Project"**
3. Pilih **"Import Git Repository"** → Pilih repository GitHub `permitakaun`
4. Vercel akan detect Next.js secara automatik

#### B3a. Tambah Environment Variables

Dalam tetapan Vercel project sebelum deploy, klik **"Environment Variables"** dan tambah semua kunci berikut:

```
NEXT_PUBLIC_SUPABASE_URL          = [dari Supabase]
NEXT_PUBLIC_SUPABASE_ANON_KEY     = [dari Supabase]
SUPABASE_SERVICE_ROLE_KEY         = [dari Supabase]
NEXT_PUBLIC_PAYMENT_MODE          = live
BILLPLZ_API_KEY                   = [dari Billplz]
BILLPLZ_X_SIGNATURE               = [dari Billplz]
BILLPLZ_COLLECTION_ID             = [dari Billplz]
BILLPLZ_SANDBOX_API_KEY           = [dari Billplz sandbox]
BILLPLZ_SANDBOX_X_SIGNATURE       = [dari Billplz sandbox]
BILLPLZ_SANDBOX_COLLECTION_ID     = [dari Billplz sandbox]
CHIP_API_KEY                      = [dari CHIP]
CHIP_BRAND_ID                     = [dari CHIP]
```

5. Klik **"Deploy"**
6. Tunggu build selesai (~3-5 minit)
7. Vercel akan beri URL seperti: `https://permitakaun-xyz.vercel.app`

#### B3b. Domain Custom (Opsional)

Jika klien ada domain sendiri (contoh: `akaun.syarikat.com`):
1. Vercel → Project → Settings → Domains
2. Tambah domain → Ikut arahan DNS yang diberikan
3. Kemaskini **Supabase Auth → Site URL** kepada domain baharu

---

### B4. Kemaskini Webhook Billplz

Setelah URL Vercel diketahui, log masuk ke **portal Billplz** dan kemaskini:
- **Callback URL:** `https://[DOMAIN]/api/billplz/callback`
- **Redirect URL:** `https://[DOMAIN]/payment-success`

---

## Bahagian C — Kemungkinan Downtime & Risiko

| Situasi | Anggaran Masa | Cara Minimakan |
|---------|--------------|----------------|
| Build pertama Vercel | 5–10 minit | Lakukan di luar waktu puncak |
| Import schema Supabase | 5–15 minit | Uji dulu di projek Supabase sandbox |
| Pengguna kena daftar semula | Bergantung pada bilangan user | Eksport user dulu (lihat nota di bawah) |
| Perubahan DNS domain | 1–48 jam (propagation) | Beri notis awal kepada pengguna |
| Billplz webhook tidak kemaskini | Bayaran gagal direkod | Kemaskini webhook segera selepas deploy |

> ⚠️ **PENTING — Data Pengguna (Auth):**
> Supabase **tidak membenarkan eksport password pengguna** atas sebab keselamatan. Ini bermakna:
> - Semua pengguna sedia ada perlu **reset password** atau **daftar semula** di Supabase baharu
> - Gunakan **Supabase Auth → Users → Invite User** untuk jemput semula
> - Atau aktifkan **Magic Link / OTP** supaya pengguna boleh log masuk tanpa password baru

---

## Bahagian D — Semakan Akhir (Checklist)

### Pembangun ✓
- [ ] Repository GitHub diserahkan / akses diberikan
- [ ] Semua kunci rahsia dihantar secara selamat
- [ ] Schema SQL disertakan dalam repository
- [ ] Dokumen ini diserahkan kepada klien

### Klien ✓
- [ ] GitHub — Repository dapat diakses
- [ ] Supabase — Projek baharu dibuat, schema **dan semua fail `/sql/`** berjaya di-import (termasuk RLS)
- [ ] Supabase — Auth Site URL dikemaskini
- [ ] Supabase — Storage bucket `receipts` dibuat
- [ ] Vercel — Environment variables semua diisi
- [ ] Vercel — Build berjaya, app boleh dibuka
- [ ] Billplz — Callback URL dikemaskini
- [ ] Test log masuk sebagai admin
- [ ] Test tambah transaksi
- [ ] Test muat turun laporan PDF
- [ ] Test bayaran (guna sandbox dulu)

---

## Bahagian E — Kos Bulanan Anggaran

| Perkhidmatan | Pelan | Anggaran Kos |
|-------------|-------|-------------|
| GitHub | Free / Pro | Percuma (private repo) — $4/bulan (Pro) |
| Supabase | Free Tier | Percuma sehingga 500MB + 50,000 MAU |
| Supabase | Pro (jika perlu lebih) | $25/bulan |
| Vercel | Hobby / Pro | Percuma (Hobby) — $20/bulan (Pro) |
| Domain (.com/.my) | — | ~RM40–80/tahun |
| **Jumlah minimum** | | **Percuma – RM0/bulan** |
| **Jumlah cadangan** | | **~RM100–200/bulan** |

> 💡 Untuk permulaan, **Free tier Supabase + Vercel Hobby** sudah mencukupi. Naik taraf apabila pengguna aktif melebihi had.

---

## Bahagian F — Transfer Penuh (Cara Paling Selamat)

> ✅ **Ini cara yang disyorkan.** Semua data, pengguna, RLS, storage, dan kod dipindahkan terus — tiada setup semula diperlukan. Sistem terus berfungsi seperti biasa selepas transfer.

**Apa yang dipindahkan:**

- ✅ Semua data (transaksi, penyewa, lokasi)
- ✅ Semua pengguna (termasuk password — satu-satunya cara)
- ✅ RLS policies, triggers, functions
- ✅ Storage buckets + files (resit)
- ✅ Kod aplikasi (Next.js)
- ✅ Environment variables Vercel

**Prasyarat klien:**

- Akaun GitHub
- Akaun Supabase + buat **Organization** (Settings → Organizations → New Org)
- Akaun Vercel

---

### F1. Transfer GitHub Repository

**Pembangun lakukan:**

1. Pergi ke repository GitHub → **Settings** → scroll ke bawah → **Danger Zone**
2. Klik **"Transfer"**
3. Masuk nama repository untuk sahkan → masuk **username GitHub klien**
4. Klik **"I understand, transfer this repository"**

**Klien:**

- Terima jemputan melalui emel dalam masa 7 hari
- Repository akan masuk akaun klien dengan semua history git

---

### F2. Transfer Supabase Project

**Pembangun lakukan:**

1. Pergi ke Supabase Dashboard → **Project Settings** → **General**
2. Scroll ke bahagian **"Transfer project"**
3. Masuk **nama Organization klien** (klien kena buat org dulu)
4. Klik **Transfer**

**Klien:**

- Log masuk Supabase → pergi ke organization mereka
- Terima transfer dalam **Settings → Organization → Pending transfers**
- ✅ Semua data, RLS, auth users, storage — terus ada tanpa setup semula

> ⚠️ URL Supabase dan API keys **tidak berubah** selepas transfer — environment variables Vercel tidak perlu ditukar.

---

### F3. Transfer Vercel Project

**Pembangun lakukan:**

1. Pergi ke Vercel → pilih project **PermitAkaun** → **Settings** → **General**
2. Scroll ke **"Transfer Project"**
3. Masuk akaun/team Vercel klien
4. Klik **Transfer**

**Klien:**

- Terima jemputan dalam Vercel dashboard
- ✅ Semua environment variables ikut sekali — app terus live

**Selepas transfer Vercel:**

- Jika domain berubah, kemaskini **Supabase Auth → Settings → Site URL**
- Kemaskini **Billplz callback URL** ke domain baru

---

### F4. Urutan Yang Betul

```text
1. Transfer GitHub   →  2. Transfer Supabase  →  3. Transfer Vercel
      (5 minit)               (5 minit)               (5 minit)
                                    ↓
                         4. Klien semak Vercel domain
                                    ↓
                    5. Kemaskini Supabase Auth Site URL (jika domain berubah)
                                    ↓
                         6. Kemaskini Billplz webhook
```

> Anggaran downtime: **0** — sistem tidak terputus semasa transfer

---

### F5. Lepas Transfer — Pembangun Remove Akses

Setelah klien sahkan semua berfungsi:

1. **GitHub** — keluarkan diri sebagai collaborator (atau repo sudah dipindahkan)
2. **Supabase** — tiada akses yang tinggal (project sudah di-transfer)
3. **Vercel** — tiada akses yang tinggal (project sudah di-transfer)

---

## Hubungi Pembangun

Sekiranya ada masalah semasa proses handover:

- Dokumen teknikal tambahan ada dalam folder `/sql/` dan `DATABASE_ARCHITECTURE.md`
- Semua migration SQL boleh dijalankan semula dengan selamat (idempotent)

---

*Dokumen ini dijana untuk proses handover PermitAkaun — Februari 2026*
