import { createServerSupabaseClient } from '../supabase/server'
import { DEFAULT_CURRENCY, round2, convertToPen } from './shared'
import type {
  SettlementDashboardData,
  SettlementPartnerRow,
  SettlementSummary,
} from '../types'

/**
 * Settlement dashboard query — computes partner balances across one or more projects.
 * All amounts converted to PEN at transaction-date exchange rates.
 *
 * Excludes intercompany and SGA invoices from cost and revenue totals.
 */
export async function getSettlementDashboard(
  projectIds: string[],
): Promise<SettlementDashboardData> {
  if (projectIds.length === 0) {
    return {
      summary: { projectCount: 0, incomeCollected: 0, totalCosts: 0, totalProfit: 0 },
      partners: [],
    }
  }

  const supabase = await createServerSupabaseClient()
  const isSingleProject = projectIds.length === 1

  // 1. Fetch partners for selected projects
  const { data: ppData, error: ppError } = await supabase
    .from('project_partners')
    .select('project_id, partner_id, profit_share_pct')
    .in('project_id', projectIds)
    .eq('is_active', true)
  if (ppError) throw ppError

  // 2. Get partner names from entities
  const partnerIds = [...new Set((ppData ?? []).map(pp => pp.partner_id))]
  let partnerNameMap = new Map<string, string>()
  if (partnerIds.length > 0) {
    const { data: pcData, error: pcError } = await supabase
      .from('entities')
      .select('id, legal_name')
      .in('id', partnerIds)
    if (pcError) throw pcError
    for (const pc of pcData ?? []) {
      partnerNameMap.set(pc.id, pc.legal_name)
    }
  }

  // 3. Fetch costs per partner — project_cost only (excludes SGA and intercompany)
  const { data: costTotals, error: costError } = await supabase
    .from('v_invoice_totals')
    .select('project_id, partner_id, subtotal, currency, exchange_rate')
    .eq('direction', 'payable')
    .eq('cost_type', 'project_cost')
    .in('project_id', projectIds)
  if (costError) throw costError

  // Sum costs per partner (across all selected projects) in PEN
  const costsByPartner = new Map<string, number>()
  for (const ct of costTotals ?? []) {
    if (!ct.partner_id) continue
    const amountPen = convertToPen(ct.subtotal ?? 0, ct.currency, ct.exchange_rate)
    costsByPartner.set(ct.partner_id, (costsByPartner.get(ct.partner_id) ?? 0) + amountPen)
  }

  // 4. Fetch revenue — AR payments received per partner (excludes intercompany)
  const { data: receivables, error: recvError } = await supabase
    .from('invoices')
    .select('id, project_id, partner_id, currency, cost_type')
    .eq('direction', 'receivable')
    .in('project_id', projectIds)
    .eq('is_active', true)
  if (recvError) throw recvError

  // Filter out intercompany receivables
  const nonIntercompanyReceivables = (receivables ?? []).filter(r => r.cost_type !== 'intercompany')
  const receivableIds = nonIntercompanyReceivables.map(r => r.id)

  // Build lookup: invoice_id → { partner_id, project_id, currency }
  const receivableInfoMap = new Map<string, { partner_id: string; project_id: string; currency: string }>()
  for (const inv of nonIntercompanyReceivables) {
    if (inv.partner_id && inv.project_id) {
      receivableInfoMap.set(inv.id, { partner_id: inv.partner_id, project_id: inv.project_id, currency: inv.currency })
    }
  }

  // Single payments query — build both per-partner and per-project revenue maps
  const receivedByPartner = new Map<string, number>()
  const revenueByProject = new Map<string, number>()
  if (receivableIds.length > 0) {
    const { data: arPayments, error: arPmtError } = await supabase
      .from('payments')
      .select('related_id, amount, currency, exchange_rate')
      .in('related_id', receivableIds)
      .eq('related_to', 'invoice')
      .eq('is_active', true)
    if (arPmtError) throw arPmtError

    for (const p of arPayments ?? []) {
      const invInfo = receivableInfoMap.get(p.related_id)
      if (!invInfo) continue
      const paymentCurrency = p.currency ?? invInfo.currency
      const amountPen = convertToPen(p.amount ?? 0, paymentCurrency, p.exchange_rate)
      receivedByPartner.set(invInfo.partner_id, (receivedByPartner.get(invInfo.partner_id) ?? 0) + amountPen)
      revenueByProject.set(invInfo.project_id, (revenueByProject.get(invInfo.project_id) ?? 0) + amountPen)
    }
  }

  // 5. Compute totals
  const totalCosts = round2([...costsByPartner.values()].reduce((sum, v) => sum + v, 0))
  const totalRevenue = round2([...receivedByPartner.values()].reduce((sum, v) => sum + v, 0))
  const totalProfit = round2(totalRevenue - totalCosts)

  // 6. Compute profit share per partner per project, then aggregate
  const partnerProjects = new Map<string, Array<{ project_id: string; profit_share_pct: number }>>()
  for (const pp of ppData ?? []) {
    const list = partnerProjects.get(pp.partner_id) ?? []
    list.push({ project_id: pp.project_id, profit_share_pct: pp.profit_share_pct })
    partnerProjects.set(pp.partner_id, list)
  }

  // Per-project costs
  const costsByProject = new Map<string, number>()
  for (const ct of costTotals ?? []) {
    if (!ct.project_id) continue
    const amountPen = convertToPen(ct.subtotal ?? 0, ct.currency, ct.exchange_rate)
    costsByProject.set(ct.project_id, (costsByProject.get(ct.project_id) ?? 0) + amountPen)
  }

  // Build settlement rows
  const partners: SettlementPartnerRow[] = []
  for (const [partnerId, projects] of partnerProjects) {
    const costsPaid = round2(costsByPartner.get(partnerId) ?? 0)

    // Compute weighted profit share across projects
    let profitShare = 0
    let consistentPct: number | null = projects[0]?.profit_share_pct ?? null
    for (const pp of projects) {
      const projCosts = costsByProject.get(pp.project_id) ?? 0
      const projRevenue = revenueByProject.get(pp.project_id) ?? 0
      const projProfit = projRevenue - projCosts
      profitShare += projProfit * (pp.profit_share_pct / 100)
      if (consistentPct !== pp.profit_share_pct) consistentPct = null
    }
    profitShare = round2(profitShare)

    const shouldReceive = round2(costsPaid + profitShare)
    const revenueReceived = round2(receivedByPartner.get(partnerId) ?? 0)
    const balance = round2(shouldReceive - revenueReceived)

    partners.push({
      partnerId: partnerId,
      partnerName: partnerNameMap.get(partnerId) ?? '—',
      profitSharePct: isSingleProject ? consistentPct : null,
      costsPaid,
      profitShare,
      shouldReceive,
      balance,
    })
  }

  // Sort: Korakuen (you) last, others alphabetically
  partners.sort((a, b) => {
    const aIsYou = a.partnerName.toLowerCase().includes('korakuen')
    const bIsYou = b.partnerName.toLowerCase().includes('korakuen')
    if (aIsYou && !bIsYou) return 1
    if (!aIsYou && bIsYou) return -1
    return a.partnerName.localeCompare(b.partnerName)
  })

  const summary: SettlementSummary = {
    projectCount: projectIds.length,
    incomeCollected: totalRevenue,
    totalCosts: totalCosts,
    totalProfit: totalProfit,
  }

  return { summary, partners }
}
