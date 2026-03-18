'use server'

import { revalidatePath } from 'next/cache'
import { createServerSupabaseClient } from '@/lib/supabase/server'
import { getInvoiceDetail, getLoanDetail, getPartnerPayableDetails, getPartnerReceivableDetails, getBankTransactions, searchEntities, getNextProjectCode, getBankAccountsForPartner, getExchangeRateForDate } from '@/lib/queries'
import type { PartnerPayableDetail, PartnerReceivableDetail, BankTransaction, Currency } from '@/lib/types'

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

  // Validate amount > 0
  if (input.amount <= 0) return { error: 'Amount must be greater than 0' }

  // Validate bank_account_id required unless retencion
  if (input.payment_type !== 'retencion' && !input.bank_account_id) {
    return { error: 'Bank account is required for this payment type' }
  }

  // Validate bank account currency matches payment currency
  if (input.bank_account_id) {
    const { data: bankAccount } = await supabase
      .from('bank_accounts')
      .select('currency')
      .eq('id', input.bank_account_id)
      .single()
    if (!bankAccount) return { error: 'Bank account not found' }
    if (bankAccount.currency !== input.currency) {
      return { error: 'Bank account currency does not match payment currency' }
    }
  }

  // Re-query balances and validate per payment type
  // View handles cross-currency detraccion conversion (PEN payments on USD invoices)
  if (input.related_to === 'invoice') {
    const { data: inv } = await supabase
      .from('v_invoice_balances')
      .select('bdn_outstanding_pen, retencion_outstanding, payable_or_receivable')
      .eq('invoice_id', input.related_id)
      .single()
    if (!inv) return { error: 'Invoice not found' }
    const bdnOutstandingPen = inv.bdn_outstanding_pen ?? 0
    const retencionOutstanding = inv.retencion_outstanding ?? 0
    const payable = inv.payable_or_receivable ?? 0
    let maxAmount: number
    if (input.payment_type === 'detraccion') {
      // Detraccion is always paid in PEN — validate against PEN outstanding
      maxAmount = bdnOutstandingPen
    } else if (input.payment_type === 'retencion') {
      maxAmount = retencionOutstanding
    } else {
      maxAmount = payable
    }
    if (input.amount > maxAmount) {
      return { error: `Amount exceeds ${input.payment_type} limit (${maxAmount})` }
    }
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

  if (error) return { error: error.message }

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

// --- Project Budgets ---

export async function upsertProjectBudget(
  projectId: string,
  category: string,
  budgetedAmount: number,
  currency: string
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
}): Promise<{ error?: string }> {
  const supabase = await createServerSupabaseClient()

  if (data.amount <= 0) return { error: 'Amount must be greater than 0' }
  if (data.return_type === 'percentage' && (data.agreed_return_rate == null || data.agreed_return_rate < 0)) {
    return { error: 'Agreed return rate is required for percentage return type' }
  }
  if (data.return_type === 'fixed' && (data.agreed_return_amount == null || data.agreed_return_amount < 0)) {
    return { error: 'Agreed return amount is required for fixed return type' }
  }

  const { error } = await supabase.from('loans').insert({
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
  })

  if (error) return { error: error.message }
  revalidatePath('/financial-position')
  revalidatePath('/calendar')
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

  if (error) return { error: error.message }
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
  notes?: string
}): Promise<{ error?: string }> {
  const supabase = await createServerSupabaseClient()

  if (data.amount <= 0) return { error: 'Amount must be greater than 0' }

  // Validate against schedule entry outstanding
  const { data: existingPayments } = await supabase
    .from('payments')
    .select('amount')
    .eq('related_to', 'loan_schedule')
    .eq('related_id', data.schedule_entry_id)

  const { data: scheduleEntry } = await supabase
    .from('loan_schedule')
    .select('scheduled_amount')
    .eq('id', data.schedule_entry_id)
    .single()

  if (!scheduleEntry) return { error: 'Schedule entry not found' }

  const totalPaid = (existingPayments ?? []).reduce((s, p) => s + p.amount, 0)
  const entryOutstanding = scheduleEntry.scheduled_amount - totalPaid

  if (data.amount > entryOutstanding) {
    return { error: `Amount exceeds schedule entry outstanding (${entryOutstanding.toFixed(2)})` }
  }

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
    bank_account_id: null,
    notes: data.notes?.trim() || null,
  })

  if (error) return { error: error.message }

  revalidatePath('/calendar')
  revalidatePath('/invoices')
  revalidatePath('/payments')
  revalidatePath('/financial-position')
  return {}
}
