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

## SQL Fix

Run: `sql/fix_database_architecture.sql`

This will:
1. Remove admins/staff/organizers from `tenants` table
2. Keep only actual business tenants
3. Verify proper relationships
