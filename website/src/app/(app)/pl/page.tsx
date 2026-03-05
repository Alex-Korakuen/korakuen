import { isCompanyView } from '@/lib/auth'
import { getCompanyPL, getLatestExchangeRate } from '@/lib/queries'
import type { PLPeriodMode } from '@/lib/types'
import { PLWrapper } from './pl-wrapper'

type Props = {
  searchParams: Promise<{ period?: string; year?: string; quarter?: string; month?: string }>
}

export default async function PLPage({ searchParams }: Props) {
  const params = await searchParams
  const isAlex = await isCompanyView()

  const periodMode = (['year', 'quarter', 'month'].includes(params.period ?? '')
    ? params.period
    : 'year') as PLPeriodMode
  const year = params.year ? Number(params.year) : new Date().getFullYear()
  const quarter = params.quarter ? Number(params.quarter) : Math.ceil((new Date().getMonth() + 1) / 3)
  const month = params.month ? Number(params.month) : new Date().getMonth() + 1

  const [data, exchangeRate] = await Promise.all([
    getCompanyPL(periodMode, year, quarter, month, 'PEN', isAlex),
    getLatestExchangeRate(),
  ])

  return (
    <PLWrapper
      initialData={data}
      isAlex={isAlex}
      periodMode={periodMode}
      year={year}
      quarter={quarter}
      month={month}
      exchangeRate={exchangeRate}
    />
  )
}
