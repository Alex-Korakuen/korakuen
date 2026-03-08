'use server'

import { revalidatePath } from 'next/cache'
import { createServerSupabaseClient } from '@/lib/supabase/server'
import { getCostDetail, getLoanDetail, getLoanIdFromSchedule, getArInvoiceDetail, getPartnerCostDetails, getBankTransactions, searchEntities, getNextProjectCode } from '@/lib/queries'
import type { PartnerCostDetail, BankTransaction, Currency } from '@/lib/types'

export async function fetchCostDetail(costId: string) {
  return getCostDetail(costId)
}

export async function fetchLoanDetailFromSchedule(
  lenderName: string,
  scheduledDate: string,
  scheduledAmount: number
) {
  const loanId = await getLoanIdFromSchedule(scheduledDate, scheduledAmount)
  if (!loanId) return null
  return getLoanDetail(loanId)
}

export async function fetchArInvoiceDetail(arInvoiceId: string) {
  return getArInvoiceDetail(arInvoiceId)
}

export async function fetchPartnerCosts(
  projectId: string,
  partnerCompanyId: string,
): Promise<PartnerCostDetail[]> {
  return getPartnerCostDetails(projectId, partnerCompanyId)
}

export async function fetchBankTransactions(
  bankAccountId: string
): Promise<BankTransaction[]> {
  return getBankTransactions(bankAccountId)
}

// --- Mutation actions ---

export async function addEntityTag(entityId: string, tagId: string) {
  const supabase = await createServerSupabaseClient()
  const { error } = await supabase
    .from('entity_tags')
    .insert({ entity_id: entityId, tag_id: tagId })
  if (error) throw new Error(error.message)
  revalidatePath('/entities')
}

export async function removeEntityTag(entityId: string, tagId: string) {
  const supabase = await createServerSupabaseClient()
  const { error } = await supabase
    .from('entity_tags')
    .delete()
    .eq('entity_id', entityId)
    .eq('tag_id', tagId)
  if (error) throw new Error(error.message)
  revalidatePath('/entities')
}

export async function addEntityContact(
  entityId: string,
  data: { full_name: string; phone?: string; email?: string; role?: string }
) {
  const supabase = await createServerSupabaseClient()

  const { error } = await supabase
    .from('entity_contacts')
    .insert({
      entity_id: entityId,
      full_name: data.full_name,
      phone: data.phone || null,
      email: data.email || null,
      role: data.role || null,
    })
  if (error) throw new Error(error.message)
  revalidatePath('/entities')
}

export async function removeEntityContact(contactId: string) {
  const supabase = await createServerSupabaseClient()
  const { error } = await supabase
    .from('entity_contacts')
    .update({ is_active: false })
    .eq('id', contactId)
  if (error) throw new Error(error.message)
  revalidatePath('/entities')
}

export async function createBankAccount(data: {
  partner_company_id: string
  bank_name: string
  account_number_last4: string
  label: string
  account_type: 'checking' | 'savings' | 'detraccion'
  currency: Currency
  is_detraccion_account: boolean
}) {
  const supabase = await createServerSupabaseClient()

  // Check label uniqueness
  const { data: existing } = await supabase
    .from('bank_accounts')
    .select('id')
    .eq('label', data.label)
    .eq('is_active', true)
    .limit(1)
  if (existing && existing.length > 0) {
    throw new Error(`A bank account with label "${data.label}" already exists`)
  }

  const { error } = await supabase.from('bank_accounts').insert(data)
  if (error) throw new Error(error.message)
  revalidatePath('/financial-position')
}

// --- Entity search (for entity picker) ---

export async function searchEntitiesAction(query: string) {
  return searchEntities(query)
}

// --- Create Entity ---

export async function createEntity(data: {
  entity_type: 'company' | 'individual'
  document_type: 'RUC' | 'DNI' | 'CE' | 'Pasaporte'
  document_number: string
  legal_name: string
  common_name?: string
  city?: string
  region?: string
  notes?: string
}): Promise<{ error: string; field?: string } | undefined> {
  const supabase = await createServerSupabaseClient()

  // Validate entity_type / document_type consistency
  if (data.entity_type === 'company' && data.document_type !== 'RUC') {
    return { error: 'Company entities must use RUC document type' }
  }
  if (data.entity_type === 'individual' && data.document_type === 'RUC') {
    return { error: 'Individual entities cannot use RUC document type' }
  }

  // Validate document_number format
  if (data.document_type === 'RUC' && !/^\d{11}$/.test(data.document_number)) {
    return { error: 'RUC must be exactly 11 digits', field: 'document_number' }
  }
  if (data.document_type === 'DNI' && !/^\d{8}$/.test(data.document_number)) {
    return { error: 'DNI must be exactly 8 digits', field: 'document_number' }
  }

  // Check document_number uniqueness
  const { data: existing } = await supabase
    .from('entities')
    .select('id')
    .eq('document_number', data.document_number)
    .eq('is_active', true)
    .limit(1)
  if (existing && existing.length > 0) {
    return { error: `An entity with document number "${data.document_number}" already exists`, field: 'document_number' }
  }

  const { error } = await supabase.from('entities').insert({
    entity_type: data.entity_type,
    document_type: data.document_type,
    document_number: data.document_number,
    legal_name: data.legal_name,
    common_name: data.common_name || null,
    city: data.city || null,
    region: data.region || null,
    notes: data.notes || null,
  })
  if (error) return { error: error.message }
  revalidatePath('/entities')
}

// --- Create Project ---

export async function createProject(data: {
  name: string
  project_type: 'subcontractor' | 'oxi'
  status: 'prospect' | 'active' | 'completed' | 'cancelled'
  client_entity_id?: string
  contract_value?: number
  contract_currency?: Currency
  start_date?: string
  expected_end_date?: string
  location?: string
  notes?: string
}) {
  const projectCode = await getNextProjectCode()

  const supabase = await createServerSupabaseClient()
  const { error } = await supabase.from('projects').insert({
    project_code: projectCode,
    name: data.name,
    project_type: data.project_type,
    status: data.status,
    client_entity_id: data.client_entity_id || null,
    contract_value: data.contract_value ?? null,
    contract_currency: data.contract_value ? (data.contract_currency || 'PEN') : null,
    start_date: data.start_date || null,
    expected_end_date: data.expected_end_date || null,
    location: data.location || null,
    notes: data.notes || null,
  })
  if (error) throw new Error(error.message)
  revalidatePath('/projects')
}

// --- Project Partners ---

export async function addProjectPartner(
  projectId: string,
  partnerCompanyId: string,
  profitSharePct: number
) {
  const supabase = await createServerSupabaseClient()

  // Check not already assigned
  const { data: existing } = await supabase
    .from('project_partners')
    .select('id')
    .eq('project_id', projectId)
    .eq('partner_company_id', partnerCompanyId)
    .eq('is_active', true)
    .limit(1)
  if (existing && existing.length > 0) {
    throw new Error('This partner is already assigned to the project')
  }

  // Validate profit shares sum to <= 100%
  const { data: currentPartners } = await supabase
    .from('project_partners')
    .select('profit_share_pct')
    .eq('project_id', projectId)
    .eq('is_active', true)
  const currentTotal = (currentPartners || []).reduce(
    (sum, p) => sum + Number(p.profit_share_pct),
    0
  )
  if (currentTotal + profitSharePct > 100) {
    throw new Error(
      `Profit shares would total ${currentTotal + profitSharePct}%. Must not exceed 100% (current total: ${currentTotal}%)`
    )
  }

  const { error } = await supabase.from('project_partners').insert({
    project_id: projectId,
    partner_company_id: partnerCompanyId,
    profit_share_pct: profitSharePct,
  })
  if (error) throw new Error(error.message)
  revalidatePath('/projects')
}

export async function removeProjectPartner(id: string) {
  const supabase = await createServerSupabaseClient()
  const { error } = await supabase
    .from('project_partners')
    .update({ is_active: false })
    .eq('id', id)
  if (error) throw new Error(error.message)
  revalidatePath('/projects')
}

// --- Project Entities ---

export async function addProjectEntity(
  projectId: string,
  entityId: string,
  tagId: string
) {
  const supabase = await createServerSupabaseClient()

  // Check for duplicate (same entity + tag + project)
  const { data: existing } = await supabase
    .from('project_entities')
    .select('id')
    .eq('project_id', projectId)
    .eq('entity_id', entityId)
    .eq('tag_id', tagId)
    .eq('is_active', true)
    .limit(1)
  if (existing && existing.length > 0) {
    throw new Error('This entity is already assigned to the project with this role')
  }

  const { error } = await supabase.from('project_entities').insert({
    project_id: projectId,
    entity_id: entityId,
    tag_id: tagId,
  })
  if (error) throw new Error(error.message)
  revalidatePath('/projects')
}

export async function removeProjectEntity(id: string) {
  const supabase = await createServerSupabaseClient()
  const { error } = await supabase
    .from('project_entities')
    .update({ is_active: false })
    .eq('id', id)
  if (error) throw new Error(error.message)
  revalidatePath('/projects')
}

// --- Project Budgets ---

export async function upsertProjectBudget(
  projectId: string,
  category: string,
  budgetedAmount: number,
  currency: Currency
) {
  const supabase = await createServerSupabaseClient()

  // Check if budget row already exists for this project+category
  const { data: existing } = await supabase
    .from('project_budgets')
    .select('id')
    .eq('project_id', projectId)
    .eq('category', category)
    .eq('is_active', true)
    .limit(1)

  if (existing && existing.length > 0) {
    const { error } = await supabase
      .from('project_budgets')
      .update({ budgeted_amount: budgetedAmount })
      .eq('id', existing[0].id)
    if (error) throw new Error(error.message)
  } else {
    const { error } = await supabase.from('project_budgets').insert({
      project_id: projectId,
      category,
      budgeted_amount: budgetedAmount,
      currency,
    })
    if (error) throw new Error(error.message)
  }
  revalidatePath('/projects')
}

export async function removeProjectBudget(projectId: string, category: string) {
  const supabase = await createServerSupabaseClient()
  const { error } = await supabase
    .from('project_budgets')
    .update({ is_active: false })
    .eq('project_id', projectId)
    .eq('category', category)
    .eq('is_active', true)
  if (error) throw new Error(error.message)
  revalidatePath('/projects')
}
