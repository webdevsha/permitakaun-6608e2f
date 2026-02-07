export type Profile = {
  id: string
  email: string | null
  full_name: string | null
  role: 'tenant' | 'staff' | 'admin' | 'organizer'
  organizer_code?: string | null
  created_at: string
}

export type Organizer = {
  id: string
  profile_id?: string | null
  name: string
  email?: string | null
  phone?: string | null
  organizer_code: string
  status: string
  created_at: string
}

export type Location = {
  id: number
  name: string
  type: 'daily' | 'monthly'
  rate_khemah: number
  rate_cbs: number
  rate_monthly: number
  image_url: string | null
  operating_days: string | null
  total_lots: number
  created_at: string
  organizer_id?: string | null
}

export type Tenant = {
  id: number
  profile_id: string | null
  full_name: string
  business_name: string | null
  phone_number: string | null
  ic_number: string | null
  email: string | null
  status: string
  created_at: string
  ssm_number?: string | null
  address?: string | null
  profile_image_url?: string | null
  ssm_file_url?: string | null
  ic_file_url?: string | null
  food_handling_cert_url?: string | null
  other_docs_url?: string | null
  organizer_code?: string | null
}

export type TenantLocation = {
  id: number
  tenant_id: number
  location_id: number
  stall_number: string | null
  rate_type: 'khemah' | 'cbs' | 'monthly'
  status: string
  created_at: string
  locations?: Location // For join queries
}

// ============================================================================
// TRANSACTION TYPES - SEPARATED BY ROLE (Akaun System)
// ============================================================================

/**
 * @deprecated Use AdminTransaction, OrganizerTransaction, or TenantTransaction instead
 * This is the legacy transaction type kept for backward compatibility
 */
export type Transaction = {
  id: number
  tenant_id: number | null
  amount: number
  type: 'income' | 'expense'
  category: string | null
  status: string
  date: string
  description: string | null
  receipt_url: string | null
  created_at: string
}

/**
 * Admin Transactions - For platform administrators
 * Tracks platform-level financial records
 */
export type AdminTransaction = {
  id: number
  admin_id: string | null
  profile_id: string | null
  amount: number
  type: 'income' | 'expense'
  category: string | null
  status: 'pending' | 'approved' | 'rejected'
  date: string
  description: string | null
  receipt_url: string | null
  reference_id: number | null
  reference_type: 'organizer' | 'tenant' | 'platform' | null
  is_sandbox: boolean
  created_at: string
  updated_at: string
}

/**
 * Organizer Transactions - For organizer's Akaun
 * Tracks income from tenant rentals and organizer expenses
 */
export type OrganizerTransaction = {
  id: number
  organizer_id: string
  tenant_id: number | null
  location_id: number | null
  amount: number
  type: 'income' | 'expense'
  category: string | null
  status: 'pending' | 'approved' | 'rejected'
  date: string
  description: string | null
  receipt_url: string | null
  payment_reference: string | null
  is_auto_generated: boolean
  is_sandbox: boolean
  metadata: Record<string, any>
  created_at: string
  updated_at: string
}

/**
 * Tenant Transactions - For tenant's Akaun
 * Tracks rent payments and other tenant expenses
 */
export type TenantTransaction = {
  id: number
  tenant_id: number
  profile_id: string | null
  organizer_id: string | null
  location_id: number | null
  amount: number
  type: 'income' | 'expense'
  category: string | null
  status: 'pending' | 'approved' | 'rejected'
  date: string
  description: string | null
  receipt_url: string | null
  payment_reference: string | null
  is_rent_payment: boolean
  is_sandbox: boolean
  metadata: Record<string, any>
  created_at: string
  updated_at: string
}

// ============================================================================
// AKaun Summary Types
// ============================================================================

export type TenantAkaunSummary = {
  total_income: number
  total_expense: number
  balance: number
  pending_payments: number
}

export type OrganizerAkaunSummary = {
  total_income: number
  total_expense: number
  balance: number
  pending_income: number
}

// ============================================================================
// Helper type for transaction creation
// ============================================================================

export type CreateTransactionInput = {
  amount: number
  type: 'income' | 'expense'
  category?: string
  date?: string
  description?: string
  receipt_url?: string
  status?: 'pending' | 'approved' | 'rejected'
}

export type CreateOrganizerTransactionInput = CreateTransactionInput & {
  organizer_id: string
  tenant_id?: number
  location_id?: number
  payment_reference?: string
  is_auto_generated?: boolean
  metadata?: Record<string, any>
}

export type CreateTenantTransactionInput = CreateTransactionInput & {
  tenant_id: number
  organizer_id?: string
  location_id?: number
  payment_reference?: string
  is_rent_payment?: boolean
  metadata?: Record<string, any>
}

export type CreateAdminTransactionInput = CreateTransactionInput & {
  admin_id?: string
  profile_id?: string
  reference_id?: number
  reference_type?: 'organizer' | 'tenant' | 'platform'
}
