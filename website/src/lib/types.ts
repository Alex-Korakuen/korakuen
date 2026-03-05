/**
 * Human-friendly type aliases and enums for the Korakuen database schema.
 * Generated types live in database.types.ts — these are the types used in application code.
 */

import type { Database } from './database.types'

// --- Table row types ---
export type PartnerCompany = Database['public']['Tables']['partner_companies']['Row']
export type BankAccount = Database['public']['Tables']['bank_accounts']['Row']
export type Entity = Database['public']['Tables']['entities']['Row']
export type EntityContact = Database['public']['Tables']['entity_contacts']['Row']
export type Tag = Database['public']['Tables']['tags']['Row']
export type EntityTag = Database['public']['Tables']['entity_tags']['Row']
export type Project = Database['public']['Tables']['projects']['Row']
export type ProjectEntity = Database['public']['Tables']['project_entities']['Row']
export type Quote = Database['public']['Tables']['quotes']['Row']
export type Cost = Database['public']['Tables']['costs']['Row']
export type CostItem = Database['public']['Tables']['cost_items']['Row']
export type ArInvoice = Database['public']['Tables']['ar_invoices']['Row']
export type Payment = Database['public']['Tables']['payments']['Row']
export type Loan = Database['public']['Tables']['loans']['Row']
export type LoanSchedule = Database['public']['Tables']['loan_schedule']['Row']
export type LoanPayment = Database['public']['Tables']['loan_payments']['Row']
export type ProjectBudget = Database['public']['Tables']['project_budgets']['Row']
export type ExchangeRate = Database['public']['Tables']['exchange_rates']['Row']

// --- View row types ---
export type ApCalendarRow = Database['public']['Views']['v_ap_calendar']['Row']
export type CostBalanceRow = Database['public']['Views']['v_cost_balances']['Row']
export type ArBalanceRow = Database['public']['Views']['v_ar_balances']['Row']
export type LoanBalanceRow = Database['public']['Views']['v_loan_balances']['Row']
export type RetencionDashboardRow = Database['public']['Views']['v_retencion_dashboard']['Row']
export type BankBalanceRow = Database['public']['Views']['v_bank_balances']['Row']
export type PartnerLedgerRow = Database['public']['Views']['v_partner_ledger']['Row']
export type EntityTransactionRow = Database['public']['Views']['v_entity_transactions']['Row']
export type CostTotalRow = Database['public']['Views']['v_cost_totals']['Row']
export type ProjectPlRow = Database['public']['Views']['v_project_pl']['Row']
export type CompanyPlRow = Database['public']['Views']['v_company_pl']['Row']
export type BudgetVsActualRow = Database['public']['Views']['v_budget_vs_actual']['Row']
export type IgvPositionRow = Database['public']['Views']['v_igv_position']['Row']

// --- Enums matching schema VARCHAR values ---
export type Currency = 'PEN' | 'USD'

export type EntityType = 'company' | 'individual'

export type DocumentType = 'RUC' | 'DNI' | 'CE' | 'Pasaporte'

export type ProjectStatus = 'prospect' | 'active' | 'completed' | 'cancelled'

export type ProjectType = 'subcontractor' | 'oxi'

export type CostType = 'project_cost' | 'sga'

export type ComprobanteType =
  | 'factura'
  | 'boleta'
  | 'recibo_por_honorarios'
  | 'liquidacion_de_compra'
  | 'planilla_jornales'
  | 'none'

export type PaymentMethod = 'bank_transfer' | 'cash' | 'check'

export type PaymentStatus = 'pending' | 'partial' | 'paid'

export type PaymentType = 'regular' | 'detraccion' | 'retencion'

export type PaymentDirection = 'inbound' | 'outbound'

export type LoanStatus = 'active' | 'partially_paid' | 'settled'

export type ReturnType = 'percentage' | 'fixed'

export type ApCalendarEntryType = 'supplier_invoice' | 'loan_payment'

// --- AP Calendar component types ---

export type CostDetractionEntry = {
  cost_id: string | null
  entity_name: string
  project_code: string
  title: string | null
  detraccion_amount: number
  currency: string
  deposited: number
  status: string
}

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
    notes: string | null
    created_at: string
    updated_at: string
  }[]
}

export type ApCalendarBucketId = 'all' | 'overdue' | 'today' | 'this-week' | 'next-30'

export type ApCalendarFilters = {
  projectId: string
  supplier: string
  currency: string
  titleSearch: string
}

export type ApCalendarSortColumn = 'due_date' | 'days_remaining' | 'entity_name' | 'project_code' | 'title' | 'total' | 'outstanding' | 'document_ref'

// --- Category values (cost_items.category) ---
export type CostCategory =
  | 'materials'
  | 'labor'
  | 'subcontractor'
  | 'equipment_rental'
  | 'permits_regulatory'
  | 'other'

// --- SG&A categories ---
export type SgaCategory =
  | 'software_licenses'
  | 'partner_compensation'
  | 'business_development'
  | 'professional_services'
  | 'office_admin'
  | 'other'

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

export type ArDetractionEntry = {
  ar_invoice_id: string
  project_code: string
  client_name: string
  invoice_number: string | null
  detraccion_amount: number
  currency: string
  received: number
  pending: number
}

export type ArOutstandingBucketId = 'all' | 'current' | '31-60' | '61-90' | '90+'
export type ArOutstandingFilters = {
  projectId: string
  client: string
  partnerCompanyId: string
  currency: string
}
export type ArOutstandingSortColumn =
  | 'due_date'
  | 'days_overdue'
  | 'client_name'
  | 'project_code'
  | 'invoice_number'
  | 'gross_total'
  | 'outstanding'

// --- Partner Balances component types ---

export type PartnerContribution = {
  partner_company_id: string
  partner_name: string
  contribution_amount_pen: number
  contribution_pct: number
  project_income_pen: number
  income_share_pen: number
}

export type PartnerSettlement = {
  partner_company_id: string
  partner_name: string
  income_share_pen: number
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
  title: string | null
  category: string
  subtotal: number
  currency: string | null
  exchange_rate: number | null
  subtotal_pen: number // subtotal * exchange_rate for USD, subtotal for PEN
}

// --- Cash Flow component types ---

export type CashFlowMonth = {
  month: string // YYYY-MM format
  label: string // "Jan 2026"
  isActual: boolean // true for past months, false for forecast
  isCurrentMonth: boolean // true for the current month only
  cashIn: number // projectCashIn + loansCashIn
  projectCashIn: number // AR invoice payments received
  loansCashIn: number // loan disbursements received (Alex-only, 0 for partners)
  materials: number
  labor: number
  subcontractor: number
  equipment: number
  other: number
  projectCosts: number // sum of material/labor/subcontractor/equipment/other
  sga: number // SG&A overhead costs (All Projects scope only)
  loanRepayment: number // Alex-only, 0 for partners
  cashOut: number // projectCosts + sga + loanRepayment
  net: number // cashIn - cashOut
}

export type CashFlowData = {
  months: CashFlowMonth[]
}

// --- P&L component types ---

export type PLPeriodMode = 'year' | 'quarter' | 'month'

export type PLMonthColumn = {
  key: string // YYYY-MM
  label: string // "Jan", "Feb", etc.
}

export type PLLineItem = {
  income: number
  projectCosts: number
  grossProfit: number
  grossMarginPct: number
  sga: number
  netProfit: number
  netMarginPct: number
  // Category breakdowns
  projectCostsByCategory: Record<string, number>
  sgaByCategory: Record<string, number>
  // Project breakdown for income
  incomeByProject: { projectCode: string; projectName: string; amount: number }[]
}

export type PLData = {
  columns: PLMonthColumn[]
  byMonth: Record<string, PLLineItem> // key = YYYY-MM
  total: PLLineItem
  // Alex-only personal position
  alexProfitShare: number | null
  loanObligations: number | null
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
  roleName: string | null
  totalSpent: number | null
  invoiceCount: number | null
  currency: string
}

export type ProjectArInvoice = {
  id: string
  invoice_number: string | null
  invoice_date: string | null
  gross_total: number
  currency: string
  payment_status: string
}

export type ProjectDetailData = {
  project: Project
  clientName: string | null
  entities: ProjectEntitySummary[]
  budget: BudgetVsActualRow[]
  arInvoices: ProjectArInvoice[]
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

export type EntityDetailData = {
  entity: Entity
  tags: string[]
  contacts: EntityContact[]
  transactionsByProject: ProjectTransactionGroup[]
}

export type EntityFilters = {
  search: string
  entityType: string
  tagId: string
  city: string
  region: string
}

export type EntitiesFilterOptions = {
  tags: { id: string; name: string }[]
  cities: string[]
  regions: string[]
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

export type PriceFilters = {
  titleSearch: string
  category: string
  entityId: string
  projectId: string
  tagId: string
  dateFrom: string
  dateTo: string
}

export type PriceSortColumn = 'date' | 'title' | 'entityName' | 'projectCode' | 'unit_price' | 'quantity'

export type PriceFilterOptions = {
  projects: { id: string; project_code: string; name: string }[]
  entities: { id: string; name: string }[]
  tags: { id: string; name: string }[]
  categories: string[]
}
