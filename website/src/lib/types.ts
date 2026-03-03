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

export type ProjectStatus = 'prospective' | 'active' | 'completed' | 'suspended'

export type ProjectType = 'subcontractor' | 'oxi'

export type CostType = 'project' | 'sga'

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

// --- Category values (cost_items.category) ---
export type CostCategory =
  | 'materials'
  | 'labor'
  | 'subcontractor'
  | 'equipment'
  | 'permits'
  | 'other'

// --- SG&A categories ---
export type SgaCategory =
  | 'software_licenses'
  | 'partner_compensation'
  | 'business_development'
  | 'professional_services'
  | 'office_admin'
  | 'other'
