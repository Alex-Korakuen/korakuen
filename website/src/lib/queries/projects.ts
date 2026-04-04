import type { SupabaseClient } from '@supabase/supabase-js'
import { createServerSupabaseClient } from '../supabase/server'
import { buildEntityNameMap, buildEntityTagsMap, DEFAULT_CURRENCY, round2, convertToPen } from './shared'
import type {
  Currency,
  ProjectListItem,
  ProjectCardItem,
  ProjectDetailData,
  ProjectEntitySummary,
  ProjectPartnerRow,
} from '../types'

export async function getProjectsList(): Promise<ProjectListItem[]> {
  const supabase = await createServerSupabaseClient()
  const { data, error } = await supabase
    .from('projects')
    .select('id, project_code, name, status, contract_value, contract_currency')
    .eq('is_active', true)
    .order('project_code')

  if (error) throw error
  return (data ?? []) as ProjectListItem[]
}

export async function getProjectsCardData(): Promise<ProjectCardItem[]> {
  const supabase = await createServerSupabaseClient()

  // 1. Fetch all active projects
  const { data: projects, error: pErr } = await supabase
    .from('projects')
    .select('id, project_code, name, status, contract_value, contract_currency')
    .eq('is_active', true)
    .order('project_code')
  if (pErr) throw pErr
  if (!projects || projects.length === 0) return []

  const projectIds = projects.map(p => p.id)

  // 2. Fetch partners, budget aggregates, costs, and receivables in parallel
  const [partnersResult, budgetResult, costResult, receivableResult] = await Promise.all([
    supabase
      .from('project_partners')
      .select('project_id, partner_id, profit_share_pct')
      .in('project_id', projectIds)
      .eq('is_active', true),
    supabase
      .from('v_budget_vs_actual')
      .select('project_id, budgeted_amount, actual_amount')
      .in('project_id', projectIds),
    supabase
      .from('v_invoice_totals')
      .select('project_id, partner_id, subtotal, currency, exchange_rate')
      .eq('direction', 'payable')
      .eq('cost_type', 'project_cost')
      .in('project_id', projectIds),
    supabase
      .from('invoices')
      .select('id, project_id, partner_id, currency, cost_type')
      .eq('direction', 'receivable')
      .in('project_id', projectIds)
      .eq('is_active', true),
  ])
  if (partnersResult.error) throw partnersResult.error
  if (budgetResult.error) throw budgetResult.error
  if (costResult.error) throw costResult.error
  if (receivableResult.error) throw receivableResult.error

  // Exclude intercompany receivables — settlement.ts does the same so balances match
  const nonIntercompanyReceivables = (receivableResult.data ?? []).filter(r => r.cost_type !== 'intercompany')

  // 3. Fetch payments for all receivable invoices (one query)
  const receivableIds = nonIntercompanyReceivables.map(r => r.id)
  const paymentsByReceivable = new Map<string, number>()
  if (receivableIds.length > 0) {
    const { data: arPayments, error: pmtErr } = await supabase
      .from('payments')
      .select('related_id, amount, currency, exchange_rate')
      .in('related_id', receivableIds)
      .eq('related_to', 'invoice')
      .eq('is_active', true)
    if (pmtErr) throw pmtErr
    for (const p of arPayments ?? []) {
      const amountPen = convertToPen(p.amount ?? 0, p.currency ?? DEFAULT_CURRENCY, p.exchange_rate)
      paymentsByReceivable.set(p.related_id, (paymentsByReceivable.get(p.related_id) ?? 0) + amountPen)
    }
  }

  // 4. Build lookup maps

  // Partners grouped by project
  const partnersByProject = new Map<string, Array<{ partner_id: string; profit_share_pct: number }>>()
  for (const pp of partnersResult.data ?? []) {
    const list = partnersByProject.get(pp.project_id) ?? []
    list.push({ partner_id: pp.partner_id, profit_share_pct: pp.profit_share_pct })
    partnersByProject.set(pp.project_id, list)
  }

  // Budget aggregates per project
  const budgetMap = new Map<string, { budgeted: number; actual: number }>()
  for (const b of budgetResult.data ?? []) {
    if (!b.project_id) continue
    const existing = budgetMap.get(b.project_id) ?? { budgeted: 0, actual: 0 }
    existing.budgeted += b.budgeted_amount ?? 0
    existing.actual += b.actual_amount ?? 0
    budgetMap.set(b.project_id, existing)
  }

  // Costs per project per partner (PEN)
  const costsByProjectPartner = new Map<string, Map<string, number>>()
  for (const ct of costResult.data ?? []) {
    if (!ct.partner_id || !ct.project_id) continue
    const projectMap = costsByProjectPartner.get(ct.project_id) ?? new Map()
    const amountPen = convertToPen(ct.subtotal ?? 0, ct.currency, ct.exchange_rate)
    projectMap.set(ct.partner_id, (projectMap.get(ct.partner_id) ?? 0) + amountPen)
    costsByProjectPartner.set(ct.project_id, projectMap)
  }

  // Revenue per project per partner (PEN) — intercompany already filtered out above
  const revenueByProjectPartner = new Map<string, Map<string, number>>()
  for (const inv of nonIntercompanyReceivables) {
    if (!inv.partner_id || !inv.project_id) continue
    const paidAmount = paymentsByReceivable.get(inv.id) ?? 0
    if (paidAmount === 0) continue
    const projectMap = revenueByProjectPartner.get(inv.project_id) ?? new Map()
    projectMap.set(inv.partner_id, (projectMap.get(inv.partner_id) ?? 0) + paidAmount)
    revenueByProjectPartner.set(inv.project_id, projectMap)
  }

  // 5. Build card items
  return projects.map(p => {
    const partners = partnersByProject.get(p.id) ?? []
    const budget = budgetMap.get(p.id)

    // Expense total: sum all project costs from costsByProjectPartner (independent of budget)
    const costMap = costsByProjectPartner.get(p.id) ?? new Map()
    const totalExpense = [...costMap.values()].reduce((sum, v) => sum + v, 0)

    const budgetPct = budget && budget.budgeted > 0
      ? Math.round((totalExpense / budget.budgeted) * 1000) / 10
      : null

    // Settlement: check if all partner balances are zero
    let isSettled: boolean | null = null
    if (partners.length > 0) {
      const revMap = revenueByProjectPartner.get(p.id) ?? new Map()
      const totalCosts = [...costMap.values()].reduce((sum, v) => sum + v, 0)
      const totalRevenue = [...revMap.values()].reduce((sum, v) => sum + v, 0)
      const totalProfit = totalRevenue - totalCosts

      isSettled = true
      for (const partner of partners) {
        const costs = costMap.get(partner.partner_id) ?? 0
        const revenue = revMap.get(partner.partner_id) ?? 0
        const profit = round2(revenue - costs)
        const shouldReceive = round2(totalProfit * (partner.profit_share_pct / 100))
        const balance = round2(shouldReceive - profit)
        if (balance !== 0) {
          isSettled = false
          break
        }
      }
    }

    return {
      id: p.id,
      project_code: p.project_code,
      name: p.name,
      status: p.status,
      contract_value: p.contract_value,
      contract_currency: p.contract_currency as Currency | null,
      partner_count: partners.length,
      budget_total: budget ? round2(budget.budgeted) : null,
      expense_total: totalExpense > 0 ? round2(totalExpense) : null,
      budget_pct: budgetPct,
      is_settled: isSettled,
    }
  })
}

/** Group payable-invoice spending by entity (entityId → per-currency totals + count). */
async function fetchProjectSpendingByEntity(
  supabase: SupabaseClient,
  projectId: string,
): Promise<ProjectEntitySummary[]> {
  const { data: costTotals, error } = await supabase
    .from('v_invoice_totals')
    .select('entity_id, currency, subtotal')
    .eq('direction', 'payable')
    .eq('project_id', projectId)
  if (error) throw error

  const spendingMap = new Map<string, { penSpent: number; usdSpent: number; invoiceCount: number }>()
  for (const ct of costTotals ?? []) {
    const key = ct.entity_id ?? '__none__'
    const amount = ct.subtotal ?? 0
    const currency = ct.currency ?? DEFAULT_CURRENCY
    const existing = spendingMap.get(key)
    if (existing) {
      if (currency === 'USD') existing.usdSpent += amount
      else existing.penSpent += amount
      existing.invoiceCount += 1
    } else {
      spendingMap.set(key, {
        penSpent: currency === 'USD' ? 0 : amount,
        usdSpent: currency === 'USD' ? amount : 0,
        invoiceCount: 1,
      })
    }
  }

  const spendingEntityIds = [...new Set(
    (costTotals ?? []).map(ct => ct.entity_id).filter((id): id is string => id !== null)
  )]
  const [entityMap, entityTagMap] = await Promise.all([
    buildEntityNameMap(supabase, spendingEntityIds),
    buildEntityTagsMap(supabase, spendingEntityIds),
  ])

  const entities: ProjectEntitySummary[] = []
  for (const [key, spending] of spendingMap) {
    const entityId = key === '__none__' ? null : key
    entities.push({
      entityId,
      entityName: entityId ? entityMap.get(entityId) ?? '—' : 'Other (no entity)',
      tags: entityId ? entityTagMap.get(entityId) ?? [] : [],
      penSpent: spending.penSpent,
      usdSpent: spending.usdSpent,
      invoiceCount: spending.invoiceCount,
    })
  }
  // Sort by total spent descending (PEN + USD combined for ordering)
  entities.sort((a, b) => (b.penSpent + b.usdSpent) - (a.penSpent + a.usdSpent))
  return entities
}

/** Look up a client's display name from entities by id. */
async function fetchProjectClientName(
  supabase: SupabaseClient,
  clientEntityId: string | null,
): Promise<string | null> {
  if (!clientEntityId) return null
  const { data, error } = await supabase
    .from('entities')
    .select('legal_name')
    .eq('id', clientEntityId)
    .single()
  if (error && error.code !== 'PGRST116') throw error
  return data?.legal_name || null
}

type ProjectPartnerRecord = { id: string; partner_id: string; profit_share_pct: number }

/** Resolve partner records into display rows with names. */
async function buildProjectPartnerRows(
  supabase: SupabaseClient,
  ppData: ProjectPartnerRecord[],
): Promise<ProjectPartnerRow[]> {
  const partnerIds = [...new Set(ppData.map(pp => pp.partner_id))]
  const partnerNameMap = await buildEntityNameMap(supabase, partnerIds)
  return ppData.map(pp => ({
    id: pp.id,
    partnerId: pp.partner_id,
    partnerName: partnerNameMap.get(pp.partner_id) ?? '—',
    profitSharePct: pp.profit_share_pct,
  }))
}

/** Sum actual costs per category in PEN for a project's payable invoices. */
async function fetchActualCostsByCategory(
  supabase: SupabaseClient,
  projectId: string,
): Promise<Record<string, number>> {
  const { data: invoicesWithItems, error } = await supabase
    .from('invoices')
    .select('currency, exchange_rate, invoice_items(category, subtotal)')
    .eq('project_id', projectId)
    .eq('direction', 'payable')
    .eq('cost_type', 'project_cost')
    .eq('is_active', true)
    .or('quote_status.is.null,quote_status.eq.accepted')
  if (error) throw error

  const totals: Record<string, number> = {}
  for (const inv of invoicesWithItems ?? []) {
    for (const item of inv.invoice_items ?? []) {
      if (item.category) {
        const amountPen = convertToPen(item.subtotal ?? 0, inv.currency, inv.exchange_rate)
        totals[item.category] = (totals[item.category] ?? 0) + amountPen
      }
    }
  }
  return totals
}

export async function getProjectDetail(projectId: string): Promise<ProjectDetailData> {
  const supabase = await createServerSupabaseClient()

  // Fetch project, project_partners, and budget rows in parallel
  const [projectResult, ppResult, budgetResult] = await Promise.all([
    supabase.from('projects').select('*').eq('id', projectId).eq('is_active', true).single(),
    supabase.from('project_partners').select('id, partner_id, profit_share_pct').eq('project_id', projectId).eq('is_active', true),
    supabase.from('v_budget_vs_actual').select('*').eq('project_id', projectId),
  ])
  if (projectResult.error) throw projectResult.error
  if (ppResult.error) throw ppResult.error
  if (budgetResult.error) throw budgetResult.error
  const project = projectResult.data

  // Derived sections — independent, fetched concurrently
  const [entities, clientName, partners, actualCostsByCategory] = await Promise.all([
    fetchProjectSpendingByEntity(supabase, projectId),
    fetchProjectClientName(supabase, project.client_entity_id),
    buildProjectPartnerRows(supabase, ppResult.data ?? []),
    fetchActualCostsByCategory(supabase, projectId),
  ])

  return {
    project,
    clientName,
    entities,
    budget: (budgetResult.data ?? []) as typeof budgetResult.data & { length: number },
    actualCostsByCategory,
    partners,
  }
}
