import { createServerSupabaseClient } from '../supabase/server'
import { buildEntityTagsMap, DEFAULT_CURRENCY, convertToPen } from './shared'
import { PAGE_SIZE } from '../pagination'
import type { PaginatedResult } from '../pagination'
import type {
  Currency,
  EntityDetailData,
  EntityDirectoryItem,
  EntityListItem,
  EntityLedgerGroup,
  EntityLedgerRow,
  EntitiesFilterOptions,
} from '../types'

type EntitiesListFilters = {
  search?: string
  entityType?: string
  tagId?: string
  city?: string
  region?: string
  page: number
}

export async function getEntitiesList(
  filters: EntitiesListFilters = { page: 1 }
): Promise<PaginatedResult<EntityListItem>> {
  const supabase = await createServerSupabaseClient()

  // If tag filter is active, get matching entity IDs first
  let tagEntityIds: string[] | null = null
  if (filters.tagId) {
    const { data: etData, error: etError } = await supabase
      .from('entity_tags')
      .select('entity_id')
      .eq('tag_id', filters.tagId)
    if (etError) throw etError
    tagEntityIds = (etData ?? []).map(et => et.entity_id)
    if (tagEntityIds.length === 0) {
      return { data: [], totalCount: 0, page: filters.page, pageSize: PAGE_SIZE }
    }
  }

  // Build filtered query
  let query = supabase
    .from('entities')
    .select('id, legal_name, document_type, document_number, entity_type, city, region', { count: 'exact' })
    .eq('is_active', true)
    .order('legal_name')

  if (filters.search) {
    const s = `%${filters.search}%`
    query = query.or(`legal_name.ilike.${s},document_number.ilike.${s}`)
  }
  if (filters.entityType) query = query.eq('entity_type', filters.entityType)
  if (filters.city) query = query.eq('city', filters.city)
  if (filters.region) query = query.eq('region', filters.region)
  if (tagEntityIds) query = query.in('id', tagEntityIds)

  // Apply pagination
  const offset = (filters.page - 1) * PAGE_SIZE
  query = query.range(offset, offset + PAGE_SIZE - 1)

  const { data: entities, error, count } = await query

  if (error) throw error

  // Fetch tags for the returned entities
  const entityIds = (entities ?? []).map(e => e.id)
  const tagsByEntity = await buildEntityTagsMap(supabase, entityIds)

  const items: EntityListItem[] = (entities ?? []).map(e => ({
    id: e.id,
    legal_name: e.legal_name,
    document_type: e.document_type,
    document_number: e.document_number,
    entity_type: e.entity_type,
    city: e.city,
    region: e.region,
    tags: tagsByEntity.get(e.id) ?? [],
  }))

  return {
    data: items,
    totalCount: count ?? 0,
    page: filters.page,
    pageSize: PAGE_SIZE,
  }
}

export async function getEntitiesDirectory(
  filters: EntitiesListFilters = { page: 1 }
): Promise<PaginatedResult<EntityDirectoryItem>> {
  const supabase = await createServerSupabaseClient()

  // Get the base entity list (paginated, filtered)
  const listResult = await getEntitiesList(filters)
  if (listResult.data.length === 0) {
    return {
      data: [],
      totalCount: listResult.totalCount,
      page: listResult.page,
      pageSize: listResult.pageSize,
    }
  }

  const entityIds = listResult.data.map(e => e.id)

  // Aggregate financial totals from v_invoice_balances in one query
  // All amounts converted to PEN — never mix currencies
  const { data: balances, error: balError } = await supabase
    .from('v_invoice_balances')
    .select('entity_id, direction, currency, exchange_rate, total, outstanding')
    .in('entity_id', entityIds)

  if (balError) throw balError

  const financials = new Map<string, {
    totalPayable: number
    outstandingPayable: number
    totalReceivable: number
    outstandingReceivable: number
  }>()

  for (const row of balances ?? []) {
    if (!row.entity_id) continue
    let agg = financials.get(row.entity_id)
    if (!agg) {
      agg = { totalPayable: 0, outstandingPayable: 0, totalReceivable: 0, outstandingReceivable: 0 }
      financials.set(row.entity_id, agg)
    }
    const totalPen = convertToPen(row.total ?? 0, row.currency, row.exchange_rate)
    const outstandingPen = convertToPen(row.outstanding ?? 0, row.currency, row.exchange_rate)
    if (row.direction === 'payable') {
      agg.totalPayable += totalPen
      agg.outstandingPayable += outstandingPen
    } else {
      agg.totalReceivable += totalPen
      agg.outstandingReceivable += outstandingPen
    }
  }

  const items: EntityDirectoryItem[] = listResult.data.map(e => {
    const fin = financials.get(e.id)
    return {
      ...e,
      totalPayable: fin?.totalPayable ?? 0,
      outstandingPayable: fin?.outstandingPayable ?? 0,
      totalReceivable: fin?.totalReceivable ?? 0,
      outstandingReceivable: fin?.outstandingReceivable ?? 0,
      currency: 'PEN' as Currency,
    }
  })

  return {
    data: items,
    totalCount: listResult.totalCount,
    page: listResult.page,
    pageSize: listResult.pageSize,
  }
}

export async function getEntityDetail(entityId: string): Promise<EntityDetailData> {
  const supabase = await createServerSupabaseClient()

  const [entityResult, tagsResult, contactsResult, payablesResult, receivablesResult] = await Promise.all([
    supabase.from('entities').select('*').eq('id', entityId).single(),
    supabase.from('entity_tags').select('tag_id, tags(name)').eq('entity_id', entityId),
    supabase
      .from('entity_contacts')
      .select('*')
      .eq('entity_id', entityId)
      .eq('is_active', true)
      .order('full_name'),
    supabase
      .from('v_invoice_balances')
      .select('invoice_id, project_id, invoice_date, title, currency, total, outstanding')
      .eq('direction', 'payable')
      .eq('entity_id', entityId)
      .order('invoice_date', { ascending: false }),
    supabase
      .from('v_invoice_balances')
      .select('invoice_id, project_id, invoice_date, invoice_number, notes, currency, total, outstanding')
      .eq('direction', 'receivable')
      .eq('entity_id', entityId)
      .order('invoice_date', { ascending: false }),
  ])

  if (entityResult.error) throw entityResult.error
  if (tagsResult.error) throw tagsResult.error
  if (contactsResult.error) throw contactsResult.error
  if (payablesResult.error) throw payablesResult.error
  if (receivablesResult.error) throw receivablesResult.error

  const tags = (tagsResult.data ?? [])
    .map(t => {
      const name = (t.tags as unknown as { name: string } | null)?.name
      return name ? { tagId: t.tag_id, name } : null
    })
    .filter((t): t is { tagId: string; name: string } => t !== null)

  // Collect all project IDs to fetch codes/names
  const projectIds = new Set<string>()
  for (const c of payablesResult.data ?? []) if (c.project_id) projectIds.add(c.project_id)
  for (const a of receivablesResult.data ?? []) if (a.project_id) projectIds.add(a.project_id)

  const projectMap = new Map<string, { code: string; name: string }>()
  if (projectIds.size > 0) {
    const { data: projects, error: projError } = await supabase
      .from('projects')
      .select('id, project_code, name')
      .in('id', [...projectIds])
    if (projError) throw projError
    for (const p of projects ?? []) {
      projectMap.set(p.id, { code: p.project_code, name: p.name })
    }
  }

  // Group payables by (project_id, currency)
  const payablesByProject = groupLedger(
    (payablesResult.data ?? []).map(c => ({
      transactionId: c.invoice_id,
      projectId: c.project_id,
      date: c.invoice_date,
      title: c.title,
      currency: c.currency ?? DEFAULT_CURRENCY,
      invoiceTotal: c.total ?? 0,
      outstanding: c.outstanding ?? 0,
    })),
    projectMap,
  )

  // Group receivables by (project_id, currency)
  const receivablesByProject = groupLedger(
    (receivablesResult.data ?? []).map(a => ({
      transactionId: a.invoice_id,
      projectId: a.project_id,
      date: a.invoice_date,
      title: a.notes ?? (a.invoice_number ? `Invoice ${a.invoice_number}` : null),
      currency: a.currency ?? DEFAULT_CURRENCY,
      invoiceTotal: a.total ?? 0,
      outstanding: a.outstanding ?? 0,
    })),
    projectMap,
  )

  return {
    entity: entityResult.data,
    tags,
    contacts: contactsResult.data ?? [],
    payablesByProject,
    receivablesByProject,
  }
}

type RawLedgerRow = {
  transactionId: string | null
  projectId: string | null
  date: string | null
  title: string | null
  currency: string
  invoiceTotal: number
  outstanding: number
}

function groupLedger(
  rows: RawLedgerRow[],
  projectMap: Map<string, { code: string; name: string }>,
): EntityLedgerGroup[] {
  const groups = new Map<string, EntityLedgerGroup>()

  for (const row of rows) {
    const key = `${row.projectId ?? '__none__'}|${row.currency}`
    const existing = groups.get(key)
    const proj = row.projectId ? projectMap.get(row.projectId) : null
    const txRow: EntityLedgerRow = {
      transactionId: row.transactionId ?? '',
      date: row.date,
      title: row.title,
      invoiceTotal: row.invoiceTotal,
      outstanding: row.outstanding,
      currency: row.currency as Currency,
    }

    if (existing) {
      existing.invoiceTotal += row.invoiceTotal
      existing.outstanding += row.outstanding
      if (row.date && (!existing.lastDate || row.date > existing.lastDate)) {
        existing.lastDate = row.date
      }
      existing.transactions.push(txRow)
    } else {
      groups.set(key, {
        projectId: row.projectId ?? '',
        projectCode: proj?.code ?? '—',
        projectName: proj?.name ?? '—',
        invoiceTotal: row.invoiceTotal,
        outstanding: row.outstanding,
        lastDate: row.date,
        currency: row.currency as Currency,
        transactions: [txRow],
      })
    }
  }

  return [...groups.values()].sort((a, b) => b.invoiceTotal - a.invoiceTotal)
}

export async function getEntitiesFilterOptions(): Promise<EntitiesFilterOptions> {
  const supabase = await createServerSupabaseClient()

  const [tagsResult, entitiesResult] = await Promise.all([
    supabase.from('tags').select('id, name').eq('is_active', true).order('name'),
    supabase.from('entities').select('city, region').eq('is_active', true),
  ])

  if (tagsResult.error) throw tagsResult.error
  if (entitiesResult.error) throw entitiesResult.error

  const cities = [...new Set((entitiesResult.data ?? []).map(e => e.city).filter(Boolean))] as string[]
  const regions = [...new Set((entitiesResult.data ?? []).map(e => e.region).filter(Boolean))] as string[]

  return {
    tags: tagsResult.data ?? [],
    cities: cities.sort(),
    regions: regions.sort(),
  }
}
