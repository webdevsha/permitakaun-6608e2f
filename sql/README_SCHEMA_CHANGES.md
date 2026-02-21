# Schema Changes for Latest Features

## File: `schema_update_2025_02_04.sql`

This SQL file contains all the database schema changes required for the recent feature updates.

---

## Changes Included:

### 1. **accounting_config table** - Add `bank_names` JSONB column
- **Purpose:** Store individual bank names for each of the 7 tabungs
- **Type:** JSONB with default empty object
- **Structure:** 
  ```json
  {
    "operating": "Maybank Business",
    "tax": "LHDN",
    "zakat": "Pusat Pungutan Zakat",
    "investment": "CIMB Investment",
    "dividend": "RHB Bank",
    "savings": "Tabung Haji",
    "emergency": "Maybank Savings"
  }
  ```
- **Used in:** Accounting module - each tabung can have its own bank destination
- **Note:** Replaces the old single `bank_name` column (if it existed)

### 2. **locations table** - Add monthly rate columns
- **Columns added:**
  - `rate_monthly_khemah` (NUMERIC, default 0) - Monthly rate for Khemah stalls
  - `rate_monthly_cbs` (NUMERIC, default 0) - Monthly rate for CBS stalls
- **Purpose:** Allow monthly locations to have different rates for different stall types
- **Used in:** Location creation/edit dialog and rental flow

### 3. **RLS Policy Updates**
- Ensures `accounting_config` table has proper Row Level Security
- Users can only access their own config
- Admins can view all configs

---

## How to Run

### Option 1: Using Supabase Dashboard (Recommended)

1. Go to your Supabase project dashboard
2. Navigate to **SQL Editor** (left sidebar)
3. Click **New Query**
4. Copy the entire contents of `sql/schema_update_2025_02_04.sql`
5. Paste into the SQL editor
6. Click **Run**

### Option 2: Using psql CLI

```bash
# Set your Supabase database URL
DATABASE_URL="postgresql://postgres:[YOUR-PASSWORD]@db.[YOUR-PROJECT-REF].supabase.co:5432/postgres"

# Run the SQL file
psql "$DATABASE_URL" -f sql/schema_update_2025_02_04.sql
```

### Option 3: Using Supabase CLI

```bash
# Link your project (if not already linked)
supabase link --project-ref [YOUR-PROJECT-REF]

# Execute the SQL file
supabase db execute --file sql/schema_update_2025_02_04.sql
```

---

## Verification

After running the SQL, verify the changes:

```sql
-- Check accounting_config columns
SELECT column_name, data_type, is_nullable 
FROM information_schema.columns 
WHERE table_name = 'accounting_config';

-- Expected columns: id, profile_id, percentages, bank_names, created_at, updated_at

-- Check bank_names sample data
SELECT profile_id, bank_names 
FROM accounting_config 
LIMIT 5;

-- Check locations table rate columns
SELECT column_name, data_type, column_default
FROM information_schema.columns 
WHERE table_name = 'locations' 
AND column_name LIKE 'rate%';

-- Expected: rate_khemah, rate_cbs, rate_monthly, rate_monthly_khemah, rate_monthly_cbs
```

---

## Troubleshooting

### Error: "column already exists"
This is normal - the SQL uses `IF NOT EXISTS` checks, so it's safe to run multiple times.

### Error: "permission denied"
Make sure you're running as the `postgres` user or a user with schema modification privileges.

### Migrating from old single bank_name column
If you previously ran the SQL with the single `bank_name` column, the script will:
1. Drop the old `bank_name` column
2. Create the new `bank_names` JSONB column

You can uncomment the backfill section in the SQL to migrate old data:
```sql
UPDATE accounting_config 
SET bank_names = jsonb_set(
    COALESCE(bank_names, '{}'::jsonb),
    '{operating}',
    to_jsonb(bank_name)
)
WHERE bank_name IS NOT NULL;
```

---

## Related Application Changes

These database changes support the following frontend changes:

1. **Accounting Module** (`components/accounting-module.tsx`)
   - Fetches and saves `bank_names` JSONB from `accounting_config`
   - Each of the 7 tabungs has its own editable bank name
   - Display shows bank name under each tabung amount
   
2. **Location Module** (`components/location-module.tsx`)
   - Uses `rate_monthly_khemah` and `rate_monthly_cbs` for monthly locations
   
3. **Auth Provider** (`components/providers/auth-provider.tsx`)
   - Logout now redirects to `/login` instead of `/`
