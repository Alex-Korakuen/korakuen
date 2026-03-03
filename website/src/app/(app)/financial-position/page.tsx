import { isCompanyView } from '@/lib/auth'
import { getFinancialPosition } from '@/lib/queries'
import type { Currency } from '@/lib/types'
import { FPWrapper } from './fp-wrapper'

type Props = {
  searchParams: Promise<{ currency?: string }>
}

export default async function FinancialPositionPage({ searchParams }: Props) {
  const params = await searchParams
  const isAlex = await isCompanyView()
  const currency = (params.currency === 'USD' ? 'USD' : 'PEN') as Currency

  const data = await getFinancialPosition(isAlex, currency)

  return (
    <FPWrapper
      initialData={data}
      isAlex={isAlex}
      currency={currency}
    />
  )
}
