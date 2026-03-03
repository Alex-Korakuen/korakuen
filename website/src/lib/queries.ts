import { createServerSupabaseClient } from './supabase/server'
import type { ApCalendarRow, CostBalanceRow, CostItem, Payment } from './types'

export async function getApCalendar(isAlex: boolean): Promise<ApCalendarRow[]> {
  const supabase = await createServerSupabaseClient()
  let query = supabase
    .from('v_ap_calendar')
    .select('*')
    .order('due_date', { ascending: true })

  // Partners only see supplier invoices; Alex sees everything (including loan obligations)
  if (!isAlex) {
    query = query.eq('type', 'supplier_invoice')
  }

  const { data, error } = await query
  if (error) throw error
  return (data ?? []) as ApCalendarRow[]
}

export async function getCostDetail(costId: string) {
  const supabase = await createServerSupabaseClient()

  const [costResult, itemsResult, paymentsResult] = await Promise.all([
    supabase
      .from('v_cost_balances')
      .select('*')
      .eq('cost_id', costId)
      .single(),
    supabase
      .from('cost_items')
      .select('*')
      .eq('cost_id', costId)
      .order('created_at'),
    supabase
      .from('payments')
      .select('*')
      .eq('related_id', costId)
      .eq('related_to', 'cost')
      .order('payment_date'),
  ])

  // Fetch cost header for comprobante and bank info
  const costHeaderResult = await supabase
    .from('costs')
    .select('comprobante_type, comprobante_number, document_ref, bank_account_id')
    .eq('id', costId)
    .single()

  // Fetch bank account name if available
  let bankInfo = null
  if (costHeaderResult.data?.bank_account_id) {
    const bankResult = await supabase
      .from('bank_accounts')
      .select('bank_name, account_number_last4, partner_company_id')
      .eq('id', costHeaderResult.data.bank_account_id)
      .single()
    bankInfo = bankResult.data
  }

  return {
    cost: costResult.data as CostBalanceRow | null,
    items: (itemsResult.data ?? []) as CostItem[],
    payments: (paymentsResult.data ?? []) as Payment[],
    header: costHeaderResult.data,
    bank: bankInfo,
  }
}

export async function getLoanDetail(loanId: string) {
  const supabase = await createServerSupabaseClient()

  const [loanResult, scheduleResult, paymentsResult] = await Promise.all([
    supabase
      .from('v_loan_balances')
      .select('*')
      .eq('loan_id', loanId)
      .single(),
    supabase
      .from('loan_schedule')
      .select('*')
      .eq('loan_id', loanId)
      .order('scheduled_date'),
    supabase
      .from('loan_payments')
      .select('*')
      .eq('loan_id', loanId)
      .order('payment_date'),
  ])

  return {
    loan: loanResult.data,
    schedule: scheduleResult.data ?? [],
    payments: paymentsResult.data ?? [],
  }
}

export async function getDetractionsPending() {
  const supabase = await createServerSupabaseClient()

  // Get all costs with detraccion amounts
  const { data: costs, error: costsError } = await supabase
    .from('v_cost_balances')
    .select('cost_id, project_id, entity_id, title, detraccion_amount, currency')
    .gt('detraccion_amount', 0)

  if (costsError) throw costsError
  if (!costs || costs.length === 0) return []

  // Get detraccion payments for these costs
  const costIds = costs.map(c => c.cost_id).filter((id): id is string => id !== null)
  const { data: detrPayments } = await supabase
    .from('payments')
    .select('related_id, amount')
    .in('related_id', costIds)
    .eq('related_to', 'cost')
    .eq('payment_type', 'detraccion')

  const paidMap = new Map<string, number>()
  for (const p of detrPayments ?? []) {
    const current = paidMap.get(p.related_id) ?? 0
    paidMap.set(p.related_id, current + (p.amount ?? 0))
  }

  // Get entity and project names
  const entityIds = [...new Set(costs.filter(c => c.entity_id).map(c => c.entity_id!))]
  const projectIds = [...new Set(costs.filter(c => c.project_id).map(c => c.project_id!))]

  const [entitiesResult, projectsResult] = await Promise.all([
    entityIds.length > 0
      ? supabase.from('entities').select('id, legal_name, common_name').in('id', entityIds)
      : { data: [] },
    projectIds.length > 0
      ? supabase.from('projects').select('id, project_code').in('id', projectIds)
      : { data: [] },
  ])

  const entityMap = new Map((entitiesResult.data ?? []).map(e => [e.id, e.common_name || e.legal_name]))
  const projectMap = new Map((projectsResult.data ?? []).map(p => [p.id, p.project_code]))

  return costs.map(c => ({
    cost_id: c.cost_id,
    entity_name: c.entity_id ? entityMap.get(c.entity_id) ?? '—' : '—',
    project_code: c.project_id ? projectMap.get(c.project_id) ?? '—' : '—',
    title: c.title,
    detraccion_amount: c.detraccion_amount ?? 0,
    currency: c.currency ?? 'PEN',
    deposited: paidMap.get(c.cost_id!) ?? 0,
    status: (paidMap.get(c.cost_id!) ?? 0) >= (c.detraccion_amount ?? 0) ? 'deposited' : 'pending',
  }))
}

export async function getProjectsForFilter() {
  const supabase = await createServerSupabaseClient()
  const { data } = await supabase
    .from('projects')
    .select('id, project_code, name')
    .eq('is_active', true)
    .order('project_code')
  return data ?? []
}
