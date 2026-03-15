// URL search param keys for page filters.
// Use these constants instead of raw strings so typos are caught at compile time.

export const FK = {
  direction: 'direction',
  type: 'type',
  status: 'status',
  project: 'project',
  entity: 'entity',
  bucket: 'bucket',
  search: 'search',
  currency: 'currency',
  related: 'related',
  bank: 'bank',
  category: 'category',
  tag: 'tag',
  dateFrom: 'dateFrom',
  dateTo: 'dateTo',
  entityType: 'entityType',
  tagId: 'tagId',
  city: 'city',
  region: 'region',
  selected: 'selected',
} as const

/** Extract a single string param, returning undefined if missing or an array. */
export function str(params: Record<string, string | string[] | undefined>, key: string): string | undefined {
  const v = params[key]
  return typeof v === 'string' ? v : undefined
}
