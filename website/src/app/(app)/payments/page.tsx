import { getPaymentsPage } from '@/lib/queries'
import { getPartnerFilter } from '@/lib/partner-filter-server'
import { parsePaginationParams } from '@/lib/pagination'
import { FK, str } from '@/lib/filter-keys'
import { PaymentsClient } from './payments-client'

type Props = {
  searchParams: Promise<Record<string, string | string[] | undefined>>
}

export default async function PaymentsPage({ searchParams }: Props) {
  const params = await searchParams
  const partnerIds = await getPartnerFilter()
  const { page, sort, dir } = parsePaginationParams(params, { sort: 'payment_date', dir: 'desc' })

  const filters = {
    direction: str(params, FK.direction) as 'inbound' | 'outbound' | undefined,
    paymentType: str(params, FK.type) as 'regular' | 'detraccion' | 'retencion' | undefined,
    relatedTo: str(params, FK.related) as 'invoice' | 'loan_schedule' | undefined,
    projectId: str(params, FK.project),
    bankAccountId: str(params, FK.bank),
    search: str(params, FK.search),
    dateFrom: str(params, FK.dateFrom),
    dateTo: str(params, FK.dateTo),
    sort,
    dir,
    page,
  }

  const result = await getPaymentsPage(partnerIds, filters)

  return (
    <PaymentsClient
      data={result.paginated.data}
      totalCount={result.paginated.totalCount}
      page={result.paginated.page}
      pageSize={result.paginated.pageSize}
      summary={result.summary}
      projects={result.uniqueProjects}
      bankAccounts={result.uniqueBankAccounts}
      currentFilters={{
        direction: filters.direction ?? '',
        paymentType: filters.paymentType ?? '',
        relatedTo: filters.relatedTo ?? '',
        projectId: filters.projectId ?? '',
        bankAccountId: filters.bankAccountId ?? '',
        search: filters.search ?? '',
        dateFrom: filters.dateFrom ?? '',
        dateTo: filters.dateTo ?? '',
      }}
    />
  )
}
