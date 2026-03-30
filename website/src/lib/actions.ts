'use server'

import { revalidatePath } from 'next/cache'
import { createServerSupabaseClient } from '@/lib/supabase/server'
import { getInvoiceDetail, getLoanDetail, getBankTransactions, searchEntities, searchInvoices, getNextProjectCode, getBankAccountsForPartner, getExchangeRateForDate, round2 } from '@/lib/queries'
import type { BankTransaction, Currency } from '@/lib/types'
import { handleDbError } from '@/lib/server-utils'

/** Revalidate all financial pages that share cross-cutting data. */
function revalidateFinancialPages() {
  revalidatePath('/calendar')
  revalidatePath('/invoices')
  revalidatePath('/payments')
  revalidatePath('/financial-position')
}

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
  partnerId: string
) {
  return getBankAccountsForPartner(partnerId)
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
  partner_id: string
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
    partner_id: input.partner_id,
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

  revalidateFinancialPages()
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

// --- Granular field-level updates (thin wrappers over shared helper) ---

export async function updateEntityField(
  entityId: string, field: string, value: string | number | null,
): Promise<{ error?: string }> {
  const { updateRecordField, ENTITY_CONFIG } = await import('@/lib/field-update')
  return updateRecordField(ENTITY_CONFIG, entityId, field, value)
}

export async function updateProjectField(
  projectId: string, field: string, value: string | number | null,
): Promise<{ error?: string }> {
  const { updateRecordField, PROJECT_CONFIG } = await import('@/lib/field-update')
  return updateRecordField(PROJECT_CONFIG, projectId, field, value)
}

export async function updateInvoiceField(
  invoiceId: string, field: string, value: string | number | null,
): Promise<{ error?: string }> {
  const { updateRecordField, INVOICE_CONFIG } = await import('@/lib/field-update')
  return updateRecordField(INVOICE_CONFIG, invoiceId, field, value)
}

export async function updatePaymentField(
  paymentId: string, field: string, value: string | number | null,
): Promise<{ error?: string }> {
  const { updateRecordField, PAYMENT_CONFIG } = await import('@/lib/field-update')
  return updateRecordField(PAYMENT_CONFIG, paymentId, field, value)
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
  partner_id: string
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

export async function searchInvoicesAction(query: string) {
  return searchInvoices(query)
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
}): Promise<{ error?: string; field?: string }> {
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
  return {}
}

// --- Update Project ---

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
  partners?: { partnerId: string; profitSharePct: number }[]
}): Promise<{ error?: string }> {
  // Validate partner shares if provided
  if (data.partners && data.partners.length > 0) {
    const total = data.partners.reduce((s, p) => s + p.profitSharePct, 0)
    if (Math.abs(total - 100) > 0.01) return { error: `Partner percentages must sum to 100% (currently ${total.toFixed(1)}%)` }
    for (const p of data.partners) {
      if (p.profitSharePct < 0) return { error: 'Percentages cannot be negative' }
    }
  }

  const projectCode = await getNextProjectCode()

  const supabase = await createServerSupabaseClient()
  const { data: project, error } = await supabase.from('projects').insert({
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
  }).select('id').single()
  if (error) return { error: handleDbError(error, 'Failed to create project') }

  // Insert project partners if provided
  if (data.partners && data.partners.length > 0) {
    const { error: ppError } = await supabase.from('project_partners').insert(
      data.partners.map(p => ({
        project_id: project.id,
        partner_id: p.partnerId,
        profit_share_pct: p.profitSharePct,
      }))
    )
    if (ppError) return { error: handleDbError(ppError, 'Failed to add partners') }
  }

  revalidatePath('/projects', 'layout')
  return {}
}


// --- Set Project Partners (add/edit/remove) ---

export async function setProjectPartners(
  projectId: string,
  partners: { partnerId: string; profitSharePct: number }[]
): Promise<{ error?: string }> {
  if (partners.length === 0) return { error: 'At least one partner is required' }
  const total = partners.reduce((s, p) => s + p.profitSharePct, 0)
  if (Math.abs(total - 100) > 0.01) return { error: `Percentages must sum to 100% (currently ${total.toFixed(1)}%)` }
  for (const p of partners) {
    if (p.profitSharePct < 0) return { error: 'Percentages cannot be negative' }
  }

  const supabase = await createServerSupabaseClient()

  // Soft-delete existing active partners
  const { error: delError } = await supabase
    .from('project_partners')
    .update({ is_active: false })
    .eq('project_id', projectId)
    .eq('is_active', true)
  if (delError) return { error: handleDbError(delError, 'Failed to update partners') }

  // Insert new partner rows
  const { error: insError } = await supabase.from('project_partners').insert(
    partners.map(p => ({
      project_id: projectId,
      partner_id: p.partnerId,
      profit_share_pct: p.profitSharePct,
    }))
  )
  if (insError) return { error: handleDbError(insError, 'Failed to set partners') }

  revalidatePath('/projects', 'layout')
  revalidatePath('/settlement')
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
  partner_id: string
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
    partner_id: data.partner_id,
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
    partner_id: data.partner_id,
    bank_account_id: data.bank_account_id || null,
    notes: `Loan disbursement from ${data.lender_name.trim()}`,
  })

  if (paymentError) return { error: handleDbError(paymentError, 'Failed to record loan disbursement') }

  revalidateFinancialPages()
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
  revalidateFinancialPages()
  return {}
}

export async function registerLoanRepayment(data: {
  loan_id: string
  schedule_entry_id: string
  payment_date: string
  amount: number
  currency: Currency
  exchange_rate: number
  partner_id: string
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
    partner_id: data.partner_id,
    bank_account_id: data.bank_account_id || null,
    notes: data.notes?.trim() || null,
  })

  if (error) return { error: handleDbError(error, 'Failed to register repayment') }

  revalidateFinancialPages()
  return {}
}

// --- Update & Deactivate Payment ---

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

  revalidateFinancialPages()
  return {}
}

// --- Update & Deactivate Invoice ---

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

  // Unlink related payments (keep them active, just remove the link)
  await supabase
    .from('payments')
    .update({ related_id: null as unknown as string })
    .eq('related_to', 'invoice')
    .eq('related_id', invoiceId)
    .eq('is_active', true)

  revalidateFinancialPages()
  revalidatePath('/projects', 'layout')
  revalidatePath('/prices')
  return {}
}

// --- Invoice Item granular actions ---

const ITEM_EDITABLE_FIELDS = ['title', 'category', 'quantity', 'unit_of_measure', 'unit_price'] as const

/** Revalidate all pages affected by invoice item changes. */
function revalidateInvoicePages() {
  revalidateFinancialPages()
  revalidatePath('/projects', 'layout')
  revalidatePath('/prices')
}

/**
 * Check that the invoice total (after item changes) is still >= amount_paid.
 * Returns error string or null.
 */
async function validateInvoiceTotalAfterItemChange(
  supabase: ServerSupabase,
  invoiceId: string,
): Promise<string | null> {
  const { data } = await supabase
    .from('v_invoice_balances')
    .select('total, amount_paid')
    .eq('invoice_id', invoiceId)
    .single()
  if (!data) return null
  const total = data.total ?? 0
  const amountPaid = data.amount_paid ?? 0
  if (total < amountPaid) {
    return `New total (${total.toFixed(2)}) cannot be less than amount already paid (${amountPaid.toFixed(2)})`
  }
  return null
}

export async function updateInvoiceItemField(
  itemId: string,
  field: string,
  value: string | number | null,
): Promise<{ error?: string }> {
  if (!(ITEM_EDITABLE_FIELDS as readonly string[]).includes(field)) {
    return { error: `Field '${field}' is not editable` }
  }

  const supabase = await createServerSupabaseClient()

  const { data: item } = await supabase
    .from('invoice_items')
    .select('id, invoice_id, quantity, unit_price')
    .eq('id', itemId)
    .single()
  if (!item) return { error: 'Item not found' }

  let normalized: string | number | null = value
  if (typeof normalized === 'string') normalized = normalized.trim() || null

  if (field === 'title' && !normalized) return { error: 'Title is required' }

  // Recompute subtotal when quantity or unit_price changes
  const updateData: Record<string, unknown> = { [field]: normalized }
  if (field === 'quantity' || field === 'unit_price') {
    const qty = field === 'quantity' ? (normalized as number | null) : item.quantity
    const price = field === 'unit_price' ? (normalized as number | null) : item.unit_price
    if (qty != null && price != null && qty > 0 && price > 0) {
      updateData.subtotal = round2(qty * price)
    }
  }

  const { error } = await supabase
    .from('invoice_items')
    .update(updateData)
    .eq('id', itemId)

  if (error) return { error: handleDbError(error, 'Failed to update item') }

  const totalErr = await validateInvoiceTotalAfterItemChange(supabase, item.invoice_id)
  if (totalErr) return { error: totalErr }

  revalidateInvoicePages()
  return {}
}

export async function addInvoiceItem(
  invoiceId: string,
  data: { title: string; category?: string; quantity?: number; unit_of_measure?: string; unit_price?: number; subtotal: number },
): Promise<{ error?: string }> {
  if (!data.title.trim()) return { error: 'Title is required' }
  if (data.subtotal <= 0) return { error: 'Subtotal must be greater than 0' }

  const supabase = await createServerSupabaseClient()

  const { error } = await supabase
    .from('invoice_items')
    .insert({
      invoice_id: invoiceId,
      title: data.title.trim(),
      category: data.category || null,
      quantity: data.quantity ?? null,
      unit_of_measure: data.unit_of_measure?.trim() || null,
      unit_price: data.unit_price ?? null,
      subtotal: data.subtotal,
    })

  if (error) return { error: handleDbError(error, 'Failed to add item') }

  const totalErr = await validateInvoiceTotalAfterItemChange(supabase, invoiceId)
  if (totalErr) return { error: totalErr }

  revalidateInvoicePages()
  return {}
}

export async function removeInvoiceItem(
  itemId: string,
): Promise<{ error?: string }> {
  const supabase = await createServerSupabaseClient()

  const { data: item } = await supabase
    .from('invoice_items')
    .select('id, invoice_id')
    .eq('id', itemId)
    .single()
  if (!item) return { error: 'Item not found' }

  const { count } = await supabase
    .from('invoice_items')
    .select('id', { count: 'exact', head: true })
    .eq('invoice_id', item.invoice_id)
  if ((count ?? 0) <= 1) return { error: 'Invoice must have at least one line item' }

  const { error } = await supabase
    .from('invoice_items')
    .delete()
    .eq('id', itemId)

  if (error) return { error: handleDbError(error, 'Failed to remove item') }

  const totalErr = await validateInvoiceTotalAfterItemChange(supabase, item.invoice_id)
  if (totalErr) return { error: totalErr }

  revalidateInvoicePages()
  return {}
}

