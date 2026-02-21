# Tenant-Organizer Location Approval Workflow

## Overview
This implementation adds a comprehensive approval-based Tenant-Organizer relationship workflow to PermitAkaun. Tenants must request approval from an Organizer before they can view/add the Organizer's Locations and pay rent.

## Files Created/Modified

### 1. Database Migration
**File:** `sql/enhanced_tenant_organizer_workflow.sql`

Enhances the existing schema with:
- Additional columns to `tenant_organizers`: `approved_at`, `rejected_at`, `rejection_reason`, `requested_at`
- Added `organizer_id` and `is_active` to `tenant_locations`
- RLS policies for secure access control
- Helper functions:
  - `validate_organizer_by_code()` - Validate and return masked organizer info
  - `request_organizer_link()` - Submit link request with duplicate prevention
  - `process_tenant_request()` - Approve/reject tenant requests
  - `get_available_locations_for_tenant()` - Get locations from approved organizers only
  - `add_tenant_locations()` - Bulk assign locations to tenant
- Indexes for performance
- Views: `pending_tenant_requests`, `tenant_approved_locations`

### 2. Server Actions
**File:** `actions/tenant-organizer.ts`

API endpoints for the workflow:
- `validateOrganizerAction()` - Check if organizer exists and return masked info
- `requestOrganizerLinkAction()` - Submit pending request
- `getPendingRequestsAction()` - Fetch pending requests for organizer/admin
- `processTenantRequestAction()` - Approve or reject requests
- `getAvailableLocationsAction()` - Get available locations for tenant
- `addTenantLocationsAction()` - Bulk add locations
- `getTenantOrganizersAction()` - Get tenant's linked organizers
- `hasApprovedOrganizerAction()` - Check if tenant has any approved organizer
- `removeOrganizerLinkAction()` - Remove a link (for rejected requests)

### 3. UI Components

#### OrganizerValidation Component
**File:** `components/organizer-validation.tsx`

Tenant view for managing organizer relationships:
- Input field to enter Organizer ID/Code
- Validation with masked email display for confirmation
- List of linked organizers with status badges
- Handle pending, approved, and rejected states
- Allow re-request after rejection

#### PendingApprovals Component
**File:** `components/pending-approvals.tsx`

Organizer/Admin view for managing pending requests:
- List of pending tenant requests
- Shows tenant info (name, business, contact, request date)
- Approve/Reject action buttons
- Search and filter functionality
- Urgent indicator for requests pending > 3 days

#### EnhancedRentalModule Component
**File:** `components/rental-module-enhanced.tsx`

Updated rental management with access control:
- Integrates OrganizerValidation component
- Shows available locations only from approved organizers
- Multi-select location picker
- Location access control based on approval status
- Clear messaging when waiting for approval

#### TenantListEnhanced Component
**File:** `components/tenant-list-enhanced.tsx`

Updated tenant management with tabs:
- Tab: "Active Tenants" - Existing tenant list
- Tab: "Pending Approval" - Integration with PendingApprovals component
- Shows count badges for pending requests

### 4. Updated Pages

#### Tenant Dashboard
**File:** `app/dashboard/tenant/page.tsx`

- Integrated OrganizerValidation component
- Shows appropriate status cards based on approval state
- Links to rental management

#### Rentals Page
**File:** `app/dashboard/rentals/page.tsx`

- Uses EnhancedRentalModule
- Fetches linked organizers and available locations
- Proper data passing to components

#### Tenants Page
**File:** `app/dashboard/tenants/page.tsx`

- Uses TenantListEnhanced
- Passes organizerId for role-based filtering

### 5. Types
**File:** `types/supabase-types.ts`

Added new types:
- `TenantOrganizerRequest` - Full request data structure
- `LinkedOrganizer` - For tenant view
- `PendingTenantRequest` - For organizer/admin view
- `AvailableLocation` - Location data for tenant selection

### 6. Utilities
**File:** `utils/logging.ts`

- Added 'tenant_link' to ResourceType for audit logging

## Workflow Flow

### Tenant Onboarding Flow:
```
1. Tenant enters Organizer ID in input field
2. System validates and shows masked organizer info
3. Tenant confirms to submit request
4. Request created with status='pending'
5. Tenant sees "Waiting for Approval" message
```

### Organizer Approval Flow:
```
1. Organizer views "Pending Approval" tab
2. Sees list of pending tenant requests
3. Can Approve or Reject with reason
4. Tenant receives updated status
```

### Location Access Flow (Post-Approval):
```
1. Tenant with approved organizer sees "Add Location" button
2. Available locations filtered to approved organizers only
3. Tenant can select one, multiple, or all locations
4. Locations saved to tenant_locations with organizer_id
5. Tenant can now make rental payments
```

## Security Features

1. **RLS Policies**: All database access controlled by Row Level Security
2. **Validation**: Server-side validation prevents unauthorized access
3. **Masking**: Organizer emails are masked for privacy
4. **Authorization**: Actions verify user ownership before execution

## Usage

### Running the Migration
```bash
# Execute the SQL migration in Supabase
psql -h YOUR_HOST -d postgres -U postgres -f sql/enhanced_tenant_organizer_workflow.sql
```

### For Tenants
1. Go to Dashboard → Sewaan (Rentals)
2. Enter Organizer ID in the "Pautkan Penganjur" section
3. Confirm the organizer details
4. Wait for approval
5. Once approved, select locations to rent

### For Organizers/Admins
1. Go to Dashboard → Peniaga & Sewa (Tenants)
2. Click "Menunggu Kelulusan" tab
3. Review pending requests
4. Click "Luluskan" to approve or "Tolak" to reject

## Future Enhancements

1. Email notifications for approval/rejection
2. Bulk approval for multiple tenants
3. Auto-expiry for pending requests (e.g., 7 days)
4. Statistics dashboard for approval rates
5. Tenant ratings/reviews for organizers
