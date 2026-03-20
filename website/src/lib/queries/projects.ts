import { createServerSupabaseClient } from '../supabase/server'
import { buildEntityNameMap, buildEntityTagsMap, DEFAULT_CURRENCY, round2, convertToPen } from './shared'
import type {
  ProjectListItem,
  ProjectCardItem,
  ProjectDetailData,
  ProjectEntitySummary,
  ProjectPartnerRow,
  ProjectPartnerSettlement,
  PartnerPayableDetail,
  PartnerReceivableDetail,
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
      .select('project_id, partner_company_id, profit_share_pct')
      .in('project_id', projectIds)
      .eq('is_active', true),
    supabase
      .from('v_budget_vs_actual')
      .select('project_id, budgeted_amount, actual_amount')
      .in('project_id', projectIds),
    supabase
      .from('v_invoice_totals')
      .select('project_id, partner_company_id, subtotal, currency, exchange_rate')
      .eq('direction', 'payable')
      .eq('cost_type', 'project_cost')
      .in('project_id', projectIds),
    supabase
      .from('invoices')
      .select('id, project_id, partner_company_id, currency')
      .eq('direction', 'receivable')
      .in('project_id', projectIds)
      .eq('is_active', true),
  ])
  if (partnersResult.error) throw partnersResult.error
  if (budgetResult.error) throw budgetResult.error
  if (costResult.error) throw costResult.error
  if (receivableResult.error) throw receivableResult.error

  // 3. Fetch payments for all receivable invoices (one query)
  const receivableIds = (receivableResult.data ?? []).map(r => r.id)
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
  const partnersByProject = new Map<string, Array<{ partner_company_id: string; profit_share_pct: number }>>()
  for (const pp of partnersResult.data ?? []) {
    const list = partnersByProject.get(pp.project_id) ?? []
    list.push({ partner_company_id: pp.partner_company_id, profit_share_pct: pp.profit_share_pct })
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
    if (!ct.partner_company_id || !ct.project_id) continue
    const projectMap = costsByProjectPartner.get(ct.project_id) ?? new Map()
    const amountPen = convertToPen(ct.subtotal ?? 0, ct.currency, ct.exchange_rate)
    projectMap.set(ct.partner_company_id, (projectMap.get(ct.partner_company_id) ?? 0) + amountPen)
    costsByProjectPartner.set(ct.project_id, projectMap)
  }

  // Revenue per project per partner (PEN)
  const revenueByProjectPartner = new Map<string, Map<string, number>>()
  for (const inv of receivableResult.data ?? []) {
    if (!inv.partner_company_id || !inv.project_id) continue
    const paidAmount = paymentsByReceivable.get(inv.id) ?? 0
    if (paidAmount === 0) continue
    const projectMap = revenueByProjectPartner.get(inv.project_id) ?? new Map()
    projectMap.set(inv.partner_company_id, (projectMap.get(inv.partner_company_id) ?? 0) + paidAmount)
    revenueByProjectPartner.set(inv.project_id, projectMap)
  }

  // 5. Build card items
  return projects.map(p => {
    const partners = partnersByProject.get(p.id) ?? []
    const budget = budgetMap.get(p.id)
    const budgetPct = budget && budget.budgeted > 0
      ? Math.round((budget.actual / budget.budgeted) * 1000) / 10
      : null

    // Settlement: check if all partner balances are zero
    let isSettled: boolean | null = null
    if (partners.length > 0) {
      const costMap = costsByProjectPartner.get(p.id) ?? new Map()
      const revMap = revenueByProjectPartner.get(p.id) ?? new Map()
      const totalCosts = [...costMap.values()].reduce((sum, v) => sum + v, 0)
      const totalRevenue = [...revMap.values()].reduce((sum, v) => sum + v, 0)
      const totalProfit = totalRevenue - totalCosts

      isSettled = true
      for (const partner of partners) {
        const costs = costMap.get(partner.partner_company_id) ?? 0
        const revenue = revMap.get(partner.partner_company_id) ?? 0
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
      contract_currency: p.contract_currency,
      partner_count: partners.length,
      budget_pct: budgetPct,
      is_settled: isSettled,
    }
  })
}

export async function getProjectDetail(projectId: string): Promise<ProjectDetailData> {
  const supabase = await createServerSupabaseClient()

  // 1. Fetch project, project_partners, budget, AR invoices in parallel
  const [projectResult, ppResult, budgetResult] = await Promise.all([
    supabase.from('projects').select('*').eq('id', projectId).eq('is_active', true).single(),
    supabase.from('project_partners').select('id, partner_company_id, profit_share_pct').eq('project_id', projectId).eq('is_active', true),
    supabase.from('v_budget_vs_actual').select('*').eq('project_id', projectId),
  ])

  if (projectResult.error) throw projectResult.error
  if (ppResult.error) throw ppResult.error
  if (budgetResult.error) throw budgetResult.error
  const project = projectResult.data

  // 2. Spending by entity: query v_invoice_totals for payable invoices, group by (entity_id, currency)
  const { data: costTotals, error: costTotalsError } = await supabase
    .from('v_invoice_totals')
    .select('entity_id, currency, subtotal')
    .eq('direction', 'payable')
    .eq('project_id', projectId)

  if (costTotalsError) throw costTotalsError

  const spendingMap = new Map<string, { totalSpent: number; invoiceCount: number }>()
  for (const ct of costTotals ?? []) {
    const key = `${ct.entity_id ?? '__none__'}|${ct.currency ?? DEFAULT_CURRENCY}`
    const existing = spendingMap.get(key)
    if (existing) {
      existing.totalSpent += ct.subtotal ?? 0
      existing.invoiceCount += 1
    } else {
      spendingMap.set(key, {
        totalSpent: ct.subtotal ?? 0,
        invoiceCount: 1,
      })
    }
  }

  // Look up entity names and tags for entities with spending
  const spendingEntityIds = [...new Set(
    (costTotals ?? []).map(ct => ct.entity_id).filter((id): id is string => id !== null)
  )]
  const entityMap = await buildEntityNameMap(supabase, spendingEntityIds)

  // Fetch tags for these entities
  const entityTagMap = await buildEntityTagsMap(supabase, spendingEntityIds)

  const entities: ProjectEntitySummary[] = []
  for (const [key, spending] of spendingMap) {
    const [entityIdRaw, currency] = key.split('|')
    const entityId = entityIdRaw === '__none__' ? null : entityIdRaw
    entities.push({
      entityId,
      entityName: entityId ? entityMap.get(entityId) ?? '—' : 'Other (no entity)',
      tags: entityId ? entityTagMap.get(entityId) ?? [] : [],
      totalSpent: spending.totalSpent,
      invoiceCount: spending.invoiceCount,
      currency,
    })
  }

  // Sort by totalSpent descending
  entities.sort((a, b) => (b.totalSpent ?? -1) - (a.totalSpent ?? -1))

  // 4. Client name
  let clientName: string | null = null
  if (project.client_entity_id) {
    const { data: clientEntity, error: clientError } = await supabase
      .from('entities')
      .select('legal_name')
      .eq('id', project.client_entity_id)
      .single()
    if (clientError && clientError.code !== 'PGRST116') throw clientError
    clientName = clientEntity?.legal_name || null
  }

  // 5. Partners — build name map from partner_companies
  const ppData = ppResult.data ?? []
  const partnerCompanyIds = [...new Set(ppData.map(pp => pp.partner_company_id))]
  let partnerNameMap = new Map<string, string>()
  if (partnerCompanyIds.length > 0) {
    const { data: pcData, error: pcError } = await supabase
      .from('partner_companies')
      .select('id, name')
      .in('id', partnerCompanyIds)
    if (pcError) throw pcError
    for (const pc of pcData ?? []) {
      partnerNameMap.set(pc.id, pc.name)
    }
  }
  const partners: ProjectPartnerRow[] = ppData.map(pp => ({
    id: pp.id,
    partnerCompanyId: pp.partner_company_id,
    partnerName: partnerNameMap.get(pp.partner_company_id) ?? '—',
    profitSharePct: pp.profit_share_pct,
  }))

  // 7. Partner settlements — compute cost contributions + AR payments received
  let partnerSettlements: ProjectPartnerSettlement[] = []
  if (partners.length > 0) {
    // Fetch project costs per partner from v_invoice_totals (project_cost only, SGA excluded)
    const { data: costTotals, error: settlementCostError } = await supabase
      .from('v_invoice_totals')
      .select('partner_company_id, subtotal, currency, exchange_rate')
      .eq('direction', 'payable')
      .eq('project_id', projectId)
      .eq('cost_type', 'project_cost')
    if (settlementCostError) throw settlementCostError

    // Sum cost contributions per partner in PEN
    const costsByPartner = new Map<string, number>()
    for (const ct of costTotals ?? []) {
      if (!ct.partner_company_id) continue
      const amountPen = convertToPen(ct.subtotal ?? 0, ct.currency, ct.exchange_rate)
      costsByPartner.set(ct.partner_company_id, (costsByPartner.get(ct.partner_company_id) ?? 0) + amountPen)
    }

    // Get actual AR payments received per partner
    const { data: projectReceivables, error: recvError } = await supabase
      .from('invoices')
      .select('id, partner_company_id, currency')
      .eq('direction', 'receivable')
      .eq('project_id', projectId)
      .eq('is_active', true)
    if (recvError) throw recvError

    const receivableIds = (projectReceivables ?? []).map(a => a.id)
    const receivedByPartner = new Map<string, number>()

    if (receivableIds.length > 0) {
      const { data: arPayments, error: arPmtError } = await supabase
        .from('payments')
        .select('related_id, amount, currency, exchange_rate')
        .in('related_id', receivableIds)
        .eq('related_to', 'invoice')
        .eq('is_active', true)
      if (arPmtError) throw arPmtError

      const receivablePartnerMap = new Map<string, { partner_company_id: string; currency: string }>()
      for (const inv of projectReceivables ?? []) {
        if (inv.partner_company_id) {
          receivablePartnerMap.set(inv.id, { partner_company_id: inv.partner_company_id, currency: inv.currency })
        }
      }

      for (const p of arPayments ?? []) {
        const invInfo = receivablePartnerMap.get(p.related_id)
        if (!invInfo) continue
        const paymentCurrency = p.currency ?? invInfo.currency
        const amountPen = convertToPen(p.amount ?? 0, paymentCurrency, p.exchange_rate)
        receivedByPartner.set(invInfo.partner_company_id, (receivedByPartner.get(invInfo.partner_company_id) ?? 0) + amountPen)
      }
    }

    // Compute total project profit (sum of all revenue received - sum of all costs)
    const totalCosts = [...costsByPartner.values()].reduce((sum, v) => sum + v, 0)
    const totalRevenue = [...receivedByPartner.values()].reduce((sum, v) => sum + v, 0)
    const totalProjectProfit = totalRevenue - totalCosts

    // Build settlement rows — one per partner
    partnerSettlements = partners.map(p => {
      const costsContributed = costsByPartner.get(p.partnerCompanyId) ?? 0
      const revenueReceived = receivedByPartner.get(p.partnerCompanyId) ?? 0
      const profit = round2(revenueReceived - costsContributed)
      const shouldReceive = round2(totalProjectProfit * (p.profitSharePct / 100))
      const balance = round2(shouldReceive - profit)
      return {
        partnerCompanyId: p.partnerCompanyId,
        partnerName: p.partnerName,
        profitSharePct: p.profitSharePct,
        costsContributed,
        revenueReceived: round2(revenueReceived),
        profit,
        shouldReceive,
        balance,
      }
    })
  }

  return {
    project,
    clientName,
    entities,
    budget: (budgetResult.data ?? []) as typeof budgetResult.data & { length: number },
    partners,
    partnerSettlements,
  }
}

export async function getPartnerPayableDetails(
  projectId: string,
  partnerCompanyId: string,
): Promise<PartnerPayableDetail[]> {
  const supabase = await createServerSupabaseClient()

  // Get all payable invoices for this project by this partner
  const { data: invoices, error } = await supabase
    .from('v_invoice_totals')
    .select('invoice_id, invoice_date, invoice_number, currency, subtotal, exchange_rate')
    .eq('direction', 'payable')
    .eq('project_id', projectId)
    .eq('partner_company_id', partnerCompanyId)
    .order('invoice_date', { ascending: false })

  if (error) throw error
  if (!invoices || invoices.length === 0) return []

  return invoices.map(inv => {
    const subtotal = inv.subtotal ?? 0
    return {
      invoice_id: inv.invoice_id!,
      date: inv.invoice_date,
      invoice_number: inv.invoice_number,
      subtotal,
      currency: inv.currency,
      exchange_rate: inv.exchange_rate ? Number(inv.exchange_rate) : null,
      subtotal_pen: round2(convertToPen(subtotal, inv.currency, inv.exchange_rate)),
    }
  })
}

export async function getPartnerReceivableDetails(
  projectId: string,
  partnerCompanyId: string,
): Promise<PartnerReceivableDetail[]> {
  const supabase = await createServerSupabaseClient()

  // Get receivable invoices for this project+partner
  const { data: invoices, error: invError } = await supabase
    .from('invoices')
    .select('id, invoice_number, currency')
    .eq('direction', 'receivable')
    .eq('project_id', projectId)
    .eq('partner_company_id', partnerCompanyId)
  if (invError) throw invError

  if (!invoices || invoices.length === 0) return []

  const invoiceIds = invoices.map(a => a.id)
  const invoiceMap = new Map(invoices.map(a => [a.id, a]))

  // Get payments linked to these receivable invoices
  const { data: payments, error: pmtError } = await supabase
    .from('payments')
    .select('id, related_id, payment_date, amount, currency, exchange_rate')
    .in('related_id', invoiceIds)
    .eq('related_to', 'invoice')
    .eq('is_active', true)
    .order('payment_date', { ascending: false })
  if (pmtError) throw pmtError

  return (payments ?? []).map(p => {
    const inv = invoiceMap.get(p.related_id)
    const currency = p.currency ?? inv?.currency ?? DEFAULT_CURRENCY
    const amount = p.amount ?? 0
    return {
      payment_id: p.id,
      payment_date: p.payment_date,
      invoice_number: inv?.invoice_number ?? null,
      amount,
      currency,
      exchange_rate: p.exchange_rate ? Number(p.exchange_rate) : null,
      amount_pen: round2(convertToPen(amount, currency, p.exchange_rate)),
    }
  })
}
