import type { SupabaseClient } from '@supabase/supabase-js'
import type { Currency } from '../types'

/** Default currency when database value is null */
export const DEFAULT_CURRENCY: Currency = 'PEN'

/** Round to 2 decimal places (currency precision) */
export function round2(value: number): number {
  return Math.round(value * 100) / 100
}

/** Convert an amount to PEN using the exchange rate — USD amounts are multiplied by rate */
export function convertToPen(
  amount: number,
  currency: Currency | string | null | undefined,
  exchangeRate: number | string | null | undefined,
): number {
  const rate = exchangeRate ? Number(exchangeRate) : 1
  return currency === 'USD' ? amount * rate : amount
}

/** Fetch entity names by IDs and return a Map of id -> display name (legal_name) */
export async function buildEntityNameMap(
  supabase: SupabaseClient,
  entityIds: string[]
): Promise<Map<string, string>> {
  if (entityIds.length === 0) return new Map()
  const { data, error } = await supabase
    .from('entities')
    .select('id, legal_name')
    .in('id', entityIds)
  if (error) throw error
  return new Map((data ?? []).map(e => [e.id, e.legal_name]))
}

/** Fetch entity tags by entity IDs and return a Map of entity_id -> tag names */
export async function buildEntityTagsMap(
  supabase: SupabaseClient,
  entityIds: string[]
): Promise<Map<string, string[]>> {
  if (entityIds.length === 0) return new Map()
  const { data, error } = await supabase
    .from('entity_tags')
    .select('entity_id, tags(name)')
    .in('entity_id', entityIds)
  if (error) throw error
  const map = new Map<string, string[]>()
  for (const et of data ?? []) {
    const tagName = (et.tags as unknown as { name: string } | null)?.name
    if (tagName) {
      const existing = map.get(et.entity_id) ?? []
      existing.push(tagName)
      map.set(et.entity_id, existing)
    }
  }
  return map
}

/** Build invoice_id → Set<category> mapping from invoice_items rows */
export function buildInvoiceCategoryMap(
  items: { invoice_id: string; category: string | null }[]
): Map<string, Set<string>> {
  const map = new Map<string, Set<string>>()
  for (const item of items) {
    if (!item.category) continue
    if (!map.has(item.invoice_id)) {
      map.set(item.invoice_id, new Set())
    }
    map.get(item.invoice_id)!.add(item.category)
  }
  return map
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
