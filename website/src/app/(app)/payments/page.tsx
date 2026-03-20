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

  // Derive dateFrom/dateTo from month param (e.g. "2026-03" → "2026-03-01" / "2026-03-31")
  const month = str(params, FK.month)
  let dateFrom: string | undefined
  let dateTo: string | undefined
  if (month) {
    const [y, m] = month.split('-').map(Number)
    const lastDay = new Date(y, m, 0).getDate()
    dateFrom = `${month}-01`
    dateTo = `${month}-${String(lastDay).padStart(2, '0')}`
  }

  const filters = {
    direction: str(params, FK.direction) as 'inbound' | 'outbound' | undefined,
    paymentType: str(params, FK.type) as 'regular' | 'detraccion' | 'retencion' | undefined,
    relatedTo: str(params, FK.related) as 'invoice' | 'loan_schedule' | undefined,
    projectId: str(params, FK.project),
    bankAccountId: str(params, FK.bank),
    search: str(params, FK.search),
    dateFrom,
    dateTo,
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
        month: month ?? '',
      }}
    />
  )
}
