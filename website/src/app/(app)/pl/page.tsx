import { isCompanyView } from '@/lib/auth'
import { getCompanyPL } from '@/lib/queries'
import type { Currency, PLPeriodMode } from '@/lib/types'
import { PLWrapper } from './pl-wrapper'

type Props = {
  searchParams: Promise<{ period?: string; year?: string; quarter?: string; month?: string; currency?: string }>
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
  const currency = (params.currency === 'USD' ? 'USD' : 'PEN') as Currency

  const data = await getCompanyPL(periodMode, year, quarter, month, currency, isAlex)

  return (
    <PLWrapper
      initialData={data}
      isAlex={isAlex}
      periodMode={periodMode}
      year={year}
      quarter={quarter}
      month={month}
      currency={currency}
    />
  )
}
