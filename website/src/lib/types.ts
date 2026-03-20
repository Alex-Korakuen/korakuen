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
export type CostType = 'project_cost' | 'sga'
export type ComprobanteType = 'factura' | 'boleta' | 'recibo_por_honorarios' | 'liquidacion_de_compra' | 'planilla_jornales' | 'none'
export type PaymentType = 'regular' | 'detraccion' | 'retencion'
export type PaymentRelatedTo = 'invoice' | 'loan_schedule'
export type PaymentMethod = 'bank_transfer' | 'cash' | 'check'
export type ProjectStatus = 'prospect' | 'active' | 'completed' | 'cancelled'
export type ProjectType = 'subcontractor' | 'oxi'
export type EntityType = 'company' | 'individual'
export type DocumentType = 'RUC' | 'DNI' | 'CE' | 'Pasaporte'
export type AccountType = 'checking' | 'savings' | 'detraccion'
export type ReturnType = 'percentage' | 'fixed'

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
    currency: string | null
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
    partner_company_id: string | null
  } | null
  schedule: LoanScheduleEntry[]
  payments: Payment[]
}

// --- Calendar types (forward-looking urgency buckets) ---

export type CalendarBucketId = 'all' | 'overdue' | 'today' | 'next-7' | 'next-30' | 'later'

export type BucketValue = { count: number; pen: number; usd: number }

// --- Invoices page types (backward-looking aging buckets) ---

export type InvoiceAgingBucketId = 'all' | 'current' | '1-30' | '31-60' | '61-90' | '90+'

export type InvoiceAgingBuckets = {
  current: BucketValue
  '1-30': BucketValue
  '31-60': BucketValue
  '61-90': BucketValue
  '90+': BucketValue
}

// Invoices page row — UNION of commercial invoices + loan schedule entries
export type InvoicesPageRow = {
  id: string                          // invoice_id or loan_schedule_id
  type: 'commercial' | 'loan'
  direction: 'payable' | 'receivable'
  partner_company_id: string | null
  project_id: string | null
  project_code: string | null
  entity_id: string | null
  entity_name: string | null
  title: string | null
  invoice_number: string | null
  invoice_date: string | null
  due_date: string | null
  currency: string
  total: number
  amount_paid: number
  outstanding: number
  bdn_outstanding: number
  bdn_outstanding_pen: number
  payment_status: string
  // Loan-specific (null for commercial)
  loan_id: string | null
}

// --- Payments page types ---

export type PaymentsPageRow = {
  id: string
  payment_date: string
  direction: string            // inbound / outbound
  payment_type: string         // regular / detraccion / retencion
  amount: number
  currency: string
  exchange_rate: number
  entity_name: string | null
  project_id: string | null
  project_code: string | null
  related_to: string           // invoice / loan_schedule / loan
  related_id: string | null
  invoice_number: string | null
  bank_account_id: string | null
  bank_name: string | null
  notes: string | null
  partner_company_id: string | null
}

export type PaymentsSummary = {
  inflows: { pen: number; usd: number }
  outflows: { pen: number; usd: number }
  net: { pen: number; usd: number }
  count: number
}

// --- Partner settlement types ---

export type PartnerPayableDetail = {
  invoice_id: string
  date: string | null
  invoice_number: string | null
  subtotal: number
  currency: string | null
  exchange_rate: number | null
  subtotal_pen: number // subtotal * exchange_rate for USD, subtotal for PEN
}

export type PartnerReceivableDetail = {
  payment_id: string
  payment_date: string | null
  invoice_number: string | null
  amount: number
  currency: string | null
  exchange_rate: number | null
  amount_pen: number
}

// --- Financial Position component types ---

export type BankAccountCard = {
  bankAccountId: string
  partnerCompanyId: string | null
  partnerName: string | null
  bankName: string | null
  accountNumberLast4: string | null
  accountType: string | null
  currency: string | null
  isDetractionAccount: boolean
  balance: number
  transactionCount: number
}

export type BankTransaction = {
  id: string
  paymentDate: string
  direction: string
  amount: number
  currency: string
  entityName: string | null
  projectCode: string | null
  description: string | null
}

export type CurrencyAmount = {
  currency: string
  amount: number
}

export type IgvByCurrency = {
  currency: string
  igvCollected: number // debito fiscal
  igvPaid: number // credito fiscal
  net: number // paid - collected (positive = credit)
}

export type FinancialPositionData = {
  bankAccounts: BankAccountCard[]
  arOutstanding: CurrencyAmount[]
  apOutstanding: CurrencyAmount[]
  loans: { loanId: string; lenderName: string; outstanding: number; currency: string }[]
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
  contract_currency: string | null
}

export type ProjectCardItem = ProjectListItem & {
  partner_count: number
  budget_pct: number | null       // actual/budgeted * 100, null if no budget
  is_settled: boolean | null      // null = no partners or no activity
}

export type ProjectEntitySummary = {
  entityId: string | null
  entityName: string
  tags: string[]
  totalSpent: number | null
  invoiceCount: number | null
  currency: string
}

export type ProjectPartnerRow = {
  id: string
  partnerCompanyId: string
  partnerName: string
  profitSharePct: number
}

// Settlement data for each partner within a project (all in PEN at transaction-date rates)
export type ProjectPartnerSettlement = {
  partnerCompanyId: string
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
  partners: ProjectPartnerRow[]
  partnerSettlements: ProjectPartnerSettlement[]
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
  /** Primary currency for display; null if no invoices */
  currency: string | null
}

export type EntityLedgerRow = {
  transactionId: string
  date: string | null
  title: string | null
  invoiceTotal: number
  outstanding: number
  currency: string
}

export type EntityLedgerGroup = {
  projectId: string
  projectCode: string
  projectName: string
  invoiceTotal: number
  outstanding: number
  lastDate: string | null
  currency: string
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

export type PartnerCompanyOption = { id: string; name: string }

export type CategoryOption = { name: string; cost_type: string }

export type EntitySearchResult = {
  id: string
  legal_name: string
  document_number: string
}

// --- Prices browse types ---

export type PriceHistoryRow = {
  id: string
  date: string
  source: 'invoice' | 'quote'
  entityId: string | null
  entityName: string
  projectId: string | null
  projectCode: string
  title: string
  category: string | null
  quantity: number | null
  unit_of_measure: string | null
  unit_price: number | null
  currency: string
  entityTags: string[]
}

export type PriceFilterOptions = {
  projects: { id: string; project_code: string; name: string }[]
  entities: { id: string; name: string }[]
  tags: { id: string; name: string }[]
  categories: string[]
}
