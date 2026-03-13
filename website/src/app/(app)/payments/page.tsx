import { getPaymentsPage } from '@/lib/queries'
import { getPartnerFilter } from '@/lib/partner-filter-server'
import { parsePaginationParams } from '@/lib/pagination'
import { PaymentsClient } from './payments-client'

type Props = {
  searchParams: Promise<Record<string, string | string[] | undefined>>
}

export default async function PaymentsPage({ searchParams }: Props) {
  const params = await searchParams
  const partnerIds = await getPartnerFilter()
  const { page, sort, dir } = parsePaginationParams(params, { sort: 'payment_date', dir: 'desc' })

  const filters = {
    direction: typeof params.direction === 'string' ? params.direction as 'inbound' | 'outbound' : undefined,
    paymentType: typeof params.type === 'string' ? params.type as 'regular' | 'detraccion' | 'retencion' : undefined,
    relatedTo: typeof params.related === 'string' ? params.related as 'invoice' | 'loan_schedule' : undefined,
    projectId: typeof params.project === 'string' ? params.project : undefined,
    bankAccountId: typeof params.bank === 'string' ? params.bank : undefined,
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
      }}
    />
  )
}
