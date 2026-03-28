import { getPaymentsPage } from '@/lib/queries'
import { parsePaginationParams } from '@/lib/pagination'
import { FK, str } from '@/lib/filter-keys'
import { getMonthDateRange } from '@/lib/date-utils'
import { PaymentsClient } from './payments-client'

type Props = {
  searchParams: Promise<Record<string, string | string[] | undefined>>
}

export default async function PaymentsPage({ searchParams }: Props) {
  const params = await searchParams
  const { page, sort, dir } = parsePaginationParams(params, { sort: 'payment_date', dir: 'desc' })

  const month = str(params, FK.month)
  const { dateFrom, dateTo } = month ? getMonthDateRange(month) : { dateFrom: undefined, dateTo: undefined }

  const filters = {
    direction: str(params, FK.direction) as 'inbound' | 'outbound' | undefined,
    paymentType: str(params, FK.type) as 'regular' | 'detraccion' | 'retencion' | undefined,
    category: str(params, FK.category),
    entity: str(params, FK.entity),
    projectId: str(params, FK.project),
    bankAccountId: str(params, FK.bank),
    partnerId: str(params, FK.partner),
    dateFrom,
    dateTo,
    sort,
    dir,
    page,
  }

  const result = await getPaymentsPage(filters)

  return (
    <PaymentsClient
      data={result.paginated.data}
      totalCount={result.paginated.totalCount}
      page={result.paginated.page}
      pageSize={result.paginated.pageSize}
      summary={result.summary}
      projects={result.uniqueProjects}
      bankAccounts={result.uniqueBankAccounts}
      partners={result.uniquePartners}
      categories={result.uniqueCategories}
      entities={result.uniqueEntities}
      currentFilters={{
        month: month ?? '',
        partnerId: filters.partnerId ?? '',
        projectId: filters.projectId ?? '',
        category: filters.category ?? '',
        entity: filters.entity ?? '',
        bankAccountId: filters.bankAccountId ?? '',
        direction: filters.direction ?? '',
        paymentType: filters.paymentType ?? '',
      }}
    />
  )
}
