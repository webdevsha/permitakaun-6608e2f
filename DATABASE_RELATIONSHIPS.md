# Database Relationships

## New Table Structure

```
┌─────────────────┐     ┌─────────────────┐     ┌─────────────────┐
│     profiles    │     │     admins      │     │      staff      │
│   (Auth Users)  │────▶│  (Admin Data)   │◀────│  (Staff Data)   │
├─────────────────┤     ├─────────────────┤     ├─────────────────┤
│ id (PK)         │     │ id (PK)         │     │ id (PK)         │
│ email           │     │ profile_id (FK) │     │ profile_id (FK) │
│ role            │     │ organizer_code  │     │ admin_id (FK)   │
│ full_name       │     │ full_name       │     │ organizer_code  │
│ organizer_code  │     │ email           │     │ full_name       │
└─────────────────┘     │ phone_number    │     │ email           │
                        │ max_staff_count │     │ can_approve     │
                        │ is_active       │     │ is_active       │
                        └─────────────────┘     └─────────────────┘
                                 │                       │
                                 │                       │
                                 ▼                       ▼
                        ┌─────────────────┐     ┌─────────────────┐
                        │   organizers    │     │   organizers    │
                        │ (Organizations) │     │ (Organizations) │
                        └─────────────────┘     └─────────────────┘

┌─────────────────┐     ┌─────────────────┐     ┌─────────────────┐
│     tenants     │     │    locations    │     │ tenant_locations│
│  (Businesses)   │     │ (Market Spots)  │     │   (Rentals)     │
├─────────────────┤     ├─────────────────┤     ├─────────────────┤
│ id (PK)         │     │ id (PK)         │     │ id (PK)         │
│ full_name       │     │ name            │     │ tenant_id (FK)  │
│ business_name   │     │ organizer_id    │────▶│ location_id(FK) │
│ organizer_code  │────▶│ rate_khemah     │     │ rate_type       │
│ profile_id (FK) │     │ rate_cbs        │     │ status          │
└─────────────────┘     └─────────────────┘     └─────────────────┘
```

## Relationship Rules

### 1. Admin Flow
```
admin@kumim.my (profile)
    └── Hazman (admins table)
            ├── organizer_code: ORG002
            ├── manages: Hazman Enterprise (organizers)
            ├── has staff: manjaya.solution@gmail.com
            └── sees tenants with ORG002
```

### 2. Staff Flow
```
manjaya.solution@gmail.com (profile)
    └── Staff Encik Hazman (staff table)
            ├── admin_id: points to Hazman (admins)
            ├── organizer_code: ORG002
            └── sees same data as Hazman
```

### 3. Tenant Flow
```
Ahmad (tenants table)
    ├── organizer_code: ORG002
    ├── linked to: Hazman Enterprise
    └── can rent: locations owned by ORG002
```

## SQL Queries

### Get Admin with their Staff
```sql
SELECT 
    a.email as admin_email,
    a.full_name as admin_name,
    s.email as staff_email,
    s.full_name as staff_name
FROM admins a
LEFT JOIN staff s ON s.admin_id = a.id
WHERE a.organizer_code = 'ORG002';
```

### Get Staff with their Admin
```sql
SELECT 
    s.email as staff_email,
    a.email as admin_email,
    a.organizer_code
FROM staff s
JOIN admins a ON a.id = s.admin_id
WHERE s.email = 'manjaya.solution@gmail.com';
```

### Get All Data for an Organizer
```sql
SELECT 
    o.name as organizer,
    o.organizer_code,
    (SELECT COUNT(*) FROM admins WHERE organizer_code = o.organizer_code) as admin_count,
    (SELECT COUNT(*) FROM staff WHERE organizer_code = o.organizer_code) as staff_count,
    (SELECT COUNT(*) FROM tenants WHERE organizer_code = o.organizer_code) as tenant_count,
    (SELECT COUNT(*) FROM locations WHERE organizer_id = o.id) as location_count
FROM organizers o
WHERE o.organizer_code = 'ORG002';
```

## Data Integrity Rules

1. **One Admin per Organizer Code** (typically)
   - ORG002 → admin@kumim.my (Hazman)
   - ORG001 → admin@permit.com

2. **Staff belong to ONE Admin**
   - staff.admin_id → admins.id

3. **All (Admin, Staff, Tenants) share organizer_code**
   - Same organizer_code = same data visibility

4. **Tenants are separate from Users**
   - Tenants are businesses, not login accounts
   - Optional: tenants.profile_id links to a user account
