import { createServerSupabaseClient } from './supabase/server'

export async function getCurrentUser() {
  const supabase = await createServerSupabaseClient()
  const { data: { user } } = await supabase.auth.getUser()
  return user
}

export async function getPartnerName(): Promise<string> {
  const user = await getCurrentUser()
  return user?.user_metadata?.display_name ?? user?.user_metadata?.full_name ?? user?.email?.split('@')[0] ?? 'User'
}

