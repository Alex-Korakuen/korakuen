import {
  getInvoicesPage,
  getProjectsForFilter,
  getLatestExchangeRate,
  getProjectCategories,
} from '@/lib/queries'
import { getPartnerFilter } from '@/lib/partner-filter-server'
import { parsePaginationParams } from '@/lib/pagination'
import { FK, str } from '@/lib/filter-keys'
import { InvoicesClient } from './invoices-client'
import type { InvoiceTab } from '@/lib/queries'

type Props = {
  searchParams: Promise<Record<string, string | string[] | undefined>>
}

export default async function InvoicesPage({ searchParams }: Props) {
  const params = await searchParams
  const partnerIds = await getPartnerFilter()
  const { page, sort, dir } = parsePaginationParams(params, { sort: 'due_date', dir: 'desc' })

  const tabRaw = str(params, 'tab') ?? 'payable'
  const tab: InvoiceTab = ['payable', 'receivable', 'loans'].includes(tabRaw)
    ? (tabRaw as InvoiceTab)
    : 'payable'

  const filters = {
    tab,
    status: str(params, FK.status) as 'pending' | 'partial' | 'paid' | 'overdue' | undefined,
    projectId: str(params, FK.project),
    entity: str(params, FK.entity),
    bucket: str(params, FK.bucket),
    search: str(params, FK.search),
    sort,
    dir,
    page,
  }

  const [exchangeRate, projects, categories] = await Promise.all([
    getLatestExchangeRate(),
    getProjectsForFilter(),
    getProjectCategories(),
  ])

  const result = await getInvoicesPage(partnerIds, filters, exchangeRate?.mid_rate ?? null)

  return (
    <InvoicesClient
      tab={tab}
      data={result.paginated.data}
      totalCount={result.paginated.totalCount}
      page={result.paginated.page}
      pageSize={result.paginated.pageSize}
      payableBuckets={result.payableBuckets}
      receivableBuckets={result.receivableBuckets}
      summary={result.summary}
      projects={projects}
      uniqueEntities={result.uniqueEntities}
      categories={categories}
      currentFilters={{
        status: filters.status ?? '',
        projectId: filters.projectId ?? '',
        entity: filters.entity ?? '',
        bucket: filters.bucket ?? 'all',
        search: filters.search ?? '',
      }}
    />
  )
}
