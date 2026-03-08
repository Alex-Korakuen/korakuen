/**
 * Human-friendly type aliases and enums for the Korakuen database schema.
 * Generated types live in database.types.ts — these are the types used in application code.
 */

import type { Database } from './database.types'

// --- Table row types ---
export type Entity = Database['public']['Tables']['entities']['Row']
export type EntityContact = Database['public']['Tables']['entity_contacts']['Row']
export type Project = Database['public']['Tables']['projects']['Row']
export type Cost = Database['public']['Tables']['costs']['Row']
export type CostItem = Database['public']['Tables']['cost_items']['Row']

export type Payment = Database['public']['Tables']['payments']['Row']

// --- View row types ---
export type ApCalendarRow = Database['public']['Views']['v_ap_calendar']['Row']
export type CostBalanceRow = Database['public']['Views']['v_cost_balances']['Row']
export type ArBalanceRow = Database['public']['Views']['v_ar_balances']['Row']
export type EntityTransactionRow = Database['public']['Views']['v_entity_transactions']['Row']
export type BudgetVsActualRow = Database['public']['Views']['v_budget_vs_actual']['Row']


// --- Enums matching schema VARCHAR values ---
export type Currency = 'PEN' | 'USD'

export type ProjectStatus = 'prospect' | 'active' | 'completed' | 'cancelled'

// --- AP Calendar component types ---

export type CostDetailData = {
  cost: {
    cost_id: string | null
    cost_type: string | null
    currency: string | null
    date: string | null
    due_date: string | null
    entity_id: string | null
    title: string | null
    subtotal: number | null
    igv_amount: number | null
    total: number | null
    detraccion_amount: number | null
    amount_paid: number | null
    outstanding: number | null
    payment_status: string | null
    project_id: string | null
    bank_account_id: string | null
    document_ref: string | null
  } | null
  items: CostItem[]
  payments: Payment[]
  header: {
    comprobante_type: string | null
    comprobante_number: string | null
    document_ref: string | null
    bank_account_id: string | null
  } | null
  bank: {
    bank_name: string
    account_number_last4: string | null
    partner_company_id: string | null
  } | null
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
  } | null
  schedule: {
    id: string
    loan_id: string
    scheduled_date: string
    scheduled_amount: number
    exchange_rate: number
    paid: boolean
    actual_payment_id: string | null
    created_at: string
    updated_at: string
  }[]
  payments: {
    id: string
    loan_id: string
    payment_date: string
    amount: number
    currency: string
    exchange_rate: number
    source: string | null
    settlement_ref: string | null
    notes: string | null
    created_at: string
    updated_at: string
  }[]
}

export type ApCalendarBucketId = 'all' | 'overdue' | 'today' | 'this-week' | 'next-30'

// --- AR Outstanding component types ---

export type ArOutstandingRow = {
  ar_invoice_id: string
  project_id: string | null
  project_code: string
  entity_id: string | null
  client_name: string
  partner_company_id: string | null
  partner_name: string
  invoice_number: string | null
  invoice_date: string | null
  due_date: string | null
  days_overdue: number
  subtotal: number
  igv_amount: number
  gross_total: number
  detraccion_amount: number
  retencion_amount: number
  net_receivable: number
  amount_paid: number
  outstanding: number
  receivable: number
  bdn_outstanding: number
  currency: string
  payment_status: string
}

export type ArInvoiceDetailData = {
  invoice: ArBalanceRow | null
  payments: Payment[]
  client_name: string
  project_code: string
  partner_name: string
}

export type ArOutstandingBucketId = 'all' | 'current' | '31-60' | '61-90' | '90+'

// --- Partner Balances component types ---

export type PartnerContribution = {
  partner_company_id: string
  partner_name: string
  contribution_amount_pen: number
  contribution_pct: number
  profit_share_pct: number
  project_income_pen: number
  project_costs_pen: number
  project_profit_pen: number
  profit_share_pen: number
  should_receive_pen: number
}

export type PartnerSettlement = {
  partner_company_id: string
  partner_name: string
  should_receive_pen: number
  actually_received_pen: number
  settlement_balance_pen: number
}

export type PartnerBalanceData = {
  contributions: PartnerContribution[]
  settlements: PartnerSettlement[]
  projectCode: string
  projectName: string
}

export type PartnerCostDetail = {
  cost_id: string
  date: string | null
  comprobante_number: string | null
  subtotal: number
  currency: string | null
  exchange_rate: number | null
  subtotal_pen: number // subtotal * exchange_rate for USD, subtotal for PEN
}

export type PartnerRevenueDetail = {
  payment_id: string
  payment_date: string | null
  invoice_number: string | null
  amount: number
  currency: string | null
  exchange_rate: number | null
  amount_pen: number
}

// --- Cash Flow component types ---

export type CashFlowMonth = {
  month: string // YYYY-MM format
  label: string // "Jan 2026"
  isActual: boolean // true for past months, false for forecast
  isCurrentMonth: boolean // true for the current month only
  cashIn: number // sum of all project cash in + loans
  cashInByProject: Record<string, number> // project_id -> amount
  loansCashIn: number // loan disbursements received
  materials: number
  labor: number
  subcontractor: number
  equipment: number
  other: number
  projectCosts: number // sum of material/labor/subcontractor/equipment/other
  sga: number // SG&A overhead costs
  loanRepayment: number
  cashOut: number // projectCosts + sga + loanRepayment
  net: number // cashIn - cashOut
}

export type CashFlowProject = {
  id: string
  code: string
  name: string
}

export type CashFlowData = {
  months: CashFlowMonth[]
  projects: CashFlowProject[] // projects that have cash in during the period
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
  shouldReceive: number      // their profit_share_pct × total project profit
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
  common_name: string | null
  document_type: string | null
  document_number: string | null
  entity_type: string
  city: string | null
  region: string | null
  tags: string[]
}

export type ProjectTransactionGroup = {
  projectId: string
  projectCode: string
  projectName: string
  apTotal: number
  arTotal: number
  net: number
  transactionCount: number
  lastDate: string | null
  currency: string
  transactions: EntityTransactionRow[]
}

export type EntityTagItem = { tagId: string; name: string }

export type EntityDetailData = {
  entity: Entity
  tags: EntityTagItem[]
  contacts: EntityContact[]
  transactionsByProject: ProjectTransactionGroup[]
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
  common_name: string | null
  document_number: string
}

// --- Prices browse types ---

export type PriceHistoryRow = {
  id: string
  date: string
  source: 'cost' | 'quote'
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
