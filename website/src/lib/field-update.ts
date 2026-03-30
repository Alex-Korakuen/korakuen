'use server'

import { revalidatePath } from 'next/cache'
import { createServerSupabaseClient } from '@/lib/supabase/server'
import { handleDbError } from '@/lib/server-utils'

// ---------------------------------------------------------------------------
// Shared helper for single-field updates on any table with is_active pattern.
// Each domain configures this once; exported wrappers in actions.ts stay thin.
// ---------------------------------------------------------------------------

type FieldValidation = (field: string, value: string | number | null) => string | null

type FieldUpdateConfig = {
  table: string
  allowedFields: readonly string[]
  /** Per-field validation — return error string or null to pass */
  validate?: FieldValidation
  /** Paths to revalidate on success */
  revalidatePaths: readonly string[]
}

/**
 * Update a single field on a record in any table that uses the `is_active` soft-delete pattern.
 * Trims string values automatically. Returns `{ error }` on failure.
 */
export async function updateRecordField(
  config: FieldUpdateConfig,
  recordId: string,
  field: string,
  value: string | number | null,
): Promise<{ error?: string }> {
  // 1. Allowlist check
  if (!(config.allowedFields as readonly string[]).includes(field)) {
    return { error: `Field '${field}' is not editable` }
  }

  // 2. Normalize: trim strings, convert empty strings to null
  let normalized: string | number | null = value
  if (typeof normalized === 'string') {
    normalized = normalized.trim() || null
  }

  // 3. Per-field validation
  if (config.validate) {
    const err = config.validate(field, normalized)
    if (err) return { error: err }
  }

  // 4. Single-column update
  const supabase = await createServerSupabaseClient()
  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- generic helper works across tables
  const { error } = await (supabase.from as any)(config.table)
    .update({ [field]: normalized })
    .eq('id', recordId)
    .eq('is_active', true)

  if (error) return { error: handleDbError(error, `Failed to update ${config.table}`) }

  // 5. Revalidate
  for (const path of config.revalidatePaths) {
    revalidatePath(path)
  }

  return {}
}

// ---------------------------------------------------------------------------
// Per-table configs
// ---------------------------------------------------------------------------

export const ENTITY_CONFIG: FieldUpdateConfig = {
  table: 'entities',
  allowedFields: ['legal_name', 'city', 'region', 'notes'],
  validate: (field, value) => {
    if (field === 'legal_name' && !value) return 'Legal name is required'
    return null
  },
  revalidatePaths: ['/entities'],
}

export const PROJECT_CONFIG: FieldUpdateConfig = {
  table: 'projects',
  allowedFields: [
    'name', 'status', 'client_entity_id', 'contract_value',
    'start_date', 'expected_end_date', 'actual_end_date', 'location', 'notes',
  ],
  validate: (field, value) => {
    if (field === 'name' && !value) return 'Project name is required'
    if (field === 'contract_value' && value !== null && (typeof value !== 'number' || value <= 0)) {
      return 'Contract value must be greater than 0'
    }
    if (field === 'status' && value !== null && !['prospect', 'active', 'completed', 'cancelled'].includes(value as string)) {
      return 'Invalid status'
    }
    return null
  },
  revalidatePaths: ['/projects', '/calendar', '/invoices', '/payments', '/financial-position'],
}

export const INVOICE_CONFIG: FieldUpdateConfig = {
  table: 'invoices',
  allowedFields: [
    'title', 'entity_id', 'invoice_date', 'due_date', 'comprobante_type',
    'invoice_number', 'document_ref', 'payment_method', 'exchange_rate',
    'detraccion_rate', 'retencion_rate', 'notes',
  ],
  validate: (field, value) => {
    if (field === 'exchange_rate' && (value === null || (typeof value === 'number' && value <= 0))) {
      return 'Exchange rate must be greater than 0'
    }
    if ((field === 'detraccion_rate' || field === 'retencion_rate') && value !== null) {
      const num = typeof value === 'number' ? value : parseFloat(value as string)
      if (isNaN(num) || num < 0 || num > 100) return `${field === 'detraccion_rate' ? 'Detraccion' : 'Retencion'} rate must be 0-100`
    }
    return null
  },
  revalidatePaths: ['/calendar', '/invoices', '/payments', '/financial-position', '/projects', '/prices'],
}

export const PAYMENT_CONFIG: FieldUpdateConfig = {
  table: 'payments',
  allowedFields: ['payment_date', 'amount', 'exchange_rate', 'bank_account_id', 'notes'],
  validate: (field, value) => {
    if (field === 'amount' && (value === null || (typeof value === 'number' && value <= 0))) {
      return 'Amount must be greater than 0'
    }
    if (field === 'exchange_rate' && (value === null || (typeof value === 'number' && value <= 0))) {
      return 'Exchange rate must be greater than 0'
    }
    return null
  },
  revalidatePaths: ['/calendar', '/invoices', '/payments', '/financial-position'],
}
