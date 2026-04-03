/**
 * Human-friendly type aliases and enums for the Korakuen database schema.
 * Generated types live in database.types.ts — these are the types used in application code.
 *
 * V1: Unified invoice model — costs + ar_invoices merged into invoices table.
 */

import type { Database } from './database.types'

// --- Table row types ---
export type Entity = Database['public']['Tables']['entities']['Row']
export type EntityContact = Database['public']['Tables']['entity_contacts']['Row']
export type Project = Database['public']['Tables']['projects']['Row']
export type Invoice = Database['public']['Tables']['invoices']['Row']
export type InvoiceItem = Database['public']['Tables']['invoice_items']['Row']
export type Payment = Database['public']['Tables']['payments']['Row']

// --- View row types ---
export type InvoiceBalanceRow = Database['public']['Views']['v_invoice_balances']['Row']
export type ObligationCalendarRow = Database['public']['Views']['v_obligation_calendar']['Row']
export type InvoicesWithLoansRow = Database['public']['Views']['v_invoices_with_loans']['Row']
export type BudgetVsActualRow = Database['public']['Views']['v_budget_vs_actual']['Row']

// --- Enums matching schema VARCHAR values ---
export type Currency = 'PEN' | 'USD'
export type InvoiceDirection = 'payable' | 'receivable'
export type PaymentType = 'regular' | 'detraccion' | 'retencion'
export type ProjectStatus = 'prospect' | 'active' | 'completed' | 'cancelled'
export type EntityType = 'company' | 'individual'
export type DocumentType = 'RUC' | 'DNI' | 'CE' | 'Pasaporte'
export type PaymentDirection = 'inbound' | 'outbound'
export type PaymentRelatedTo = 'invoice' | 'loan_schedule' | 'loan'

// --- Invoice detail types ---

export type InvoiceDetailData = {
  invoice: InvoiceBalanceRow | null
  items: InvoiceItem[]
  payments: Payment[]
}

export type LoanScheduleEntry = {
  id: string
  loan_id: string
  scheduled_date: string
  scheduled_amount: number
  exchange_rate: number
  amount_paid: number   // derived: SUM of payments for this entry
  outstanding: number   // derived: scheduled_amount - amount_paid
  payment_status: 'pending' | 'partial' | 'paid'
  created_at: string
  updated_at: string
}

export type LoanDetailData = {
  loan: {
    loan_id: string | null
    lender_name: string | null
    lender_contact: string | null
    purpose: string | null
    currency: Currency | null
    date_borrowed: string | null
    due_date: string | null
    principal: number | null
    total_owed: number | null
    total_paid: number | null
    outstanding: number | null
    status: string | null
    scheduled_payments_count: number | null
    paid_schedule_count: number | null
    project_id: string | null
    partner_id: string | null
  } | null
  schedule: LoanScheduleEntry[]
  payments: Payment[]
}

// --- Calendar types (forward-looking urgency buckets) ---

export type CalendarBucketId = 'all' | 'overdue' | 'today' | 'next-7' | 'next-30' | 'later'

// Invoices page row — UNION of commercial invoices + loan schedule entries
export type InvoicesPageRow = {
  id: string                          // invoice_id or loan_schedule_id
  type: 'commercial' | 'loan'
  direction: 'payable' | 'receivable'
  partner_id: string | null
  partner_name: string | null
  project_id: string | null
  project_code: string | null
  entity_id: string | null
  entity_name: string | null
  title: string | null
  invoice_number: string | null
  invoice_date: string | null
  due_date: string | null
  currency: Currency
  total: number
  amount_paid: number
  outstanding: number
  bdn_outstanding: number
  bdn_outstanding_pen: number
  payment_status: string
  comprobante_type: string | null
  quote_status: string | null
  // Loan-specific (null for commercial)
  loan_id: string | null
}

// --- Payments page types ---

export type PaymentsPageRow = {
  id: string
  payment_date: string
  direction: PaymentDirection
  payment_type: PaymentType
  amount: number
  currency: Currency
  exchange_rate: number | null
  entity_name: string | null
  project_id: string | null
  project_code: string | null
  related_to: PaymentRelatedTo
  related_id: string | null
  invoice_number: string | null
  operation_number: string | null
  document_ref: string | null
  bank_account_id: string | null
  bank_name: string | null
  bank_label: string | null
  title: string | null
  notes: string | null
  partner_id: string | null
  partner_name: string | null
}

export type PaymentsSummary = {
  inflows: { pen: number; usd: number }
  outflows: { pen: number; usd: number }
  net: { pen: number; usd: number }
  count: number
}

// --- Financial Position component types ---

export type BankAccountCard = {
  bankAccountId: string
  partnerId: string | null
  partnerName: string | null
  bankName: string | null
  accountNumberLast4: string | null
  accountType: string | null
  currency: Currency | null
  isDetractionAccount: boolean
  balance: number
  transactionCount: number
}

export type BankTransaction = {
  id: string
  paymentDate: string
  direction: PaymentDirection
  amount: number
  currency: Currency
  entityName: string | null
  projectCode: string | null
  description: string | null
}

export type CurrencyAmount = {
  currency: Currency
  amount: number
}

export type IgvByCurrency = {
  currency: Currency
  igvCollected: number // debito fiscal
  igvPaid: number // credito fiscal
  net: number // paid - collected (positive = credit)
}

export type FinancialPositionData = {
  bankAccounts: BankAccountCard[]
  arOutstanding: CurrencyAmount[]
  apOutstanding: CurrencyAmount[]
  loans: { loanId: string; lenderName: string; outstanding: number; currency: Currency }[]
  igv: IgvByCurrency[]
  retencionesUnverified: CurrencyAmount[]
}

// --- Projects browse types ---

export type ProjectListItem = {
  id: string
  project_code: string
  name: string
  status: string
  contract_value: number | null
  contract_currency: Currency | null
}

export type ProjectCardItem = ProjectListItem & {
  partner_count: number
  budget_total: number | null     // total budgeted amount in PEN, null if no budget
  expense_total: number | null    // total actual spending in PEN, null if no budget
  budget_pct: number | null       // actual/budgeted * 100, null if no budget
  is_settled: boolean | null      // null = no partners or no activity
}

export type ProjectEntitySummary = {
  entityId: string | null
  entityName: string
  tags: string[]
  penSpent: number
  usdSpent: number
  invoiceCount: number
}

export type ProjectPartnerRow = {
  id: string
  partnerId: string
  partnerName: string
  profitSharePct: number
}

// Settlement data for each partner within a project (all in PEN at transaction-date rates)
export type ProjectPartnerSettlement = {
  partnerId: string
  partnerName: string
  profitSharePct: number
  costsContributed: number   // project costs paid by this partner
  revenueReceived: number    // actual AR payments received
  profit: number             // revenueReceived - costsContributed
  shouldReceive: number      // their profit_share_pct x total project profit
  balance: number            // shouldReceive - profit (positive = owed, negative = overpaid)
}

export type ProjectDetailData = {
  project: Project
  clientName: string | null
  entities: ProjectEntitySummary[]
  budget: BudgetVsActualRow[]
  actualCostsByCategory: Record<string, number>
  partners: ProjectPartnerRow[]
  partnerSettlements: ProjectPartnerSettlement[]
}

// --- Settlement dashboard types ---

export type SettlementPartnerRow = {
  partnerId: string
  partnerName: string
  profitSharePct: number | null // null when aggregating across projects with different shares
  costsPaid: number
  profitShare: number
  shouldReceive: number
  balance: number
}

export type SettlementSummary = {
  projectCount: number
  incomeCollected: number
  totalCosts: number
  totalProfit: number
}

export type SettlementDashboardData = {
  summary: SettlementSummary
  partners: SettlementPartnerRow[]
}

export type ProjectStatusFilter = 'all' | ProjectStatus

// --- Entities browse types ---

export type EntityListItem = {
  id: string
  legal_name: string
  document_type: string | null
  document_number: string | null
  entity_type: string
  city: string | null
  region: string | null
  tags: string[]
}

export type EntityDirectoryItem = EntityListItem & {
  totalPayable: number
  outstandingPayable: number
  totalReceivable: number
  outstandingReceivable: number
  /** Always PEN — all amounts converted to PEN for aggregation */
  currency: Currency
}

export type EntityLedgerRow = {
  transactionId: string
  date: string | null
  title: string | null
  invoiceTotal: number
  outstanding: number
  currency: Currency
}

export type EntityLedgerGroup = {
  projectId: string
  projectCode: string
  projectName: string
  invoiceTotal: number
  outstanding: number
  lastDate: string | null
  currency: Currency
  transactions: EntityLedgerRow[]
}

export type EntityTagItem = { tagId: string; name: string }

export type EntityDetailData = {
  entity: Entity
  tags: EntityTagItem[]
  contacts: EntityContact[]
  payablesByProject: EntityLedgerGroup[]
  receivablesByProject: EntityLedgerGroup[]
}

export type EntitiesFilterOptions = {
  tags: { id: string; name: string }[]
  cities: string[]
  regions: string[]
}

// --- Dropdown option types ---

export type PartnerOption = { id: string; name: string }

export type CategoryOption = { name: string; cost_type: string; sort_order: number }

export type EntitySearchResult = {
  id: string
  legal_name: string
  document_number: string
}

// --- Quote types ---

export type QuoteStatus = 'pending' | 'accepted' | 'rejected'

// --- Prices browse types ---

export type PriceHistoryRow = {
  id: string
  date: string
  comprobanteType: string | null
  quoteStatus: string | null
  quoteDate: string | null
  entityId: string | null
  entityName: string
  projectId: string | null
  projectCode: string
  title: string
  category: string | null
  quantity: number | null
  unit_of_measure: string | null
  unit_price: number | null
  currency: Currency
  entityTags: string[]
}

export type PriceFilterOptions = {
  projects: { id: string; project_code: string; name: string }[]
  entities: { id: string; name: string }[]
  tags: { id: string; name: string }[]
  categories: string[]
}
