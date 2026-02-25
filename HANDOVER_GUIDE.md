# Panduan Serah Terima Sistem — PermitAkaun

**Versi:** 2.0 | **Tarikh:** Februari 2026

---

## Ringkasan

Dokumen ini menerangkan proses pemindahan sistem PermitAkaun daripada akaun pembangun kepada akaun klien sepenuhnya.

**Pendekatan:** Transfer GitHub + Transfer Supabase + Recreate Vercel (Hobby — percuma)

**Domain:** `permitakaun.kumim.my` — domain kekal sama, tiada perubahan pada Supabase Auth atau Billplz webhook

**Stack teknologi:**

- **Frontend/Backend:** Next.js 14 (App Router)
- **Database + Auth:** Supabase (PostgreSQL)
- **Hosting:** Vercel
- **Pembayaran:** Billplz (production) + CHIP (sandbox)
- **Storage:** Supabase Storage (resit/receipt)

---

## Bahagian A — Proses Transfer Penuh

> ✅ **Cara paling selamat.** Semua data, pengguna (dengan password), RLS, storage, dan kod dipindahkan terus. Sistem tidak akan terputus semasa proses transfer.

**Apa yang dipindahkan:**

- ✅ Semua data (transaksi, penyewa, lokasi)
- ✅ Semua pengguna termasuk password — tiada daftar semula
- ✅ RLS policies, triggers, functions
- ✅ Storage buckets + files (resit)
- ✅ Kod aplikasi penuh (Next.js)

**Prasyarat klien sebelum mula:**

- Akaun GitHub (daftar di [github.com](https://github.com))
- Akaun Supabase + buat **Organization** (Settings → Organizations → New Organization)
- Akaun Vercel (daftar di [vercel.com](https://vercel.com) — Hobby plan, percuma)

---

### A1. Transfer GitHub Repository

**Pembangun lakukan:**

1. Pergi ke repository GitHub → **Settings** → scroll ke bawah → **Danger Zone**
2. Klik **"Transfer repository"**
3. Masuk nama repository untuk sahkan → masuk **username GitHub klien**
4. Klik **"I understand, transfer this repository"**

**Klien:**

- Semak emel → terima jemputan dalam masa 7 hari
- Repository akan masuk akaun klien dengan semua history git

---

### A2. Transfer Supabase Project

**Pembangun lakukan:**

1. Pergi ke Supabase Dashboard → **Project Settings** → **General**
2. Scroll ke **"Transfer project"**
3. Masuk **nama Organization klien** (klien mesti buat org dulu)
4. Klik **Transfer**

**Klien:**

- Log masuk Supabase → pergi ke organization mereka
- Terima transfer: **Settings → Organization → Pending transfers**
- ✅ Semua data, RLS, pengguna, storage — terus ada, tiada setup semula

> ⚠️ URL Supabase dan API keys **tidak berubah** selepas transfer. Environment variables tidak perlu ditukar.

---

### A3. Recreate Vercel Project (Baru, Hobby — Percuma)

> Vercel project transfer memerlukan plan Pro. Oleh itu, klien buat project Vercel baru sendiri — lebih mudah dan percuma.

**Klien lakukan:**

1. Log masuk [vercel.com](https://vercel.com) → klik **"Add New Project"**
2. Pilih **"Import Git Repository"** → pilih repository `permitakaun` (yang sudah di-transfer)
3. Vercel akan detect Next.js secara automatik
4. Sebelum deploy, klik **"Environment Variables"** dan tambah semua kunci:

```env
NEXT_PUBLIC_SUPABASE_URL          = [sama seperti sebelum — Supabase tidak berubah]
NEXT_PUBLIC_SUPABASE_ANON_KEY     = [sama seperti sebelum]
SUPABASE_SERVICE_ROLE_KEY         = [sama seperti sebelum]
NEXT_PUBLIC_PAYMENT_MODE          = live
BILLPLZ_API_KEY                   = [dari portal Billplz klien]
BILLPLZ_X_SIGNATURE               = [dari portal Billplz klien]
BILLPLZ_COLLECTION_ID             = [dari portal Billplz klien]
BILLPLZ_SANDBOX_API_KEY           = [dari portal Billplz sandbox]
BILLPLZ_SANDBOX_X_SIGNATURE       = [dari portal Billplz sandbox]
BILLPLZ_SANDBOX_COLLECTION_ID     = [dari portal Billplz sandbox]
CHIP_API_KEY                      = [dari portal CHIP klien]
CHIP_BRAND_ID                     = [dari portal CHIP klien]
```

5. Klik **"Deploy"** → tunggu ~3–5 minit
6. Vercel beri URL sementara: `https://permitakaun-[xyz].vercel.app` — guna ini untuk test dulu

**Test app di URL sementara, setelah berpuas hati — pindah domain:**

1. Vercel project baru → **Settings → Domains** → tambah `permitakaun.kumim.my`
2. Vercel akan beri arahan DNS (biasanya CNAME atau A record)
3. Pergi ke panel domain registrar (tempat `kumim.my` didaftarkan) → kemaskini rekod DNS mengikut arahan Vercel
4. Dalam masa 1–15 minit, `permitakaun.kumim.my` akan hala ke Vercel baru
5. Padam domain `permitakaun.kumim.my` dari Vercel lama (project pembangun)

> ✅ **Supabase Auth Site URL tidak perlu ditukar** — domain kekal `permitakaun.kumim.my`

---

### A4. Billplz Webhook — Tiada Perubahan Diperlukan

> ✅ Domain `permitakaun.kumim.my` kekal sama. Billplz Callback URL dan Redirect URL **tidak perlu dikemaskini**.

Semak sahaja bahawa rekod dalam portal Billplz sudah menunjuk kepada:

- **Callback URL:** `https://permitakaun.kumim.my/api/billplz/callback`
- **Redirect URL:** `https://permitakaun.kumim.my/payment-success`

---

### F5. Urutan Yang Betul

```text
PEMBANGUN:                          KLIEN:
──────────────────────────────────────────────────────
1. Transfer GitHub (5 min)    →  Terima di emel
2. Transfer Supabase (5 min)  →  Terima di Supabase org
                                 3. Buat Vercel project baru
                                 4. Tambah semua env vars
                                 5. Deploy → test di URL sementara (*.vercel.app)
                                 6. Pindah domain permitakaun.kumim.my ke Vercel baru
──────────────────────────────────────────────────────
7. Pembangun padam domain dari Vercel lama + padam project
```

> Anggaran downtime: **~1–15 minit** semasa DNS dipindahkan (langkah 6)
> Supabase Auth URL dan Billplz webhook — **tiada perubahan**

---

### A6. Lepas Transfer — Pembangun Remove Akses

Setelah klien sahkan semua berfungsi:

1. **GitHub** — repo sudah dipindahkan, tiada akses pembangun yang tinggal
2. **Supabase** — project sudah di-transfer, tiada akses pembangun yang tinggal
3. **Vercel lama** — padam project lama di akaun pembangun (atau biarkan expired)

---

## Bahagian B — Tanggungjawab Pembangun & Klien

### B1. Pembangun — Sebelum Transfer

**Sediakan kod:**

1. Pastikan semua perubahan terkini sudah di-commit dan push ke GitHub:

   ```bash
   git add .
   git commit -m "Final handover commit"
   git push origin main
   ```

2. Pastikan fail berikut **tidak** dalam repository (semak `.gitignore`):
   - `.env.local` / `.env`
   - `node_modules/`

**Hantar kunci rahsia kepada klien (secara selamat — guna 1Password, Bitwarden, atau encrypted channel):**

| Kunci | Di mana dapat |
| ----- | ------------- |
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase → Project Settings → API |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Supabase → Project Settings → API |
| `SUPABASE_SERVICE_ROLE_KEY` | Supabase → Project Settings → API (klik Reveal) |
| `BILLPLZ_API_KEY` + `X_SIGNATURE` + `COLLECTION_ID` | Portal Billplz klien sendiri |
| `CHIP_API_KEY` + `CHIP_BRAND_ID` | Portal CHIP klien sendiri |

> 🔐 JANGAN hantar kunci melalui WhatsApp atau emel biasa. Gunakan kaedah yang disulitkan.

**Hantar kepada klien:**

- [ ] Dokumen handover ini
- [ ] Semua kunci rahsia (via secure channel)
- [ ] Akses ke portal Billplz dan CHIP (jika klien belum ada)

---

### B2. Klien — Sediakan Akaun

Sebelum pembangun mulakan transfer, klien perlu:

- [ ] Daftar / log masuk [github.com](https://github.com)
- [ ] Daftar / log masuk [supabase.com](https://supabase.com) → buat **Organization** baharu
- [ ] Daftar / log masuk [vercel.com](https://vercel.com) (Hobby plan — percuma)
- [ ] Pastikan ada akses ke portal **Billplz** dan **CHIP** sendiri

---

### B3. Klien — Selepas Terima Transfer

Setelah GitHub dan Supabase berjaya di-transfer (ikut langkah A3–A4 di atas):

- [ ] Buat Vercel project baru, tambah env vars, deploy
- [ ] Test app di URL sementara `*.vercel.app` — pastikan semua berfungsi
- [ ] Pindah domain `permitakaun.kumim.my` ke Vercel baru (kemaskini DNS)
- [ ] Sahkan kepada pembangun bahawa semua OK → pembangun padam Vercel lama

---

## Bahagian C — Kemungkinan Downtime & Risiko

| Situasi | Anggaran Masa | Cara Minimakan |
|---------|--------------|----------------|
| Transfer GitHub | < 1 minit | Tiada downtime |
| Transfer Supabase | < 1 minit | Tiada downtime |
| Vercel baru (build pertama) | 5–10 minit | Test di URL sementara dulu |
| Pindah DNS domain ke Vercel baru | 1–15 minit | Lakukan di luar waktu puncak |
| Supabase Auth URL | Tiada perubahan | Domain kekal `permitakaun.kumim.my` |
| Billplz webhook | Tiada perubahan | Domain kekal `permitakaun.kumim.my` |

> ✅ **Pengguna tidak perlu daftar semula.** Kerana Supabase di-transfer (bukan dibuat baru), semua pengguna dan password kekal seperti sedia ada.

---

## Bahagian D — Semakan Akhir (Checklist)

### Pembangun

- [ ] Kod terkini sudah di-push ke GitHub
- [ ] Kunci rahsia dihantar secara selamat kepada klien
- [ ] Dokumen handover ini diserahkan kepada klien
- [ ] Transfer GitHub berjaya
- [ ] Transfer Supabase berjaya
- [ ] Vercel lama dipadam selepas klien sahkan OK

### Klien

- [ ] Akaun GitHub, Supabase (dengan org), dan Vercel sudah sedia
- [ ] GitHub — repository diterima dan boleh diakses
- [ ] Supabase — transfer diterima, data dan pengguna masih ada
- [ ] Vercel — project baru berjaya deploy, app boleh dibuka di URL sementara
- [ ] Domain `permitakaun.kumim.my` dipindahkan ke Vercel baru, app boleh dibuka di domain asal
- [ ] Supabase Auth — tiada perubahan diperlukan (domain sama)
- [ ] Billplz — tiada perubahan diperlukan (domain sama)
- [ ] Test: Log masuk sebagai admin ✓
- [ ] Test: Tambah dan edit transaksi ✓
- [ ] Test: Muat turun laporan PDF ✓
- [ ] Test: Bayaran sandbox (Billplz/CHIP) ✓
- [ ] Sahkan kepada pembangun — serah terima selesai ✓

---

## Bahagian E — Kos Bulanan Anggaran

| Perkhidmatan | Pelan | Anggaran Kos |
|-------------|-------|-------------|
| GitHub | Free | Percuma (private repo) |
| Supabase | Free Tier | Percuma sehingga 500MB + 50,000 MAU |
| Supabase | Pro (jika perlu lebih) | ~RM120/bulan ($25) |
| Vercel | Hobby | **Percuma** |
| Vercel | Pro (jika perlu lebih) | ~RM95/bulan ($20) |
| Domain (.com/.my) | — | ~RM40–80/tahun |
| **Minimum (permulaan)** | | **RM 0 / bulan** |
| **Cadangan (pengguna aktif)** | | **~RM120–215/bulan** |

> 💡 Free tier Supabase + Vercel Hobby sudah mencukupi untuk permulaan. Naik taraf apabila pengguna aktif melebihi had free tier.

---

## Hubungi Pembangun

Sekiranya ada masalah semasa atau selepas proses handover:

- Dokumentasi teknikal ada dalam folder `/sql/` dan `DATABASE_ARCHITECTURE.md`
- Semua migration SQL boleh dijalankan semula dengan selamat (idempotent)

---

Panduan Serah Terima PermitAkaun — Februari 2026
