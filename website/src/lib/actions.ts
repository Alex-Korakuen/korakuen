'use server'

import { revalidatePath } from 'next/cache'
import { createServerSupabaseClient } from '@/lib/supabase/server'
import { getInvoiceDetail, getLoanDetail, getPartnerPayableDetails, getPartnerReceivableDetails, getBankTransactions, searchEntities, getNextProjectCode, getBankAccountsForPartner, getExchangeRateForDate, round2 } from '@/lib/queries'
import type { PartnerPayableDetail, PartnerReceivableDetail, BankTransaction, Currency } from '@/lib/types'
import { handleDbError } from '@/lib/server-utils'

export async function fetchInvoiceDetail(invoiceId: string) {
  return getInvoiceDetail(invoiceId)
}

export async function fetchLoanDetailById(loanId: string) {
  return getLoanDetail(loanId)
}

export async function fetchLoanDetailByScheduleId(scheduleEntryId: string) {
  const supabase = await createServerSupabaseClient()
  const { data } = await supabase
    .from('loan_schedule')
    .select('loan_id')
    .eq('id', scheduleEntryId)
    .single()
  if (!data?.loan_id) return null
  return getLoanDetail(data.loan_id)
}

export async function fetchPartnerPayables(
  projectId: string,
  partnerCompanyId: string,
): Promise<PartnerPayableDetail[]> {
  return getPartnerPayableDetails(projectId, partnerCompanyId)
}

export async function fetchPartnerReceivables(
  projectId: string,
  partnerCompanyId: string,
): Promise<PartnerReceivableDetail[]> {
  return getPartnerReceivableDetails(projectId, partnerCompanyId)
}

export async function fetchBankTransactions(
  bankAccountId: string
): Promise<BankTransaction[]> {
  return getBankTransactions(bankAccountId)
}

// --- Payment validation helpers (shared by registerPayment, updatePayment, registerLoanRepayment) ---

type ServerSupabase = Awaited<ReturnType<typeof createServerSupabaseClient>>

/** Validates that a bank account exists and its currency matches the expected currency. */
async function validateBankCurrency(
  supabase: ServerSupabase,
  bankAccountId: string,
  expectedCurrency: string,
): Promise<string | null> {
  const { data: bankAccount } = await supabase
    .from('bank_accounts')
    .select('currency')
    .eq('id', bankAccountId)
    .single()
  if (!bankAccount) return 'Bank account not found'
  if (bankAccount.currency !== expectedCurrency) return 'Bank account currency does not match payment currency'
  return null
}

/** Validates a payment amount against invoice balance limits. Returns error string or null. */
async function validateInvoicePaymentLimit(
  supabase: ServerSupabase,
  invoiceId: string,
  paymentType: string,
  amount: number,
  addBack: number = 0,
): Promise<string | null> {
  const { data: inv } = await supabase
    .from('v_invoice_balances')
    .select('bdn_outstanding_pen, retencion_outstanding, payable_or_receivable, direction')
    .eq('invoice_id', invoiceId)
    .single()
  if (!inv) return 'Invoice not found'

  if (paymentType === 'retencion' && inv.direction === 'payable') {
    return 'Retencion payments only apply to receivable invoices'
  }

  let maxAmount: number
  if (paymentType === 'detraccion') {
    maxAmount = (inv.bdn_outstanding_pen ?? 0) + addBack
  } else if (paymentType === 'retencion') {
    maxAmount = (inv.retencion_outstanding ?? 0) + addBack
  } else {
    maxAmount = (inv.payable_or_receivable ?? 0) + addBack
  }

  if (amount > maxAmount) {
    return `Amount exceeds ${paymentType} limit (${maxAmount.toFixed(2)})`
  }
  return null
}

/** Validates a payment amount against loan schedule outstanding. Returns error string or null. */
async function validateLoanScheduleLimit(
  supabase: ServerSupabase,
  scheduleEntryId: string,
  amount: number,
  excludePaymentId?: string,
): Promise<string | null> {
  let paymentsQuery = supabase
    .from('payments')
    .select('amount')
    .eq('related_to', 'loan_schedule')
    .eq('related_id', scheduleEntryId)
    .eq('is_active', true)
  if (excludePaymentId) {
    paymentsQuery = paymentsQuery.neq('id', excludePaymentId)
  }

  const [{ data: existingPayments }, { data: scheduleEntry }] = await Promise.all([
    paymentsQuery,
    supabase.from('loan_schedule').select('scheduled_amount').eq('id', scheduleEntryId).single(),
  ])

  if (!scheduleEntry) return 'Schedule entry not found'
  const totalPaid = (existingPayments ?? []).reduce((s, p) => s + p.amount, 0)
  const outstanding = scheduleEntry.scheduled_amount - totalPaid

  if (amount > outstanding) {
    return `Amount exceeds schedule entry outstanding (${outstanding.toFixed(2)})`
  }
  return null
}

// --- Payment actions ---

export type { BankAccountOption } from '@/lib/queries'

export async function fetchBankAccountsForPayment(
  partnerCompanyId: string
) {
  return getBankAccountsForPartner(partnerCompanyId)
}

export async function fetchExchangeRateForDate(
  date: string
) {
  return getExchangeRateForDate(date)
}

export async function registerPayment(input: {
  related_to: 'invoice' | 'loan_schedule'
  related_id: string
  direction: 'outbound' | 'inbound'
  payment_type: 'regular' | 'detraccion' | 'retencion'
  payment_date: string
  amount: number
  currency: string
  exchange_rate: number
  partner_company_id: string
  bank_account_id: string | null
  notes: string | null
}): Promise<{ error?: string }> {
  const supabase = await createServerSupabaseClient()

  // Basic validations
  if (input.amount <= 0) return { error: 'Amount must be greater than 0' }
  if (input.payment_type !== 'retencion' && !input.bank_account_id) {
    return { error: 'Bank account is required for this payment type' }
  }
  if (input.payment_type === 'detraccion' && input.currency !== 'PEN') {
    return { error: 'Detraccion payments must be in PEN' }
  }

  // Bank account currency match
  if (input.bank_account_id) {
    const bankErr = await validateBankCurrency(supabase, input.bank_account_id, input.currency)
    if (bankErr) return { error: bankErr }
  }

  // Invoice balance limits
  if (input.related_to === 'invoice') {
    const invErr = await validateInvoicePaymentLimit(supabase, input.related_id, input.payment_type, input.amount)
    if (invErr) return { error: invErr }
  }

  // Loan schedule overpayment
  if (input.related_to === 'loan_schedule') {
    const lsErr = await validateLoanScheduleLimit(supabase, input.related_id, input.amount)
    if (lsErr) return { error: lsErr }
  }

  const { error } = await supabase.from('payments').insert({
    related_to: input.related_to,
    related_id: input.related_id,
    direction: input.direction,
    payment_type: input.payment_type,
    payment_date: input.payment_date,
    amount: input.amount,
    currency: input.currency,
    exchange_rate: input.exchange_rate,
    partner_company_id: input.partner_company_id,
    bank_account_id: input.bank_account_id,
    notes: input.notes,
  })

  if (error) return { error: handleDbError(error, 'Failed to register payment') }

  // Auto-verify retencion on the invoice when a retencion payment is registered
  if (input.payment_type === 'retencion' && input.related_to === 'invoice') {
    await supabase
      .from('invoices')
      .update({ retencion_verified: true })
      .eq('id', input.related_id)
  }

  revalidatePath('/calendar')
  revalidatePath('/invoices')
  revalidatePath('/payments')
  revalidatePath('/financial-position')
  return {}
}

// --- Mutation actions ---

export async function addEntityTag(entityId: string, tagId: string): Promise<{ error?: string }> {
  const supabase = await createServerSupabaseClient()
  const { error } = await supabase
    .from('entity_tags')
    .insert({ entity_id: entityId, tag_id: tagId })
  if (error) return { error: handleDbError(error, 'Failed to update tags') }
  revalidatePath('/entities')
  return {}
}

export async function removeEntityTag(entityId: string, tagId: string): Promise<{ error?: string }> {
  const supabase = await createServerSupabaseClient()
  const { error } = await supabase
    .from('entity_tags')
    .delete()
    .eq('entity_id', entityId)
    .eq('tag_id', tagId)
  if (error) return { error: handleDbError(error, 'Failed to update tags') }
  revalidatePath('/entities')
  return {}
}

export async function addEntityContact(
  entityId: string,
  data: { full_name: string; phone?: string; email?: string; role?: string }
): Promise<{ error?: string }> {
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
  if (error) return { error: handleDbError(error, 'Failed to add contact') }
  revalidatePath('/entities')
  return {}
}

export async function removeEntityContact(contactId: string): Promise<{ error?: string }> {
  const supabase = await createServerSupabaseClient()
  const { error } = await supabase
    .from('entity_contacts')
    .update({ is_active: false })
    .eq('id', contactId)
  if (error) return { error: handleDbError(error, 'Failed to remove contact') }
  revalidatePath('/entities')
  return {}
}

export async function updateEntityContact(
  contactId: string,
  data: { full_name: string; phone?: string; email?: string; role?: string }
): Promise<{ error?: string }> {
  if (!data.full_name.trim()) return { error: 'Name is required' }

  const supabase = await createServerSupabaseClient()
  const { error } = await supabase
    .from('entity_contacts')
    .update({
      full_name: data.full_name.trim(),
      phone: data.phone?.trim() || null,
      email: data.email?.trim() || null,
      role: data.role?.trim() || null,
    })
    .eq('id', contactId)
    .eq('is_active', true)

  if (error) return { error: handleDbError(error, 'Failed to update contact') }
  revalidatePath('/entities')
  return {}
}

// --- Update & Deactivate Entity ---

export async function updateEntity(
  entityId: string,
  data: {
    legal_name: string
    city?: string
    region?: string
    notes?: string
  }
): Promise<{ error?: string }> {
  if (!data.legal_name.trim()) return { error: 'Legal name is required' }

  const supabase = await createServerSupabaseClient()
  const { error } = await supabase
    .from('entities')
    .update({
      legal_name: data.legal_name.trim(),
      city: data.city?.trim() || null,
      region: data.region?.trim() || null,
      notes: data.notes?.trim() || null,
    })
    .eq('id', entityId)
    .eq('is_active', true)

  if (error) return { error: handleDbError(error, 'Failed to update entity') }
  revalidatePath('/entities')
  return {}
}

export async function deactivateEntity(
  entityId: string
): Promise<{ error?: string }> {
  const supabase = await createServerSupabaseClient()

  const { data: existing } = await supabase
    .from('entities')
    .select('id')
    .eq('id', entityId)
    .eq('is_active', true)
    .single()
  if (!existing) return { error: 'Entity not found or already deactivated' }

  const { error } = await supabase
    .from('entities')
    .update({ is_active: false })
    .eq('id', entityId)

  if (error) return { error: handleDbError(error, 'Failed to deactivate entity') }
  revalidatePath('/entities')
  revalidatePath('/invoices')
  return {}
}

export async function createBankAccount(data: {
  partner_company_id: string
  bank_name: string
  account_number_last4: string
  label: string
  account_type: 'checking' | 'savings' | 'detraccion'
  currency: Currency
  is_detraccion_account: boolean
}): Promise<{ error?: string }> {
  const supabase = await createServerSupabaseClient()

  // Check label uniqueness
  const { data: existing } = await supabase
    .from('bank_accounts')
    .select('id')
    .eq('label', data.label)
    .eq('is_active', true)
    .limit(1)
  if (existing && existing.length > 0) {
    return { error: `A bank account with label "${data.label}" already exists` }
  }

  const { error } = await supabase.from('bank_accounts').insert(data)
  if (error) return { error: handleDbError(error, 'Failed to create bank account') }
  revalidatePath('/financial-position')
  return {}
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
  if (data.document_type === 'CE' && !/^[A-Za-z0-9]{6,12}$/.test(data.document_number)) {
    return { error: 'CE must be 6-12 alphanumeric characters', field: 'document_number' }
  }
  if (data.document_type === 'Pasaporte' && !/^[A-Za-z0-9]{6,20}$/.test(data.document_number)) {
    return { error: 'Passport must be 6-20 alphanumeric characters', field: 'document_number' }
  }

  // Check document_number uniqueness (scoped to same document_type)
  const { data: existing } = await supabase
    .from('entities')
    .select('id')
    .eq('document_type', data.document_type)
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
    city: data.city || null,
    region: data.region || null,
    notes: data.notes || null,
  })
  if (error) return { error: handleDbError(error, 'Failed to create entity') }
  revalidatePath('/entities')
}

// --- Update Project ---

export async function updateProject(
  projectId: string,
  data: {
    name: string
    status: string
    contract_value?: number
    start_date?: string
    expected_end_date?: string
    actual_end_date?: string
    client_entity_id?: string
    location?: string
    notes?: string
  }
): Promise<{ error?: string }> {
  if (!data.name.trim()) return { error: 'Project name is required' }

  const supabase = await createServerSupabaseClient()
  const { error } = await supabase
    .from('projects')
    .update({
      name: data.name.trim(),
      status: data.status,
      contract_value: data.contract_value ?? null,
      start_date: data.start_date || null,
      expected_end_date: data.expected_end_date || null,
      actual_end_date: data.actual_end_date || null,
      client_entity_id: data.client_entity_id || null,
      location: data.location?.trim() || null,
      notes: data.notes?.trim() || null,
    })
    .eq('id', projectId)
    .eq('is_active', true)

  if (error) return { error: handleDbError(error, 'Failed to update project') }
  revalidatePath('/projects', 'layout')
  revalidatePath('/invoices')
  revalidatePath('/calendar')
  return {}
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
}): Promise<{ error?: string }> {
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
  if (error) return { error: handleDbError(error, 'Failed to create project') }
  revalidatePath('/projects', 'layout')
  return {}
}

// --- Project Partners ---

export async function addProjectPartner(
  projectId: string,
  partnerCompanyId: string,
  profitSharePct: number
): Promise<{ error?: string }> {
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
    return { error: 'This partner is already assigned to the project' }
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
    return { error: `Profit shares would total ${currentTotal + profitSharePct}%. Must not exceed 100% (current total: ${currentTotal}%)` }
  }

  const { error } = await supabase.from('project_partners').insert({
    project_id: projectId,
    partner_company_id: partnerCompanyId,
    profit_share_pct: profitSharePct,
  })
  if (error) return { error: handleDbError(error, 'Failed to add partner') }
  revalidatePath('/projects', 'layout')
  return {}
}

export async function removeProjectPartner(id: string): Promise<{ error?: string }> {
  const supabase = await createServerSupabaseClient()
  const { error } = await supabase
    .from('project_partners')
    .update({ is_active: false })
    .eq('id', id)
  if (error) return { error: handleDbError(error, 'Failed to remove partner') }
  revalidatePath('/projects', 'layout')
  return {}
}

export async function updatePartnerProfitShare(
  projectPartnerId: string,
  profitSharePct: number
): Promise<{ error?: string }> {
  if (profitSharePct <= 0 || profitSharePct > 100) {
    return { error: 'Share must be between 0 and 100%' }
  }

  const supabase = await createServerSupabaseClient()

  // Fetch this partner's project to validate total
  const { data: thisPP } = await supabase
    .from('project_partners')
    .select('project_id')
    .eq('id', projectPartnerId)
    .eq('is_active', true)
    .single()
  if (!thisPP) return { error: 'Partner assignment not found' }

  // Sum other active partners' shares (excluding this one)
  const { data: otherPartners } = await supabase
    .from('project_partners')
    .select('profit_share_pct')
    .eq('project_id', thisPP.project_id)
    .eq('is_active', true)
    .neq('id', projectPartnerId)
  const othersTotal = (otherPartners ?? []).reduce(
    (sum, p) => sum + Number(p.profit_share_pct), 0
  )

  if (othersTotal + profitSharePct > 100) {
    return { error: `Total would be ${othersTotal + profitSharePct}%. Must not exceed 100% (other partners: ${othersTotal}%)` }
  }

  const { error } = await supabase
    .from('project_partners')
    .update({ profit_share_pct: profitSharePct })
    .eq('id', projectPartnerId)
    .eq('is_active', true)

  if (error) return { error: handleDbError(error, 'Failed to update profit share') }
  revalidatePath('/projects', 'layout')
  return {}
}

// --- Project Budgets ---

export async function upsertProjectBudget(
  projectId: string,
  category: string,
  budgetedAmount: number,
  currency: string
): Promise<{ error?: string }> {
  const supabase = await createServerSupabaseClient()

  // Check if budget row already exists for this project+category (active or soft-deleted)
  const { data: existing } = await supabase
    .from('project_budgets')
    .select('id, is_active')
    .eq('project_id', projectId)
    .eq('category', category)
    .limit(1)

  if (existing && existing.length > 0) {
    const { error } = await supabase
      .from('project_budgets')
      .update({ budgeted_amount: budgetedAmount, is_active: true })
      .eq('id', existing[0].id)
    if (error) return { error: handleDbError(error, 'Failed to save budget') }
  } else {
    const { error } = await supabase.from('project_budgets').insert({
      project_id: projectId,
      category,
      budgeted_amount: budgetedAmount,
      currency,
    })
    if (error) return { error: handleDbError(error, 'Failed to save budget') }
  }
  revalidatePath('/projects', 'layout')
  return {}
}

export async function removeProjectBudget(projectId: string, category: string): Promise<{ error?: string }> {
  const supabase = await createServerSupabaseClient()
  const { error } = await supabase
    .from('project_budgets')
    .update({ is_active: false })
    .eq('project_id', projectId)
    .eq('category', category)
    .eq('is_active', true)
  if (error) return { error: handleDbError(error, 'Failed to remove budget') }
  revalidatePath('/projects', 'layout')
  return {}
}

// --- Loans ---

export async function createLoan(data: {
  partner_company_id: string
  entity_id: string
  lender_name: string
  amount: number
  currency: Currency
  exchange_rate: number
  date_borrowed: string
  project_id?: string
  return_type: 'percentage' | 'fixed'
  agreed_return_rate?: number
  agreed_return_amount?: number
  due_date?: string
  notes?: string
  bank_account_id?: string
}): Promise<{ error?: string }> {
  const supabase = await createServerSupabaseClient()

  if (data.amount <= 0) return { error: 'Amount must be greater than 0' }
  if (data.return_type === 'percentage' && (data.agreed_return_rate == null || data.agreed_return_rate < 0)) {
    return { error: 'Agreed return rate is required for percentage return type' }
  }
  if (data.return_type === 'fixed' && (data.agreed_return_amount == null || data.agreed_return_amount < 0)) {
    return { error: 'Agreed return amount is required for fixed return type' }
  }

  const { data: loan, error } = await supabase.from('loans').insert({
    partner_company_id: data.partner_company_id,
    entity_id: data.entity_id,
    lender_name: data.lender_name.trim(),
    lender_contact: null,
    amount: data.amount,
    currency: data.currency,
    exchange_rate: data.exchange_rate,
    date_borrowed: data.date_borrowed,
    project_id: data.project_id || null,
    purpose: data.notes?.trim() || 'Loan',
    return_type: data.return_type,
    agreed_return_rate: data.return_type === 'percentage' ? data.agreed_return_rate : null,
    agreed_return_amount: data.return_type === 'fixed' ? data.agreed_return_amount : null,
    due_date: data.due_date || null,
    notes: data.notes?.trim() || null,
  }).select('id').single()

  if (error) return { error: handleDbError(error, 'Failed to create loan') }

  // Record the disbursement as an inbound payment (the cash received from the lender)
  const { error: paymentError } = await supabase.from('payments').insert({
    related_to: 'loan',
    related_id: loan.id,
    direction: 'inbound',
    payment_type: 'regular',
    payment_date: data.date_borrowed,
    amount: data.amount,
    currency: data.currency,
    exchange_rate: data.exchange_rate,
    partner_company_id: data.partner_company_id,
    bank_account_id: data.bank_account_id || null,
    notes: `Loan disbursement from ${data.lender_name.trim()}`,
  })

  if (paymentError) return { error: handleDbError(paymentError, 'Failed to record loan disbursement') }

  revalidatePath('/financial-position')
  revalidatePath('/calendar')
  revalidatePath('/payments')
  return {}
}

export async function addLoanScheduleEntry(data: {
  loan_id: string
  scheduled_date: string
  scheduled_amount: number
  exchange_rate: number
}): Promise<{ error?: string }> {
  const supabase = await createServerSupabaseClient()

  if (data.scheduled_amount <= 0) return { error: 'Amount must be greater than 0' }

  // Validate total scheduled doesn't exceed total_owed
  const { data: loan } = await supabase
    .from('v_loan_balances')
    .select('total_owed')
    .eq('loan_id', data.loan_id)
    .single()
  if (!loan) return { error: 'Loan not found' }

  const { data: existingSchedule } = await supabase
    .from('loan_schedule')
    .select('scheduled_amount')
    .eq('loan_id', data.loan_id)
  const totalScheduled = (existingSchedule ?? []).reduce((sum, s) => sum + s.scheduled_amount, 0)
  const remaining = (loan.total_owed ?? 0) - totalScheduled

  if (data.scheduled_amount > remaining) {
    return { error: `Amount exceeds remaining schedulable amount (${remaining.toFixed(2)}). Total owed: ${(loan.total_owed ?? 0).toFixed(2)}, already scheduled: ${totalScheduled.toFixed(2)}` }
  }

  const { error } = await supabase.from('loan_schedule').insert({
    loan_id: data.loan_id,
    scheduled_date: data.scheduled_date,
    scheduled_amount: data.scheduled_amount,
    exchange_rate: data.exchange_rate,
  })

  if (error) return { error: handleDbError(error, 'Failed to add schedule entry') }
  revalidatePath('/calendar')
  revalidatePath('/financial-position')
  return {}
}

export async function registerLoanRepayment(data: {
  loan_id: string
  schedule_entry_id: string
  payment_date: string
  amount: number
  currency: Currency
  exchange_rate: number
  partner_company_id: string
  bank_account_id?: string
  notes?: string
}): Promise<{ error?: string }> {
  const supabase = await createServerSupabaseClient()

  if (data.amount <= 0) return { error: 'Amount must be greater than 0' }

  // Validate against schedule entry outstanding
  const lsErr = await validateLoanScheduleLimit(supabase, data.schedule_entry_id, data.amount)
  if (lsErr) return { error: lsErr }

  // Insert into payments table (same table as invoice payments)
  const { error } = await supabase.from('payments').insert({
    related_to: 'loan_schedule',
    related_id: data.schedule_entry_id,
    direction: 'outbound',
    payment_type: 'regular',
    payment_date: data.payment_date,
    amount: data.amount,
    currency: data.currency,
    exchange_rate: data.exchange_rate,
    partner_company_id: data.partner_company_id,
    bank_account_id: data.bank_account_id || null,
    notes: data.notes?.trim() || null,
  })

  if (error) return { error: handleDbError(error, 'Failed to register repayment') }

  revalidatePath('/calendar')
  revalidatePath('/invoices')
  revalidatePath('/payments')
  revalidatePath('/financial-position')
  return {}
}

// --- Update & Deactivate Payment ---

export async function updatePayment(input: {
  id: string
  payment_date: string
  amount: number
  exchange_rate: number
  bank_account_id: string | null
  notes: string | null
}): Promise<{ error?: string }> {
  const supabase = await createServerSupabaseClient()

  if (input.amount <= 0) return { error: 'Amount must be greater than 0' }

  // Fetch existing payment to get locked fields
  const { data: existing } = await supabase
    .from('payments')
    .select('id, related_to, related_id, direction, payment_type, currency, amount')
    .eq('id', input.id)
    .eq('is_active', true)
    .single()
  if (!existing) return { error: 'Payment not found' }

  // Bank account currency match
  if (input.bank_account_id) {
    const bankErr = await validateBankCurrency(supabase, input.bank_account_id, existing.currency)
    if (bankErr) return { error: bankErr }
  }

  // Bank account required unless retencion
  if (existing.payment_type !== 'retencion' && !input.bank_account_id) {
    return { error: 'Bank account is required for this payment type' }
  }

  // Amount ceiling — max = current outstanding + this payment's original amount
  if (existing.related_to === 'invoice') {
    const invErr = await validateInvoicePaymentLimit(
      supabase, existing.related_id, existing.payment_type, input.amount, existing.amount,
    )
    if (invErr) return { error: invErr }
  } else if (existing.related_to === 'loan_schedule') {
    const lsErr = await validateLoanScheduleLimit(supabase, existing.related_id, input.amount, input.id)
    if (lsErr) return { error: lsErr }
  } else if (existing.related_to === 'loan') {
    // Loan disbursement — cap at loan principal
    const { data: loan } = await supabase
      .from('loans')
      .select('amount')
      .eq('id', existing.related_id)
      .single()
    if (!loan) return { error: 'Related loan not found' }
    if (input.amount > loan.amount) {
      return { error: `Amount exceeds loan principal (${loan.amount.toFixed(2)})` }
    }
  }

  const { error } = await supabase
    .from('payments')
    .update({
      payment_date: input.payment_date,
      amount: input.amount,
      exchange_rate: input.exchange_rate,
      bank_account_id: input.bank_account_id,
      notes: input.notes,
    })
    .eq('id', input.id)
    .eq('is_active', true)

  if (error) return { error: handleDbError(error, 'Failed to update payment') }

  revalidatePath('/calendar')
  revalidatePath('/invoices')
  revalidatePath('/payments')
  revalidatePath('/financial-position')
  return {}
}

export async function deactivatePayment(
  paymentId: string
): Promise<{ error?: string }> {
  const supabase = await createServerSupabaseClient()

  // Verify payment exists and is active
  const { data: existing } = await supabase
    .from('payments')
    .select('id, payment_type, related_to, related_id')
    .eq('id', paymentId)
    .eq('is_active', true)
    .single()
  if (!existing) return { error: 'Payment not found or already deactivated' }

  const { error } = await supabase
    .from('payments')
    .update({ is_active: false })
    .eq('id', paymentId)

  if (error) return { error: handleDbError(error, 'Failed to deactivate payment') }

  // If this was the only retencion payment on the invoice, un-verify retencion
  if (existing.payment_type === 'retencion' && existing.related_to === 'invoice') {
    const { data: otherRetencion } = await supabase
      .from('payments')
      .select('id')
      .eq('related_to', 'invoice')
      .eq('related_id', existing.related_id)
      .eq('payment_type', 'retencion')
      .eq('is_active', true)
      .limit(1)
    if (!otherRetencion || otherRetencion.length === 0) {
      await supabase
        .from('invoices')
        .update({ retencion_verified: false })
        .eq('id', existing.related_id)
    }
  }

  revalidatePath('/calendar')
  revalidatePath('/invoices')
  revalidatePath('/payments')
  revalidatePath('/financial-position')
  return {}
}

// --- Update & Deactivate Invoice ---

export async function updateInvoice(input: {
  id: string
  title: string | null
  entity_id: string | null
  invoice_date: string
  due_date: string | null
  comprobante_type: string | null
  invoice_number: string | null
  document_ref: string | null
  payment_method: string | null
  exchange_rate: number
  detraccion_rate: number | null
  retencion_rate: number | null
  notes: string | null
  items: Array<{
    title: string
    category: string | null
    quantity: number | null
    unit_of_measure: string | null
    unit_price: number | null
    subtotal: number
  }>
}): Promise<{ error?: string }> {
  if (!input.items.length) return { error: 'At least one line item is required' }
  if (input.exchange_rate <= 0) return { error: 'Exchange rate must be greater than 0' }

  const supabase = await createServerSupabaseClient()

  // Fetch existing invoice (locked fields + payment check)
  const { data: existing } = await supabase
    .from('invoices')
    .select('id, direction, partner_company_id, currency, project_id, cost_type, igv_rate, retencion_applicable')
    .eq('id', input.id)
    .eq('is_active', true)
    .single()
  if (!existing) return { error: 'Invoice not found or already deactivated' }

  // Compute new total from items
  const newSubtotal = input.items.reduce((sum, item) => sum + item.subtotal, 0)
  if (newSubtotal <= 0) return { error: 'Total must be greater than 0' }

  // Check if invoice has payments — validate new total >= amount_paid
  const { data: paymentAgg } = await supabase
    .from('payments')
    .select('amount, currency, exchange_rate')
    .eq('related_to', 'invoice')
    .eq('related_id', input.id)
    .eq('is_active', true)

  if (paymentAgg && paymentAgg.length > 0) {
    const amountPaid = paymentAgg.reduce((sum, p) => {
      if (p.currency === existing.currency) return sum + p.amount
      return sum + p.amount / (p.exchange_rate || 1)
    }, 0)
    const igvAmount = round2(newSubtotal * (existing.igv_rate / 100))
    const newTotal = newSubtotal + igvAmount
    if (newTotal < amountPaid) {
      return { error: `New total (${newTotal.toFixed(2)}) cannot be less than amount already paid (${amountPaid.toFixed(2)})` }
    }
  }

  // Update invoice header (editable fields only)
  const { error: updateError } = await supabase
    .from('invoices')
    .update({
      title: input.title?.trim() || null,
      entity_id: input.entity_id || null,
      invoice_date: input.invoice_date,
      due_date: input.due_date || null,
      comprobante_type: input.comprobante_type || null,
      invoice_number: input.invoice_number?.trim() || null,
      document_ref: input.document_ref?.trim() || null,
      payment_method: input.payment_method || null,
      exchange_rate: input.exchange_rate,
      detraccion_rate: input.detraccion_rate ?? null,
      retencion_rate: existing.retencion_applicable ? (input.retencion_rate ?? null) : null,
      notes: input.notes?.trim() || null,
    })
    .eq('id', input.id)
    .eq('is_active', true)

  if (updateError) return { error: handleDbError(updateError, 'Failed to update invoice') }

  // Delete all existing invoice_items and reinsert
  const { error: deleteError } = await supabase
    .from('invoice_items')
    .delete()
    .eq('invoice_id', input.id)

  if (deleteError) return { error: handleDbError(deleteError, 'Failed to update invoice items') }

  const { error: insertError } = await supabase
    .from('invoice_items')
    .insert(
      input.items.map(item => ({
        invoice_id: input.id,
        title: item.title.trim(),
        category: item.category || null,
        quantity: item.quantity ?? null,
        unit_of_measure: item.unit_of_measure?.trim() || null,
        unit_price: item.unit_price ?? null,
        subtotal: item.subtotal,
      }))
    )

  if (insertError) return { error: handleDbError(insertError, 'Failed to update invoice items') }

  revalidatePath('/invoices')
  revalidatePath('/payments')
  revalidatePath('/calendar')
  revalidatePath('/financial-position')
  revalidatePath('/projects', 'layout')
  revalidatePath('/prices')
  return {}
}

export async function deactivateInvoice(
  invoiceId: string
): Promise<{ error?: string }> {
  const supabase = await createServerSupabaseClient()

  const { data: existing } = await supabase
    .from('invoices')
    .select('id')
    .eq('id', invoiceId)
    .eq('is_active', true)
    .single()
  if (!existing) return { error: 'Invoice not found or already deactivated' }

  const { error } = await supabase
    .from('invoices')
    .update({ is_active: false })
    .eq('id', invoiceId)

  if (error) return { error: handleDbError(error, 'Failed to deactivate invoice') }

  // Cascade: deactivate all related payments
  const { data: relatedPayments } = await supabase
    .from('payments')
    .select('id, payment_type')
    .eq('related_to', 'invoice')
    .eq('related_id', invoiceId)
    .eq('is_active', true)

  if (relatedPayments && relatedPayments.length > 0) {
    await supabase
      .from('payments')
      .update({ is_active: false })
      .eq('related_to', 'invoice')
      .eq('related_id', invoiceId)
      .eq('is_active', true)
  }

  // Un-verify retencion if applicable
  const hadRetencion = relatedPayments?.some(p => p.payment_type === 'retencion')
  if (hadRetencion) {
    await supabase
      .from('invoices')
      .update({ retencion_verified: false })
      .eq('id', invoiceId)
  }

  revalidatePath('/invoices')
  revalidatePath('/payments')
  revalidatePath('/calendar')
  revalidatePath('/financial-position')
  revalidatePath('/projects', 'layout')
  revalidatePath('/prices')
  return {}
}

