# Data Architecture

## User Roles & Hierarchy

### SUPERADMIN (Dev Access)
- **Scope**: All data
- **Can**: Create admins, manage system settings
- **Cannot**: Regular operations (view-only for support)

### ADMIN
- **Scope**: All organizers and their tenants
- **Can**: Create staff, approve transactions
- **Limit**: `max_staff_count` per admin
- **Data Flow**: Admin → Manages organizers → Organizers manage tenants

### STAFF
- **Scope**: Same data as their linked ADMIN (by `organizer_code`)
- **Can**: Help admin manage operations
- **Limit**: See same data as admin, but no approval power (unless `can_approve`)

### ORGANIZER
- **Scope**: Their own tenants only
- **Can**: Manage own tenants, set tenant locations
- **Cannot**: See other organizers' data
- **Key Point**: Organizer is NOT above Admin - they manage different things

### TENANT
- **Scope**: Their own transactions only
- **Can**: View own data, submit transactions
- **Sees**: Locations assigned by their Organizer

## Data Relationships

```
Profile (auth) → Admin → Organizer → Tenant → Locations
                 ↓
               Staff (same view as Admin)
```

## Table Responsibilities

| Table | Stores | Who Uses It |
|-------|--------|-------------|
| `profiles` | Auth info, role, email | Everyone (read-only for users) |
| `admins` | Admin config, limits, settings | Admins |
| `staff` | Staff linkage to admin, permissions | Staff |
| `organizers` | Organizer info (ORG001, ORG002...) | Admins, Organizers |
| `tenants` | Tenant business info | Admins, Staff, Organizers |
| `locations` | Physical locations | Organizers (manage), Tenants (view assigned) |

## Staff Data Mirroring

Staff must see the SAME data as their Admin:

```sql
-- Staff query example
SELECT * FROM transactions 
WHERE organizer_code = (
    SELECT organizer_code FROM staff WHERE profile_id = auth.uid()
);
-- Same query Admin would use
SELECT * FROM transactions 
WHERE organizer_code = (
    SELECT organizer_code FROM admins WHERE profile_id = auth.uid()
);
```

## RLS Policy Pattern

All tables with `organizer_code` should follow this pattern:

```sql
-- Allow if user's organizer_code matches
organizer_code IN (
    SELECT organizer_code FROM staff WHERE profile_id = auth.uid()
    UNION
    SELECT organizer_code FROM admins WHERE profile_id = auth.uid()
)
```
