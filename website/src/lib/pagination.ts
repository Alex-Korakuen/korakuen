export const PAGE_SIZE = 20

export type PaginatedResult<T> = {
  data: T[]
  totalCount: number
  page: number
  pageSize: number
}

/** Paginate an in-memory array. Page is 1-based. */
export function paginateArray<T>(items: T[], page: number, pageSize: number = PAGE_SIZE): PaginatedResult<T> {
  const maxPage = Math.ceil(items.length / pageSize) || 1
  const validPage = Math.min(Math.max(1, page), maxPage)
  const offset = (validPage - 1) * pageSize
  return {
    data: items.slice(offset, offset + pageSize),
    totalCount: items.length,
    page: validPage,
    pageSize,
  }
}

/** Parse pagination + sort params from searchParams with page-specific defaults. */
export function parsePaginationParams(
  searchParams: Record<string, string | string[] | undefined>,
  defaults: { sort: string; dir?: 'asc' | 'desc' }
): { page: number; sort: string; dir: 'asc' | 'desc' } {
  const raw = typeof searchParams.page === 'string' ? searchParams.page : '1'
  const page = Math.max(1, parseInt(raw, 10) || 1)
  const sort = (typeof searchParams.sort === 'string' ? searchParams.sort : '') || defaults.sort
  const dirRaw = typeof searchParams.dir === 'string' ? searchParams.dir : ''
  const dir = dirRaw === 'desc' ? 'desc' : dirRaw === 'asc' ? 'asc' : (defaults.dir ?? 'asc')
  return { page, sort, dir }
}
