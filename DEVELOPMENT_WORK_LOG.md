# Development Work Log

> Dokumen ini merakam semua kerja-kerja pembangunan untuk projek Permit Akaun.
> This document records all development work for the Permit Akaun project.

---

## 2026-02-21

### 17:40 - Fixed Payment Redirect Logout Issue & Sejarah Bayaran

**Issues:**
1. Tenants getting logged out after payment when clicking "Kembali ke Halaman Utama"
2. Sejarah Bayaran showing empty despite tenant having paid multiple times

**Root Causes:**
- `router.push()` was not preserving session cookies after external redirect from Billplz
- Code was querying `tenant_transactions` with `is_rent_payment=true`, but rent payments are stored in `tenant_payments` table

**Changes Made:**

1. **`app/payment/status/page.tsx`**
   - Changed from `router.push()` to `window.location.href` for hard redirect
   - Added session refresh via `supabase.auth.refreshSession()` on page mount
   - Changed default redirect path from `/dashboard` to `/dashboard/rentals`

2. **`app/dashboard/rentals/page.tsx`**
   - Changed query from `tenant_transactions` to `tenant_payments` table
   - Updated data mapping for payment fields

3. **`components/rental-module-enhanced.tsx`**
   - Updated `fetchHistory()` to query `tenant_payments`
   - Changed `redirectPath` from `/dashboard?module=rentals&view=history` to `/dashboard/rentals`

**Status:** ✅ Completed

---

### 17:25 - Fixed Admin Lokasi & Permit Tenant Counts

**Issue:** Senarai Peniaga showing (0) for all locations when there are active tenants

**Root Cause:** `fetchLocations()` in dashboard.ts was hardcoding `tenant_count: 0` with comment "to save time"

**Changes Made:**

1. **`utils/data/dashboard.ts`**
   - Replaced hardcoded zero with actual counting logic
   - Queries `tenant_locations` table for active tenants per location
   - Returns accurate `tenant_count` for each location

**Status:** ✅ Completed

---

### 17:10 - Admin Akaun Improvements & Rental Payment Workflow

**Issues:**
1. Admin seeing "Menyemak kelayakan pelan..." when they don't need subscription check
2. Peniaga & Sewa not showing pending rental fee approvals
3. Approved rentals not showing in Organizer's Senarai Transaksi

**Changes Made:**

1. **`components/accounting-module.tsx`**
   - Admins now see "Memuatkan modul..." instead of subscription-related message
   - Separate loading states for privileged roles vs tenants

2. **`components/pending-approvals-combined.tsx`**
   - Added new request type: `rental_payment`
   - Fetches pending payments from `tenant_payments` table
   - Shows payment details: amount, method, tenant, location
   - On approval: updates payment status AND creates `organizer_transactions` record
   - Added fallback to fetch `organizer_id` from `tenant_organizers` if missing
   - Fixed `updated_at` column error (column doesn't exist in tenant_payments)

3. **`components/tenant-list-enhanced.tsx`**
   - Updated pending count to include rental payments
   - Admin: counts all pending payments
   - Organizer: counts payments from their tenants only

**Status:** ✅ Completed

---

### 17:16 - Fixed Lokasi Popup Form Mobile Responsiveness

**Issue:** Lokasi popup form tidak responsif pada mobile - ruang input terlalu kecil dan tumpang tindih.

**Changes Made:**
- File: `components/location-module.tsx`
- Updated DialogContent width: `w-[95vw] sm:w-full sm:max-w-[600px]`
- Added responsive padding: `p-4 sm:p-6`
- Fixed 5 grid layouts from `grid-cols-2` to `grid-cols-1 sm:grid-cols-2`:
  - Tarikh Mula/Tamat (Event dates)
  - Jenis Operasi & Jumlah Lot
  - Hari/Waktu & Bil. Hari
  - Kadar Sewa (Khemah/CBS/Foodtruck)
  - Kadar Bulanan
- Fixed 3 dialogs total with proper mobile viewport settings

**Status:** ✅ Completed

---

### 17:00 - Implemented BREVO API Key Toggle System

**Issue:** BREVO_HAZMAN API key tidak aktif, perlu tukar ke BREVO_SHAFIRA dengan toggle button.

**Changes Made:**

1. **`.env`**
   - Changed `BREVO_API_KEY` to use BREVO_SHAFIRA value (active key)
   - Added comments explaining key status

2. **`lib/email.ts`**
   - Added `apiKeyType` parameter: `'default' | 'shafira' | 'hazman'`
   - Added `getApiKeyInfo()` helper function
   - Updated `sendEmail()` to support key selection

3. **`actions/email.ts`**
   - Added `setEmailApiKeyType()` server action
   - Added `getEmailApiKeyType()` server action
   - Updated all email actions to accept `apiKeyType` parameter
   - System-wide state management for API key selection

4. **`app/testemail/page.tsx`**
   - Added API Key Selector card with 3 toggle options
   - Shows current active key with visual indicators
   - Each email test shows which key was used
   - Added localStorage persistence

**API Key Status:**
- 🟢 BREVO_API_KEY (Default): Using BREVO_SHAFIRA - ACTIVE
- 🔵 BREVO_SHAFIRA: Explicit Shafira key - ACTIVE
- 🔴 BREVO_HAZMAN: Hazman's key - INACTIVE (needs regeneration)

**Status:** ✅ Completed

---

### 16:30 - Added Image Upload Feature for Lokasi

**Issue:** Gambar Lokasi hanya menyokong URL, perlu muat naik terus dari laptop/HP.

**Changes Made:**

1. **`components/location-module.tsx`**
   - Added file upload input with drag-and-drop style
   - Added image preview with remove button (X)
   - File validation: images only (JPG, PNG, GIF, WebP), max 5MB
   - Upload progress indicator with loading spinner
   - Kept URL input as alternative option
   - Added image display on location cards
   - Updated imports: added `Upload`, `X`, `ImageIcon` icons

2. **`sql/setup_location_images_storage.sql`**
   - Created SQL for Supabase Storage bucket setup
   - Bucket name: `locations`
   - RLS policies for upload, read, and delete
   - 5MB file size limit

**Upload Flow:**
1. User clicks upload area
2. File validated (type & size)
3. Uploaded to Supabase Storage `locations` bucket
4. Public URL saved to `locations.image_url`
5. Image preview shown in form

**Setup Required:**
```sql
-- Create Supabase Storage bucket
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('locations', 'locations', true, 5242880, array['image/jpeg', 'image/png', 'image/gif', 'image/webp']);
```

**Status:** ✅ Completed (pending storage bucket creation)

---

### 15:45 - Fixed "Luluskan" Error for Peniaga & Sewa

**Issue:** Error: `"Gagal meluluskan: null value in column "organizer_id" of relation "organizer_transactions" violates not-null constraint"`

**Root Cause:**
- When approving tenant-organizer link, only `tenant_organizers` table was updated
- `tenants.organizer_code` was NOT updated
- Later, `handle_payment_approval()` trigger couldn't find organizer_id (joins on organizer_code)
- NULL organizer_id caused INSERT failure into `organizer_transactions`

**Changes Made:**

1. **`sql/enhanced_tenant_organizer_workflow.sql`**
   - Updated `process_tenant_request()` function
   - Now retrieves `organizer_code` from `organizers` table
   - Updates `tenants.organizer_code` when approving link
   - Added `v_tenant_id` and `v_organizer_code` variables

2. **`components/pending-approvals-combined.tsx`**
   - Updated `handleApprove()` for `organizer_link` type
   - Added fetch for `organizer_id` and `tenant_id`
   - Added update to `tenants.organizer_code` after approval
   - Ensures frontend approval also syncs organizer_code

**SQL Backfill for Existing Data:**
```sql
UPDATE tenants t
SET organizer_code = o.organizer_code
FROM tenant_organizers tor
JOIN organizers o ON o.id = tor.organizer_id
WHERE t.id = tor.tenant_id
AND tor.status IN ('approved', 'active')
AND (t.organizer_code IS NULL OR t.organizer_code = '');
```

**Status:** ✅ Completed

---

### 17:48 - Include Langganan Payments in Admin Transaksi Terkini

**Issue:** Transaksi Terkini in Admin was not showing Langganan (Subscription) payments, even though they are for Admin.

**Changes Made:**

1. **`utils/data/dashboard.ts`**
   - Added fetch for `admin_transactions` table (contains Langganan payments)
   - Combined transactions from both `organizer_transactions` and `admin_transactions`
   - Sorted combined list by date (newest first)
   - Limited to top 50 transactions after combining

**Implementation Details:**
- Admin transactions are formatted with `table_source: 'admin_transactions'`
- Combined with organizer transactions and sorted by date
- Error handling ensures organizer transactions still show if admin fetch fails

**Status:** ✅ Completed and pushed to `Antigravity` branch

---

### 17:50 - Show All Tenants for admin@kumim.my

**Issue:** admin@kumim.my was only seeing tenants from ORG002, should see ALL tenants in Supabase.

**Changes Made:**

1. **`utils/data/dashboard.ts`**
   - Removed `organizer_code = 'ORG002'` filter for admin@kumim.my
   - admin@kumim.my now sees ALL tenants from all organizers
   - admin@kumim.my now sees ALL transactions (not filtered by organizer)
   - Other admins still see tenants except ORG001 (seed data)

**Logic Change:**
```typescript
// Before: admin@kumim.my only saw ORG002 tenants
if (adminOrgCode) {
    tQuery = tQuery.eq('organizer_code', adminOrgCode)  // Filtered to ORG002
}

// After: admin@kumim.my sees ALL tenants (no filter)
// Only non-kumim admins filter out ORG001
if (!adminOrgCode && !isDeveloperAdmin) {
    tQuery = tQuery.neq('organizer_code', 'ORG001')
}
```

**Status:** ✅ Completed and pushed to `Antigravity` branch

---

## Work Summary by Category

### Bug Fixes
| Date | Issue | Status |
|------|-------|--------|
| 2026-02-21 | Fixed payment redirect logout issue | ✅ Fixed |
| 2026-02-21 | Fixed Sejarah Bayaran empty issue | ✅ Fixed |
| 2026-02-21 | Fixed organizer_id null constraint error on approval | ✅ Fixed |
| 2026-02-21 | Fixed Lokasi form mobile responsiveness | ✅ Fixed |
| 2026-02-21 | Fixed Admin Lokasi tenant counts showing 0 | ✅ Fixed |

### New Features
| Date | Feature | Status |
|------|---------|--------|
| 2026-02-21 | Rental payment approval workflow | ✅ Implemented |
| 2026-02-21 | Auto-create organizer transactions on approval | ✅ Implemented |
| 2026-02-21 | Image upload for Lokasi | ✅ Implemented |
| 2026-02-21 | BREVO API key toggle system | ✅ Implemented |
| 2026-02-21 | Include Langganan payments in Transaksi Terkini | ✅ Implemented |
| 2026-02-21 | Show all tenants for admin@kumim.my | ✅ Implemented |

### Files Modified (Today)
- `utils/data/dashboard.ts` - Added admin_transactions fetch, removed ORG002 filter for admin@kumim.my

### Git Commits (Antigravity Branch)
- `39c763d8` - feat: include Langganan payments in Admin Transaksi Terkini
- `fdc4507d` - feat: show all tenants and transactions for admin@kumim.my

---

## Pending Tasks / Known Issues

1. **BREVO_HAZMAN API Key**: Hazman needs to generate new API key from Brevo dashboard
2. **Supabase Storage Bucket**: Need to create `locations` bucket for image uploads
3. **Data Backfill**: Run SQL to fix existing tenants with missing organizer_code

---

## Notes

- All changes tested locally
- SQL migrations need to be applied to production database
- Environment variables updated in `.env`
- Mobile responsiveness tested on viewport < 640px

---

*Last Updated: 2026-02-21 17:52:00+08:00*
