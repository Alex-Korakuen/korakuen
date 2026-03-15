import { createServerSupabaseClient } from '../supabase/server'
import { convertAmount } from '../formatters'
import type { CashFlowData, CashFlowMonth, CashFlowProject } from '../types'
import type { SupabaseClient } from '@supabase/supabase-js'

const MONTH_LABELS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']

function toMonthKey(dateStr: string): string {
  // Returns YYYY-MM from a date string
  return dateStr.substring(0, 7)
}

function getMonthLabel(monthKey: string): string {
  const [year, month] = monthKey.split('-')
  return `${MONTH_LABELS[parseInt(month, 10) - 1]} ${year}`
}

type CategoryTotals = {
  materials: number
  labor: number
  subcontractor: number
  equipment: number
  other: number
  sga: number
}

function mapCategory(category: string | null, costType: string | null, sgaKeys: Set<string>): keyof CategoryTotals {
  if (costType === 'sga') return 'sga'
  if (category && sgaKeys.has(category)) return 'sga'
  switch (category) {
    case 'materials': return 'materials'
    case 'labor': return 'labor'
    case 'subcontractor': return 'subcontractor'
    case 'equipment_rental': return 'equipment'
    default: return 'other'
  }
}

function emptyCategoryTotals(): CategoryTotals {
  return { materials: 0, labor: 0, subcontractor: 0, equipment: 0, other: 0, sga: 0 }
}

type MonthBucket = {
  cashInByProject: Record<string, number>
  loansCashIn: number
  categories: CategoryTotals
  loanRepayment: number
}

type CashFlowRawData = {
  payments: { id: string; related_to: string; related_id: string; direction: string; payment_type: string; payment_date: string; amount: number; currency: string; exchange_rate: number; partner_company_id: string }[]
  payableBalances: { invoice_id: string; project_id: string | null; due_date: string | null; outstanding: number; currency: string; exchange_rate: number | null; cost_type: string | null; partner_company_id: string | null }[]
  receivableBalances: { invoice_id: string; project_id: string | null; due_date: string | null; outstanding: number; currency: string; exchange_rate: number; partner_company_id: string | null }[]
  loanSchedule: { id: string; loan_id: string; scheduled_date: string; scheduled_amount: number; exchange_rate: number | null; loans: { currency: string; project_id: string | null; partner_company_id: string | null }[] }[]
  loanDisbursements: { id: string; amount: number; currency: string; exchange_rate: number | null; date_borrowed: string; project_id: string | null; partner_company_id: string }[]
  allProjects: { id: string; project_code: string; name: string }[]
  forecastRate: number | null
}

type CashFlowMaps = {
  invoiceProjectMap: Map<string, string | null>
  invoiceTypeMap: Map<string, string>
  invoiceDirectionMap: Map<string, string>
  invoiceCategoryMap: Map<string, { category: string; proportion: number }[]>
  loanProjectMap: Map<string, string | null>
  loanPartnerMap: Map<string, string | null>
  scheduleToLoanMap: Map<string, string>
}

async function fetchCashFlowData(supabase: SupabaseClient, year: number): Promise<CashFlowRawData> {
  const yearStart = `${year}-01-01`
  const yearEnd = `${year}-12-31`

  const [
    paymentsResult,
    payableBalancesResult,
    receivableBalancesResult,
    loanScheduleResult,
    loansResult,
    latestRate,
    projectsResult,
  ] = await Promise.all([
    supabase
      .from('payments')
      .select('id, related_to, related_id, direction, payment_type, payment_date, amount, currency, exchange_rate, partner_company_id')
      .gte('payment_date', yearStart)
      .lte('payment_date', yearEnd),
    supabase
      .from('v_invoice_balances')
      .select('invoice_id, project_id, due_date, outstanding, currency, exchange_rate, cost_type, partner_company_id')
      .eq('direction', 'payable')
      .in('payment_status', ['pending', 'partial'])
      .not('due_date', 'is', null),
    supabase
      .from('v_invoice_balances')
      .select('invoice_id, project_id, due_date, outstanding, currency, exchange_rate, partner_company_id')
      .eq('direction', 'receivable')
      .in('payment_status', ['pending', 'partial'])
      .not('due_date', 'is', null),
    supabase
      .from('loan_schedule')
      .select('id, loan_id, scheduled_date, scheduled_amount, exchange_rate, loans!fk_loan_schedule_loans(currency, project_id, partner_company_id)'),
    supabase
      .from('loans')
      .select('id, amount, currency, exchange_rate, date_borrowed, project_id, partner_company_id')
      .gte('date_borrowed', yearStart)
      .lte('date_borrowed', yearEnd),
    supabase
      .from('exchange_rates')
      .select('mid_rate, rate_date')
      .order('rate_date', { ascending: false })
      .limit(1)
      .single(),
    supabase
      .from('projects')
      .select('id, project_code, name')
      .eq('is_active', true)
      .order('project_code'),
  ])

  if (paymentsResult.error) throw paymentsResult.error
  if (payableBalancesResult.error) throw payableBalancesResult.error
  if (receivableBalancesResult.error) throw receivableBalancesResult.error
  if (loanScheduleResult.error) throw loanScheduleResult.error
  if (loansResult.error) throw loansResult.error
  if (projectsResult.error) throw projectsResult.error
  // latestRate uses .single() which errors if no rows — graceful fallback is OK here
  if (latestRate.error && latestRate.error.code !== 'PGRST116') throw latestRate.error

  return {
    payments: paymentsResult.data ?? [],
    payableBalances: payableBalancesResult.data ?? [],
    receivableBalances: receivableBalancesResult.data ?? [],
    loanSchedule: loanScheduleResult.data ?? [],
    loanDisbursements: loansResult.data ?? [],
    allProjects: projectsResult.data ?? [],
    forecastRate: latestRate.data ? Number(latestRate.data.mid_rate) : null,
  }
}

async function buildCashFlowMaps(
  supabase: SupabaseClient,
  raw: CashFlowRawData,
  hasPartnerFilter: boolean,
): Promise<CashFlowMaps> {
  // Collect relevant invoice_ids, then fetch invoice_items only for those
  const relevantInvoiceIds = new Set<string>()
  for (const ib of raw.payableBalances) {
    if (ib.invoice_id) relevantInvoiceIds.add(ib.invoice_id)
  }
  for (const p of raw.payments) {
    if (p.related_to === 'invoice' && p.related_id) relevantInvoiceIds.add(p.related_id)
  }
  const invoiceItems: { invoice_id: string; category: string; subtotal: number }[] = []
  if (relevantInvoiceIds.size > 0) {
    const { data, error } = await supabase
      .from('invoice_items')
      .select('invoice_id, category, subtotal')
      .in('invoice_id', [...relevantInvoiceIds])
    if (error) throw error
    if (data) invoiceItems.push(...data)
  }

  // invoice_id -> project_id, cost_type, and direction from balance data
  const invoiceProjectMap = new Map<string, string | null>()
  const invoiceTypeMap = new Map<string, string>()
  const invoiceDirectionMap = new Map<string, string>()
  for (const ib of raw.payableBalances) {
    if (ib.invoice_id) {
      invoiceProjectMap.set(ib.invoice_id, ib.project_id)
      if (ib.cost_type) invoiceTypeMap.set(ib.invoice_id, ib.cost_type)
      invoiceDirectionMap.set(ib.invoice_id, 'payable')
    }
  }
  for (const ib of raw.receivableBalances) {
    if (ib.invoice_id) {
      invoiceProjectMap.set(ib.invoice_id, ib.project_id)
      invoiceDirectionMap.set(ib.invoice_id, 'receivable')
    }
  }

  // Fetch invoice project_ids/cost_types/direction for payments referencing already-paid invoices
  const paymentInvoiceIds = raw.payments
    .filter(p => p.related_to === 'invoice')
    .map(p => p.related_id)
    .filter(id => !invoiceProjectMap.has(id))
  if (paymentInvoiceIds.length > 0) {
    const { data: extraInvoices, error } = await supabase
      .from('invoices')
      .select('id, project_id, cost_type, direction')
      .in('id', paymentInvoiceIds)
    if (error) throw error
    for (const inv of extraInvoices ?? []) {
      invoiceProjectMap.set(inv.id, inv.project_id)
      if (inv.cost_type) invoiceTypeMap.set(inv.id, inv.cost_type)
      invoiceDirectionMap.set(inv.id, inv.direction)
    }
  }

  // invoice_id -> category proportions
  const invoiceCategoryMap = new Map<string, { category: string; proportion: number }[]>()
  const invoiceSubtotals = new Map<string, number>()
  for (const item of invoiceItems) {
    invoiceSubtotals.set(item.invoice_id, (invoiceSubtotals.get(item.invoice_id) ?? 0) + (item.subtotal ?? 0))
  }
  for (const item of invoiceItems) {
    const total = invoiceSubtotals.get(item.invoice_id) ?? 1
    const entries = invoiceCategoryMap.get(item.invoice_id) ?? []
    entries.push({
      category: item.category,
      proportion: total > 0 ? (item.subtotal ?? 0) / total : 0,
    })
    invoiceCategoryMap.set(item.invoice_id, entries)
  }

  // loan_id -> project_id + partner_company_id
  const loanProjectMap = new Map<string, string | null>()
  const loanPartnerMap = new Map<string, string | null>()
  for (const loan of raw.loanDisbursements) {
    loanProjectMap.set(loan.id, loan.project_id)
    loanPartnerMap.set(loan.id, loan.partner_company_id)
  }

  // schedule_entry_id -> loan_id (for mapping loan repayment payments to loans)
  const scheduleToLoanMap = new Map<string, string>()
  for (const entry of raw.loanSchedule) {
    scheduleToLoanMap.set(entry.id, entry.loan_id)
    // Also populate loan maps from schedule entry data if not already present
    if (!loanProjectMap.has(entry.loan_id)) {
      const loanData = (entry.loans?.[0] ?? null) as { currency: string; project_id: string | null; partner_company_id: string | null } | null
      if (loanData) {
        loanProjectMap.set(entry.loan_id, loanData.project_id)
        loanPartnerMap.set(entry.loan_id, loanData.partner_company_id)
      }
    }
  }

  // Fetch loan info for any loan_schedule payments referencing loans we haven't seen
  const loanRepaymentScheduleIds = raw.payments
    .filter(p => p.related_to === 'loan_schedule')
    .map(p => p.related_id)
    .filter(id => !scheduleToLoanMap.has(id))
  if (loanRepaymentScheduleIds.length > 0) {
    const { data: extraSchedule, error: scheduleError } = await supabase
      .from('loan_schedule')
      .select('id, loan_id')
      .in('id', loanRepaymentScheduleIds)
    if (scheduleError) throw scheduleError
    for (const s of extraSchedule ?? []) {
      scheduleToLoanMap.set(s.id, s.loan_id)
    }
    const missingLoanIds = [...new Set((extraSchedule ?? []).map(s => s.loan_id))]
      .filter(id => !loanProjectMap.has(id))
    if (missingLoanIds.length > 0) {
      const { data: extraLoans, error: loansError } = await supabase
        .from('loans')
        .select('id, project_id, partner_company_id')
        .in('id', missingLoanIds)
      if (loansError) throw loansError
      for (const l of extraLoans ?? []) {
        loanProjectMap.set(l.id, l.project_id)
        loanPartnerMap.set(l.id, l.partner_company_id)
      }
    }
  }

  return { invoiceProjectMap, invoiceTypeMap, invoiceDirectionMap, invoiceCategoryMap, loanProjectMap, loanPartnerMap, scheduleToLoanMap }
}

function processMonthBuckets(
  raw: CashFlowRawData,
  maps: CashFlowMaps,
  year: number,
  projectId: string | null,
  partnerIds: string[],
  reportingCurrency: 'PEN',
  sgaKeys: Set<string>,
): Map<string, MonthBucket> {
  const hasPartnerFilter = partnerIds.length > 0
  const monthBuckets = new Map<string, MonthBucket>()
  for (let m = 1; m <= 12; m++) {
    const key = `${year}-${String(m).padStart(2, '0')}`
    monthBuckets.set(key, { cashInByProject: {}, loansCashIn: 0, categories: emptyCategoryTotals(), loanRepayment: 0 })
  }

  const today = new Date()
  const currentMonthKey = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}`

  // Actual payments
  for (const p of raw.payments) {
    if (hasPartnerFilter && !partnerIds.includes(p.partner_company_id)) continue

    // Loan schedule repayments
    if (p.related_to === 'loan_schedule') {
      const loanId = maps.scheduleToLoanMap.get(p.related_id)
      if (projectId && loanId) {
        const lpProjectId = maps.loanProjectMap.get(loanId)
        if (lpProjectId !== projectId) continue
      }
      const monthKey = toMonthKey(p.payment_date)
      const bucket = monthBuckets.get(monthKey)
      if (!bucket) continue
      bucket.loanRepayment += convertAmount(p.amount, p.currency, p.exchange_rate, reportingCurrency)
      continue
    }

    // Invoice payments (both payable and receivable)
    const pProjectId = maps.invoiceProjectMap.get(p.related_id)
    if (projectId && pProjectId !== projectId) continue

    const monthKey = toMonthKey(p.payment_date)
    const bucket = monthBuckets.get(monthKey)
    if (!bucket) continue

    const amount = convertAmount(p.amount, p.currency, p.exchange_rate, reportingCurrency)
    if (p.direction === 'inbound') {
      const projId = pProjectId ?? '_none'
      bucket.cashInByProject[projId] = (bucket.cashInByProject[projId] ?? 0) + amount
    } else {
      const categories = maps.invoiceCategoryMap.get(p.related_id)
      const costType = maps.invoiceTypeMap.get(p.related_id) ?? null
      if (categories && categories.length > 0) {
        for (const cat of categories) {
          const catKey = mapCategory(cat.category, costType, sgaKeys)
          bucket.categories[catKey] += amount * cat.proportion
        }
      } else {
        bucket.categories.other += amount
      }
    }
  }

  // Forecast: outstanding payable invoices by due_date
  for (const inv of raw.payableBalances) {
    if (!inv.due_date) continue
    const monthKey = toMonthKey(inv.due_date)
    if (monthKey <= currentMonthKey || monthKey < `${year}-01` || monthKey > `${year}-12`) continue
    if (projectId && inv.project_id !== projectId) continue
    if (hasPartnerFilter && inv.partner_company_id) {
      if (!partnerIds.includes(inv.partner_company_id)) continue
    }

    const bucket = monthBuckets.get(monthKey)
    if (!bucket) continue

    const amount = convertAmount(inv.outstanding ?? 0, inv.currency, raw.forecastRate ?? inv.exchange_rate ?? null, reportingCurrency)
    const categories = inv.invoice_id ? maps.invoiceCategoryMap.get(inv.invoice_id) : null
    const costType = inv.invoice_id ? (maps.invoiceTypeMap.get(inv.invoice_id) ?? inv.cost_type ?? null) : null
    if (categories && categories.length > 0) {
      for (const cat of categories) {
        const catKey = mapCategory(cat.category, costType, sgaKeys)
        bucket.categories[catKey] += amount * cat.proportion
      }
    } else {
      bucket.categories.other += amount
    }
  }

  // Forecast: outstanding receivable invoices by due_date
  for (const inv of raw.receivableBalances) {
    if (!inv.due_date) continue
    const monthKey = toMonthKey(inv.due_date)
    if (monthKey <= currentMonthKey || monthKey < `${year}-01` || monthKey > `${year}-12`) continue
    if (projectId && inv.project_id !== projectId) continue
    if (hasPartnerFilter && inv.partner_company_id && !partnerIds.includes(inv.partner_company_id)) continue

    const bucket = monthBuckets.get(monthKey)
    if (!bucket) continue

    const projId = inv.project_id ?? '_none'
    const amount = convertAmount(inv.outstanding ?? 0, inv.currency, raw.forecastRate ?? inv.exchange_rate, reportingCurrency)
    bucket.cashInByProject[projId] = (bucket.cashInByProject[projId] ?? 0) + amount
  }

  // Forecast: loan schedule (only entries not yet fully paid)
  // Build a set of paid amounts per schedule entry from actual payments
  const schedulePaidAmounts = new Map<string, number>()
  for (const p of raw.payments) {
    if (p.related_to === 'loan_schedule') {
      schedulePaidAmounts.set(p.related_id, (schedulePaidAmounts.get(p.related_id) ?? 0) + p.amount)
    }
  }

  for (const entry of raw.loanSchedule) {
    if (!entry.scheduled_date) continue
    const paidAmount = schedulePaidAmounts.get(entry.id) ?? 0
    const remaining = entry.scheduled_amount - paidAmount
    if (remaining <= 0) continue // fully paid

    const monthKey = toMonthKey(entry.scheduled_date)
    if (monthKey <= currentMonthKey || monthKey < `${year}-01` || monthKey > `${year}-12`) continue

    const loanData = (entry.loans?.[0] ?? null) as { currency: string; project_id: string | null; partner_company_id: string | null } | null
    if (projectId && loanData?.project_id !== projectId) continue
    if (hasPartnerFilter && loanData?.partner_company_id && !partnerIds.includes(loanData.partner_company_id)) continue

    const bucket = monthBuckets.get(monthKey)
    if (!bucket) continue

    const loanCurrency = loanData?.currency ?? 'PEN'
    bucket.loanRepayment += convertAmount(remaining, loanCurrency, raw.forecastRate ?? entry.exchange_rate ?? null, reportingCurrency)
  }

  // Actual loan disbursements as cash in
  for (const loan of raw.loanDisbursements) {
    if (projectId && loan.project_id !== projectId) continue
    if (hasPartnerFilter && !partnerIds.includes(loan.partner_company_id)) continue

    const monthKey = toMonthKey(loan.date_borrowed)
    const bucket = monthBuckets.get(monthKey)
    if (!bucket) continue

    bucket.loansCashIn += convertAmount(loan.amount, loan.currency, loan.exchange_rate ?? null, reportingCurrency)
  }

  return monthBuckets
}

function buildCashFlowResult(
  monthBuckets: Map<string, MonthBucket>,
  allProjects: { id: string; project_code: string; name: string }[],
  year: number,
): CashFlowData {
  const today = new Date()
  const currentMonthKey = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}`

  // Collect projects that appear in Cash In
  const projectIdsWithCashIn = new Set<string>()
  for (const bucket of monthBuckets.values()) {
    for (const pid of Object.keys(bucket.cashInByProject)) {
      if (pid !== '_none') projectIdsWithCashIn.add(pid)
    }
  }
  const projects: CashFlowProject[] = allProjects
    .filter(p => projectIdsWithCashIn.has(p.id))
    .map(p => ({ id: p.id, code: p.project_code, name: p.name }))

  // Build monthly rows
  const months: CashFlowMonth[] = []
  for (let m = 1; m <= 12; m++) {
    const key = `${year}-${String(m).padStart(2, '0')}`
    const bucket = monthBuckets.get(key)!
    const projectCosts = bucket.categories.materials + bucket.categories.labor +
      bucket.categories.subcontractor + bucket.categories.equipment +
      bucket.categories.other
    const cashOut = projectCosts + bucket.categories.sga + bucket.loanRepayment
    const projectCashInTotal = Object.values(bucket.cashInByProject).reduce((a, b) => a + b, 0)
    const cashIn = projectCashInTotal + bucket.loansCashIn
    const net = cashIn - cashOut
    const isActual = key <= currentMonthKey
    const isCurrentMonth = key === currentMonthKey

    months.push({
      month: key,
      label: getMonthLabel(key),
      isActual,
      isCurrentMonth,
      cashIn,
      cashInByProject: { ...bucket.cashInByProject },
      loansCashIn: bucket.loansCashIn,
      materials: bucket.categories.materials,
      labor: bucket.categories.labor,
      subcontractor: bucket.categories.subcontractor,
      equipment: bucket.categories.equipment,
      other: bucket.categories.other,
      projectCosts,
      sga: bucket.categories.sga,
      loanRepayment: bucket.loanRepayment,
      cashOut,
      net,
    })
  }

  return { months, projects }
}

export async function getCashFlow(
  year: number,
  projectId: string | null,
  partnerIds: string[],
): Promise<CashFlowData> {
  const supabase = await createServerSupabaseClient()
  const [raw, catsResult] = await Promise.all([
    fetchCashFlowData(supabase, year),
    supabase.from('categories').select('name, cost_type').eq('is_active', true),
  ])
  if (catsResult.error) throw catsResult.error
  const sgaKeys = new Set((catsResult.data ?? []).filter(c => c.cost_type === 'sga').map(c => c.name))
  const maps = await buildCashFlowMaps(supabase, raw, partnerIds.length > 0)
  const monthBuckets = processMonthBuckets(raw, maps, year, projectId, partnerIds, 'PEN', sgaKeys)
  return buildCashFlowResult(monthBuckets, raw.allProjects, year)
}
