import { createServerSupabaseClient } from '../supabase/server'
import { buildEntityNameMap, buildProjectCodeMap } from './shared'
import type {
  BankAccountCard,
  BankTransaction,
  CurrencyAmount,
  FinancialPositionData,
  IgvByCurrency,
} from '../types'


/** Group amounts by currency — returns sorted array (PEN first, USD second) */
function groupByCurrency(
  items: { amount: number; currency: string | null }[]
): CurrencyAmount[] {
  const map = new Map<string, number>()
  for (const item of items) {
    const cur = item.currency ?? 'PEN'
    map.set(cur, (map.get(cur) ?? 0) + item.amount)
  }
  return Array.from(map.entries())
    .map(([currency, amount]) => ({ currency, amount }))
    .sort((a, b) => a.currency.localeCompare(b.currency))
}

export async function getFinancialPosition(
  partnerIds: string[]
): Promise<FinancialPositionData> {
  const supabase = await createServerSupabaseClient()
  const hasPartnerFilter = partnerIds.length > 0

  // Build queries with DB-side filters for partner and payment status
  let bankQuery = supabase.from('v_bank_balances').select('*')
  let arQuery = supabase.from('v_invoice_balances').select('outstanding, currency, partner_company_id').eq('direction', 'receivable').neq('payment_status', 'paid')
  let costQuery = supabase.from('v_invoice_balances').select('outstanding, currency, partner_company_id').eq('direction', 'payable').neq('payment_status', 'paid')
  let loanQuery = supabase.from('v_loan_balances').select('*')

  if (hasPartnerFilter) {
    bankQuery = bankQuery.in('partner_company_id', partnerIds)
    arQuery = arQuery.in('partner_company_id', partnerIds)
    costQuery = costQuery.or(`partner_company_id.in.(${partnerIds.join(',')}),partner_company_id.is.null`)
    loanQuery = loanQuery.in('partner_company_id', partnerIds)
  }

  const [
    bankResult,
    arResult,
    costResult,
    igvResult,
    retencionResult,
    loanResult,
  ] = await Promise.all([
    bankQuery,
    arQuery,
    costQuery,
    supabase.from('v_igv_position').select('*'),
    supabase.from('v_retencion_dashboard').select('retencion_amount, currency, retencion_verified'),
    loanQuery,
  ])

  if (bankResult.error) throw bankResult.error
  if (arResult.error) throw arResult.error
  if (costResult.error) throw costResult.error
  if (igvResult.error) throw igvResult.error
  if (retencionResult.error) throw retencionResult.error
  if (loanResult.error) throw loanResult.error

  // Bank account cards
  const bankCards: BankAccountCard[] = (bankResult.data ?? []).map(ba => ({
    bankAccountId: ba.bank_account_id ?? '',
    partnerCompanyId: ba.partner_company_id,
    partnerName: ba.partner_name,
    bankName: ba.bank_name,
    accountNumberLast4: ba.account_number_last4,
    accountType: ba.account_type,
    currency: ba.currency,
    isDetractionAccount: ba.is_detraccion_account ?? false,
    balance: ba.balance ?? 0,
    transactionCount: ba.transaction_count ?? 0,
  }))

  // AR outstanding grouped by currency
  const arOutstanding = groupByCurrency(
    (arResult.data ?? []).map(ar => ({ amount: ar.outstanding ?? 0, currency: ar.currency }))
  )

  // AP outstanding grouped by currency
  const apOutstanding = groupByCurrency(
    (costResult.data ?? []).map(c => ({ amount: c.outstanding ?? 0, currency: c.currency }))
  )

  // IGV position by currency
  const igv: IgvByCurrency[] = (igvResult.data ?? []).map(row => ({
    currency: row.currency ?? 'PEN',
    igvCollected: row.igv_collected ?? 0,
    igvPaid: row.igv_paid ?? 0,
    net: (row.igv_paid ?? 0) - (row.igv_collected ?? 0),
  }))

  // Retenciones unverified grouped by currency
  const retencionesUnverified = groupByCurrency(
    (retencionResult.data ?? [])
      .filter(r => !r.retencion_verified)
      .map(r => ({ amount: r.retencion_amount ?? 0, currency: r.currency }))
  )

  // Loans
  const loans = (loanResult.data ?? []).map(l => ({
    loanId: l.loan_id ?? '',
    lenderName: l.lender_name ?? '—',
    outstanding: l.outstanding ?? 0,
    currency: l.currency ?? 'PEN',
  }))

  return {
    bankAccounts: bankCards,
    arOutstanding,
    apOutstanding,
    loans,
    igv,
    retencionesUnverified,
  }
}

export async function getBankTransactions(
  bankAccountId: string
): Promise<BankTransaction[]> {
  const supabase = await createServerSupabaseClient()

  // Get payments for this bank account, most recent first
  const { data: payments, error: paymentsError } = await supabase
    .from('payments')
    .select('id, payment_date, direction, amount, currency, related_id, related_to')
    .eq('bank_account_id', bankAccountId)
    .order('payment_date', { ascending: false })
    .limit(50)

  if (paymentsError) throw paymentsError
  if (!payments || payments.length === 0) return []

  // Enrich with entity names and project codes
  const invoiceIds = payments
    .filter(p => p.related_to === 'invoice')
    .map(p => p.related_id)
    .filter((id): id is string => id !== null)

  let invoiceData: { id: string; entity_id: string | null; project_id: string | null; title: string | null; invoice_number: string | null; direction: string }[] = []
  if (invoiceIds.length > 0) {
    const { data, error } = await supabase
      .from('invoices')
      .select('id, entity_id, project_id, title, invoice_number, direction')
      .in('id', invoiceIds)
    if (error) throw error
    invoiceData = data ?? []
  }

  // Get entity and project names
  const entityIds = invoiceData.map(inv => inv.entity_id).filter((id): id is string => id !== null)
  const projectIds = invoiceData.map(inv => inv.project_id).filter((id): id is string => id !== null)

  const [entityMap, projectMap] = await Promise.all([
    buildEntityNameMap(supabase, [...new Set(entityIds)]),
    buildProjectCodeMap(supabase, [...new Set(projectIds)]),
  ])

  const invoiceMap = new Map(invoiceData.map(inv => [inv.id, inv]))

  return payments.map(p => {
    let entityName: string | null = null
    let projectCode: string | null = null
    let description: string | null = null

    if (p.related_to === 'invoice' && p.related_id) {
      const inv = invoiceMap.get(p.related_id)
      if (inv) {
        entityName = inv.entity_id ? entityMap.get(inv.entity_id) ?? null : null
        projectCode = inv.project_id ? projectMap.get(inv.project_id) ?? null : null
        description = inv.direction === 'receivable'
          ? (inv.invoice_number ? `Invoice ${inv.invoice_number}` : null)
          : inv.title ?? null
      }
    }

    return {
      id: p.id,
      paymentDate: p.payment_date,
      direction: p.direction,
      amount: p.amount,
      currency: p.currency,
      entityName,
      projectCode,
      description,
    }
  })
}
