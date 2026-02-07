# Akaun Transactions Architecture

## Overview

To avoid confusion and provide clear financial tracking for different user roles, the transaction system has been split into **three separate Akaun (accounting) tables**:

1. **`admin_transactions`** - Platform administrator transactions
2. **`organizer_transactions`** - Organizer's Akaun (income from tenants)
3. **`tenant_transactions`** - Tenant's Akaun (expenses/payments)

## Why This Separation?

### Problem with Single Table
- **Conflicting Types**: A rent payment is an **expense** for the tenant but **income** for the organizer
- **Confusing Views**: Tenants and organizers seeing each other's financial data
- **Data Integrity**: Hard to enforce proper access control

### Solution: Three Separate Ledgers
Each role has their own clear financial record:

```
┌─────────────────────────────────────────────────────────────────┐
│                    RENT PAYMENT FLOW                            │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│   Tenant pays RM 100                                            │
│        │                                                        │
│        ▼                                                        │
│   ┌─────────────────┐        ┌─────────────────┐               │
│   │  tenant_transactions   │        │ organizer_transactions │               │
│   ├─────────────────┤        ├─────────────────┤               │
│   │ Type: EXPENSE   │        │ Type: INCOME    │               │
│   │ Amount: RM 100  │        │ Amount: RM 100  │               │
│   │ Category: Sewa  │        │ Category: Sewa  │               │
│   │ Status: Approved│        │ Status: Approved│               │
│   └─────────────────┘        └─────────────────┘               │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

## Table Schemas

### 1. admin_transactions

For platform administrators to track:
- Platform subscription fees from organizers
- Platform expenses
- Commission income
- Refunds and adjustments

| Column | Type | Description |
|--------|------|-------------|
| `id` | SERIAL PK | Unique identifier |
| `admin_id` | UUID FK → auth.users | Admin who created/owns this |
| `profile_id` | UUID FK → profiles | Related profile |
| `amount` | DECIMAL(10,2) | Transaction amount |
| `type` | VARCHAR(20) | 'income' or 'expense' |
| `category` | VARCHAR(50) | Category (e.g., 'Subscription', 'Commission') |
| `status` | VARCHAR(20) | 'pending', 'approved', 'rejected' |
| `date` | DATE | Transaction date |
| `description` | TEXT | Transaction details |
| `receipt_url` | TEXT | Receipt/proof URL |
| `reference_id` | INTEGER | Related record ID |
| `reference_type` | VARCHAR(20) | 'organizer', 'tenant', 'platform' |
| `is_sandbox` | BOOLEAN | Test transaction flag |

### 2. organizer_transactions

For organizers to track:
- Rent income from tenants
- Organizer expenses (maintenance, utilities)
- Commission fees
- Other income/expenses

| Column | Type | Description |
|--------|------|-------------|
| `id` | SERIAL PK | Unique identifier |
| `organizer_id` | UUID FK → organizers | Organizer who owns this **(REQUIRED)** |
| `tenant_id` | INTEGER FK → tenants | Related tenant (if rent payment) |
| `location_id` | INTEGER FK → locations | Related location/market |
| `amount` | DECIMAL(10,2) | Transaction amount |
| `type` | VARCHAR(20) | 'income' or 'expense' |
| `category` | VARCHAR(50) | Category (e.g., 'Sewa', 'Maintenance') |
| `status` | VARCHAR(20) | 'pending', 'approved', 'rejected' |
| `date` | DATE | Transaction date |
| `description` | TEXT | Transaction details |
| `receipt_url` | TEXT | Receipt/proof URL |
| `payment_reference` | VARCHAR(100) | Billplz/CHIP reference |
| `is_auto_generated` | BOOLEAN | Auto-created from payment |
| `is_sandbox` | BOOLEAN | Test transaction flag |
| `metadata` | JSONB | Flexible additional data |

### 3. tenant_transactions

For tenants to track:
- Rent payments (expenses)
- Refunds (income)
- Other fees

| Column | Type | Description |
|--------|------|-------------|
| `id` | SERIAL PK | Unique identifier |
| `tenant_id` | INTEGER FK → tenants | Tenant who owns this **(REQUIRED)** |
| `profile_id` | UUID FK → profiles | Linked user account |
| `organizer_id` | UUID FK → organizers | Related organizer |
| `location_id` | INTEGER FK → locations | Related location/market |
| `amount` | DECIMAL(10,2) | Transaction amount |
| `type` | VARCHAR(20) | 'income' or 'expense' |
| `category` | VARCHAR(50) | Category (e.g., 'Sewa', 'Refund') |
| `status` | VARCHAR(20) | 'pending', 'approved', 'rejected' |
| `date` | DATE | Transaction date |
| `description` | TEXT | Transaction details |
| `receipt_url` | TEXT | Receipt/proof URL |
| `payment_reference` | VARCHAR(100) | Billplz/CHIP reference |
| `is_rent_payment` | BOOLEAN | This is a rental payment |
| `is_sandbox` | BOOLEAN | Test transaction flag |
| `metadata` | JSONB | Flexible additional data |

## Access Control (RLS Policies)

### Admin Transactions
- **Who can access**: Users with `role = 'admin'` in profiles table
- **Access level**: Full CRUD

### Organizer Transactions
- **Who can access**: 
  - The organizer who owns the record
  - Staff members of that organizer
- **Access level**: Full CRUD for own records

### Tenant Transactions
- **Who can access**:
  - The tenant (via `profile_id` link)
  - The organizer of the tenant (for verification)
- **Access level**: Tenants can view only their own; organizers can view their tenants'

## Auto-Transaction Creation

When a tenant payment is approved via `tenant_payments` table, the system automatically creates:

1. **Tenant Transaction** (expense)
   - Type: 'expense'
   - Category: 'Sewa'
   - `is_rent_payment`: true

2. **Organizer Transaction** (income)
   - Type: 'income'
   - Category: 'Sewa'
   - `is_auto_generated`: true

```sql
-- Trigger: handle_payment_approval()
-- Automatically creates both records when payment status = 'approved'
```

## Helper Functions

### Get Tenant Akaun Summary
```sql
SELECT * FROM get_tenant_akaun_summary(p_tenant_id INTEGER);
-- Returns: total_income, total_expense, balance, pending_payments
```

### Get Organizer Akaun Summary
```sql
SELECT * FROM get_organizer_akaun_summary(p_organizer_id UUID);
-- Returns: total_income, total_expense, balance, pending_income
```

## Migration Notes

### From Old `transactions` Table
1. Original table renamed to `transactions_backup`
2. Data migrated to both `tenant_transactions` and `organizer_transactions`
3. A view `transactions` created for backward compatibility
4. **Action Required**: Update your code to use the new table names

### Code Migration Guide

| Old Code | New Code |
|----------|----------|
| `supabase.from('transactions').select('*')` | `supabase.from('tenant_transactions').select('*')` (for tenant view) |
| | `supabase.from('organizer_transactions').select('*')` (for organizer view) |
| `type: 'expense'` for rent | Keep as `type: 'expense'` in `tenant_transactions` |
| `type: 'income'` for rent | Use `type: 'income'` in `organizer_transactions` |

## TypeScript Types

```typescript
import { 
  AdminTransaction, 
  OrganizerTransaction, 
  TenantTransaction,
  TenantAkaunSummary,
  OrganizerAkaunSummary 
} from '@/types/supabase-types'
```

## SQL Migration File

Run this file to set up the new architecture:
```bash
sql/migrate_transactions_akaun.sql
```

## Testing Checklist

- [ ] Tenant can view only their own transactions
- [ ] Organizer can view their income from tenants
- [ ] Staff can view organizer's transactions
- [ ] Admin can view admin_transactions
- [ ] Payment approval creates both tenant and organizer records
- [ ] RLS policies prevent unauthorized access
- [ ] Summary functions return correct totals
