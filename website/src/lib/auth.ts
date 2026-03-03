import { createServerSupabaseClient } from './supabase/server'

export async function getCurrentUser() {
  const supabase = await createServerSupabaseClient()
  const { data: { user } } = await supabase.auth.getUser()
  return user
}

export async function isCompanyView(): Promise<boolean> {
  const user = await getCurrentUser()
  return user?.user_metadata?.is_company_view === true
}

export async function getPartnerName(): Promise<string> {
  const user = await getCurrentUser()
  return user?.user_metadata?.display_name ?? user?.user_metadata?.full_name ?? user?.email?.split('@')[0] ?? 'User'
}

export async function getPartnerCompanyId(): Promise<string | null> {
  const user = await getCurrentUser()
  return user?.user_metadata?.partner_company_id ?? null
}
