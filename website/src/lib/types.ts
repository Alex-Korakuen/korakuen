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
export type Valuation = Database['public']['Tables']['valuations']['Row']
export type Quote = Database['public']['Tables']['quotes']['Row']
export type Cost = Database['public']['Tables']['costs']['Row']
export type CostItem = Database['public']['Tables']['cost_items']['Row']
export type ArInvoice = Database['public']['Tables']['ar_invoices']['Row']
export type Payment = Database['public']['Tables']['payments']['Row']
export type Loan = Database['public']['Tables']['loans']['Row']
export type LoanSchedule = Database['public']['Tables']['loan_schedule']['Row']
export type LoanPayment = Database['public']['Tables']['loan_payments']['Row']
export type ProjectBudget = Database['public']['Tables']['project_budgets']['Row']

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
export type SettlementDashboardRow = Database['public']['Views']['v_settlement_dashboard']['Row']

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

export type ReturnType = 'percentage' | 'fixed' | 'none'

export type ApCalendarEntryType = 'supplier_invoice' | 'loan_payment'

// --- AP Calendar component types ---

export type DetractionEntry = {
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
  items: {
    id: string
    cost_id: string
    title: string
    quantity: number
    unit_of_measure: string | null
    unit_price: number
    category: string
    created_at: string
    updated_at: string
  }[]
  payments: {
    id: string
    payment_date: string
    payment_type: string
    amount: number
    currency: string
    related_id: string
    related_to: string
    created_at: string
    updated_at: string
  }[]
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

export type ApCalendarSortColumn = 'due_date' | 'days_remaining' | 'entity_name' | 'project_code' | 'title' | 'outstanding'
export type ApCalendarSortDirection = 'asc' | 'desc'

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
  | 'invoice_number'
  | 'project_code'
  | 'client_name'
  | 'invoice_date'
  | 'due_date'
  | 'days_overdue'
  | 'gross_total'
  | 'outstanding'
  | 'net_receivable'

// --- Cash Flow component types ---

export type CashFlowMonth = {
  month: string // YYYY-MM format
  label: string // "Jan 2026"
  isActual: boolean // true for past months, false for forecast
  cashIn: number
  materials: number
  labor: number
  subcontractor: number
  equipment: number
  other: number
  loans: number // Alex-only, 0 for partners
  cashOut: number // sum of category columns + loans
  net: number // cashIn - cashOut
}

export type CashFlowData = {
  months: CashFlowMonth[]
}
