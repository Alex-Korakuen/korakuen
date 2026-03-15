import { createServerSupabaseClient } from '../supabase/server'
import { buildEntityNameMap } from './shared'
import type {
  ProjectListItem,
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

export async function getProjectDetail(projectId: string): Promise<ProjectDetailData> {
  const supabase = await createServerSupabaseClient()

  // 1. Fetch project, project_partners, budget, AR invoices in parallel
  const [projectResult, ppResult, budgetResult] = await Promise.all([
    supabase.from('projects').select('*').eq('id', projectId).single(),
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
    const key = `${ct.entity_id ?? '__none__'}|${ct.currency ?? 'PEN'}`
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

  // Fetch tags for these entities via entity_tags → tags
  const entityTagMap = new Map<string, string[]>()
  if (spendingEntityIds.length > 0) {
    const { data: entityTags, error: etError } = await supabase
      .from('entity_tags')
      .select('entity_id, tag_id')
      .in('entity_id', spendingEntityIds)
    if (etError) throw etError
    const tagIds = [...new Set((entityTags ?? []).map(et => et.tag_id))]
    if (tagIds.length > 0) {
      const { data: tags, error: tagsError } = await supabase.from('tags').select('id, name').in('id', tagIds)
      if (tagsError) throw tagsError
      const tagNameMap = new Map((tags ?? []).map(t => [t.id, t.name]))
      for (const et of entityTags ?? []) {
        const name = tagNameMap.get(et.tag_id)
        if (!name) continue
        const existing = entityTagMap.get(et.entity_id) ?? []
        existing.push(name)
        entityTagMap.set(et.entity_id, existing)
      }
    }
  }

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
      .select('legal_name, common_name')
      .eq('id', project.client_entity_id)
      .single()
    if (clientError && clientError.code !== 'PGRST116') throw clientError
    clientName = clientEntity?.common_name || clientEntity?.legal_name || null
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
      const subtotal = ct.subtotal ?? 0
      const rate = ct.exchange_rate ? Number(ct.exchange_rate) : 1
      const amountPen = ct.currency === 'USD' ? subtotal * rate : subtotal
      costsByPartner.set(ct.partner_company_id, (costsByPartner.get(ct.partner_company_id) ?? 0) + amountPen)
    }

    // Get actual AR payments received per partner
    const { data: projectReceivables, error: recvError } = await supabase
      .from('invoices')
      .select('id, partner_company_id, currency')
      .eq('direction', 'receivable')
      .eq('project_id', projectId)
    if (recvError) throw recvError

    const receivableIds = (projectReceivables ?? []).map(a => a.id)
    const receivedByPartner = new Map<string, number>()

    if (receivableIds.length > 0) {
      const { data: arPayments, error: arPmtError } = await supabase
        .from('payments')
        .select('related_id, amount, currency, exchange_rate')
        .in('related_id', receivableIds)
        .eq('related_to', 'invoice')
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
        const amount = p.amount ?? 0
        const rate = p.exchange_rate ? Number(p.exchange_rate) : 1
        const amountPen = paymentCurrency === 'USD' ? amount * rate : amount
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
      const profit = Math.round((revenueReceived - costsContributed) * 100) / 100
      const shouldReceive = Math.round(totalProjectProfit * (p.profitSharePct / 100) * 100) / 100
      const balance = Math.round((shouldReceive - profit) * 100) / 100
      return {
        partnerCompanyId: p.partnerCompanyId,
        partnerName: p.partnerName,
        profitSharePct: p.profitSharePct,
        costsContributed,
        revenueReceived: Math.round(revenueReceived * 100) / 100,
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
    const rate = inv.exchange_rate ? Number(inv.exchange_rate) : 1
    return {
      invoice_id: inv.invoice_id!,
      date: inv.invoice_date,
      invoice_number: inv.invoice_number,
      subtotal,
      currency: inv.currency,
      exchange_rate: inv.exchange_rate ? Number(inv.exchange_rate) : null,
      subtotal_pen: inv.currency === 'USD' ? Math.round(subtotal * rate * 100) / 100 : subtotal,
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
    .order('payment_date', { ascending: false })
  if (pmtError) throw pmtError

  return (payments ?? []).map(p => {
    const inv = invoiceMap.get(p.related_id)
    const currency = p.currency ?? inv?.currency ?? 'PEN'
    const amount = p.amount ?? 0
    const rate = p.exchange_rate ? Number(p.exchange_rate) : 1
    return {
      payment_id: p.id,
      payment_date: p.payment_date,
      invoice_number: inv?.invoice_number ?? null,
      amount,
      currency,
      exchange_rate: p.exchange_rate ? Number(p.exchange_rate) : null,
      amount_pen: currency === 'USD' ? Math.round(amount * rate * 100) / 100 : amount,
    }
  })
}
