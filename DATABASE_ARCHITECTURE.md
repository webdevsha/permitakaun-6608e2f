# Database Architecture

## Problem
The `tenants` table contains mixed data:
- ❌ Admins (admin@kumim.my, admin@permit.com)
- ❌ Staff (manjaya.solution@gmail.com)
- ❌ Organizers (organizer@permit.com)
- ✅ Actual businesses (Siti Aminah, Ahmad, etc.)

## Solution: Proper Table Separation

### Table: `profiles` (Users)
All users regardless of role:

| email | full_name | role | organizer_code |
|-------|-----------|------|----------------|
| admin@permit.com | Admin Permit | admin | ORG001 |
| staff@permit.com | Staff Permit | staff | ORG001 |
| admin@kumim.my | Hazman | admin | ORG002 |
| manjaya.solution@gmail.com | Staff Encik Hazman | staff | ORG002 |
| organizer@permit.com | Demo Organizer | organizer | ORG001 |
| siti@permit.com | Siti Aminah | tenant | ORG001 |
| ahmad@permit.com | Ahmad | tenant | ORG002 |

### Table: `tenants` (Businesses ONLY)
Only actual business tenants:

| id | full_name | business_name | organizer_code | profile_id |
|----|-----------|---------------|----------------|------------|
| 12 | Siti Aminah | Siti Kuih | ORG001 | (links to siti@permit.com) |
| 3 | Ahmad | Ahmad Gadget | ORG002 | (links to ahmad@permit.com) |
| ... | ... | ... | ... | ... |

**NO admins, NO staff, NO organizers in this table!**

### Table: `organizers` (Organizations)

| id | name | organizer_code | profile_id |
|----|------|----------------|------------|
| 1 | Persatuan Peniaga Gombak | ORG001 | (admin@permit.com) |
| 2 | Hazman Enterprise | ORG002 | (admin@kumim.my) |

### Table: `locations` (Market Locations)

| id | name | organizer_id | rate_khemah |
|----|------|--------------|-------------|
| 1 | Pasar Malam Gombak | 1 | 50 |
| 2 | Bazaar Ramadan | 2 | 60 |

### Table: `tenant_locations` (Rentals)
Links tenants to locations:

| id | tenant_id | location_id | rate_type | status |
|----|-----------|-------------|-----------|--------|
| 1 | 12 | 1 | khemah | active |
| 2 | 3 | 2 | khemah | active |

## Data Flow

```
Admin (admin@kumim.my)
    ├── Organizer: Hazman Enterprise (ORG002)
    │       ├── Locations: Jalan Kebun, Pasar Malam Bandar Baru
    │       └── Tenants: Ahmad (tenant)
    └── Staff: manjaya.solution@gmail.com
            └── Can see all ORG002 data
```

## Key Relationships

1. **Admin → Organizer**: `profiles.organizer_code` = `organizers.organizer_code`
2. **Staff → Admin**: `profiles.organizer_code` matches their admin's
3. **Tenant → Organizer**: `tenants.organizer_code` = `organizers.organizer_code`
4. **Tenant → Location**: via `tenant_locations` table

## Akaun (Transactions) Architecture

Each role has their own transaction table for clear financial tracking:

```
┌─────────────────────────────────────────────────────────────────────────┐
│                        AKaun TRANSACTION TABLES                         │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                         │
│   ┌─────────────────────┐                                               │
│   │  admin_transactions │  Platform admin financial records             │
│   │  - admin_id (FK)    │                                               │
│   │  - reference_type   │  'organizer' | 'tenant' | 'platform'          │
│   └─────────────────────┘                                               │
│                                                                         │
│   ┌─────────────────────────┐                                           │
│   │  organizer_transactions │  Organizer's Akaun (INCOME focused)       │
│   │  - organizer_id (FK)    │                                           │
│   │  - tenant_id (FK)       │  Link to paying tenant                    │
│   │  - type: 'income'       │  Rent from tenants = INCOME               │
│   │  - type: 'expense'      │  Org expenses                             │
│   └─────────────────────────┘                                           │
│                                                                         │
│   ┌─────────────────────┐                                               │
│   │  tenant_transactions│  Tenant's Akaun (EXPENSE focused)             │
│   │  - tenant_id (FK)   │                                           │
│   │  - organizer_id(FK) │  Link to organizer                          │
│   │  - type: 'expense'  │  Rent payments = EXPENSE                    │
│   │  - type: 'income'   │  Refunds                                    │
│   │  - is_rent_payment  │  TRUE for rental payments                   │
│   └─────────────────────┘                                               │
│                                                                         │
└─────────────────────────────────────────────────────────────────────────┘
```

### Rent Payment Flow Example

When Tenant "Ahmad" pays RM 100 rent to Organizer "Hazman Enterprise":

```
Ahmad pays RM 100
      │
      ├──► tenant_transactions (Ahmad's Akaun)
      │      type: 'expense'
      │      amount: 100
      │      is_rent_payment: true
      │      status: 'approved'
      │
      └──► organizer_transactions (Hazman's Akaun)
             type: 'income'
             amount: 100
             is_auto_generated: true
             status: 'approved'
```

This ensures:
- ✅ Ahmad sees RM 100 expense in his Akaun
- ✅ Hazman sees RM 100 income in his Akaun
- ✅ Clear separation - no confusion about transaction types
- ✅ Proper RLS - each sees only their own records

See `AKAUN_TRANSACTIONS.md` for full details.

## SQL Fix

Run: `sql/fix_database_architecture.sql`

This will:
1. Remove admins/staff/organizers from `tenants` table
2. Keep only actual business tenants
3. Verify proper relationships
