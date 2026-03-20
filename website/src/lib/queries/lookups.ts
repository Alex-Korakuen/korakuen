import { createServerSupabaseClient } from '../supabase/server'
import type {
  EntitySearchResult,
  PartnerCompanyOption,
  CategoryOption,
} from '../types'

export type BankAccountOption = {
  id: string
  bank_name: string
  account_number_last4: string
  label: string
  currency: string
  is_detraccion_account: boolean
}

export type { PartnerCompanyOption, CategoryOption }

export async function getProjectsForFilter(): Promise<{ id: string; project_code: string; name: string }[]> {
  const supabase = await createServerSupabaseClient()
  const { data, error } = await supabase
    .from('projects')
    .select('id, project_code, name')
    .eq('is_active', true)
    .order('project_code')
  if (error) throw error
  return data ?? []
}

export async function getPartnerCompaniesForFilter(): Promise<{ id: string; name: string }[]> {
  const supabase = await createServerSupabaseClient()
  const { data, error } = await supabase
    .from('partner_companies')
    .select('id, name')
    .eq('is_active', true)
    .order('name')
  if (error) throw error
  return data ?? []
}

export async function getBankAccountsForPartner(
  partnerCompanyId: string
): Promise<BankAccountOption[]> {
  const supabase = await createServerSupabaseClient()
  const { data, error } = await supabase
    .from('bank_accounts')
    .select('id, bank_name, account_number_last4, label, currency, is_detraccion_account')
    .eq('partner_company_id', partnerCompanyId)
    .eq('is_active', true)
    .order('label')
  if (error) throw error
  return data ?? []
}

export async function getExchangeRateForDate(
  date: string
): Promise<{ mid_rate: number; rate_date: string } | null> {
  const supabase = await createServerSupabaseClient()
  const { data, error } = await supabase
    .from('exchange_rates')
    .select('mid_rate, rate_date')
    .lte('rate_date', date)
    .order('rate_date', { ascending: false })
    .limit(1)
    .single()
  if (error || !data) return null
  return { mid_rate: Number(data.mid_rate), rate_date: data.rate_date }
}

export async function getLatestExchangeRate(): Promise<{ mid_rate: number; rate_date: string } | null> {
  const supabase = await createServerSupabaseClient()
  const { data, error } = await supabase
    .from('exchange_rates')
    .select('mid_rate, rate_date')
    .order('rate_date', { ascending: false })
    .limit(1)
    .single()
  if (error || !data) return null
  return { mid_rate: Number(data.mid_rate), rate_date: data.rate_date }
}

export async function getPartnerCompanies(): Promise<PartnerCompanyOption[]> {
  const supabase = await createServerSupabaseClient()
  const { data, error } = await supabase
    .from('partner_companies')
    .select('id, name')
    .eq('is_active', true)
    .order('name')
  if (error) throw error
  return data ?? []
}

export async function searchEntities(
  query: string
): Promise<EntitySearchResult[]> {
  if (!query || query.trim().length < 2) return []
  const supabase = await createServerSupabaseClient()
  const pattern = `%${query.trim()}%`
  const { data, error } = await supabase
    .from('entities')
    .select('id, legal_name, document_number')
    .eq('is_active', true)
    .or(`legal_name.ilike.${pattern},document_number.ilike.${pattern}`)
    .order('legal_name')
    .limit(10)
  if (error) throw error
  return data ?? []
}

export async function getNextProjectCode(): Promise<string> {
  const supabase = await createServerSupabaseClient()
  const { data, error } = await supabase
    .from('projects')
    .select('project_code')
    .order('project_code', { ascending: false })
    .limit(1)
  if (error) throw error
  if (data && data.length > 0) {
    const lastNum = parseInt(data[0].project_code.replace('PRY', ''), 10)
    return `PRY${String(lastNum + 1).padStart(3, '0')}`
  }
  return 'PRY001'
}

export async function getProjectCategories(): Promise<CategoryOption[]> {
  const supabase = await createServerSupabaseClient()
  const { data, error } = await supabase
    .from('categories')
    .select('name, cost_type')
    .eq('is_active', true)
    .eq('cost_type', 'project_cost')
    .order('name')
  if (error) throw error
  return data ?? []
}

