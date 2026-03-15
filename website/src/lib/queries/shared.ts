import type { SupabaseClient } from '@supabase/supabase-js'

/** Fetch entity names by IDs and return a Map of id -> display name (common_name || legal_name) */
export async function buildEntityNameMap(
  supabase: SupabaseClient,
  entityIds: string[]
): Promise<Map<string, string>> {
  if (entityIds.length === 0) return new Map()
  const { data, error } = await supabase
    .from('entities')
    .select('id, legal_name, common_name')
    .in('id', entityIds)
  if (error) throw error
  return new Map((data ?? []).map(e => [e.id, e.common_name || e.legal_name]))
}

export async function buildProjectCodeMap(
  supabase: SupabaseClient,
  projectIds: string[]
): Promise<Map<string, string>> {
  if (projectIds.length === 0) return new Map()
  const { data, error } = await supabase
    .from('projects')
    .select('id, project_code')
    .in('id', projectIds)
  if (error) throw error
  return new Map((data ?? []).map(p => [p.id, p.project_code]))
}
