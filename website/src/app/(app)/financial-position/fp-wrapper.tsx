'use client'

import { useRouter } from 'next/navigation'
import { useCallback } from 'react'
import { FPClient } from './fp-client'
import type { Currency, FinancialPositionData } from '@/lib/types'

type Props = {
  initialData: FinancialPositionData
  isAlex: boolean
  currency: Currency
}

export function FPWrapper({ initialData, isAlex, currency }: Props) {
  const router = useRouter()

  const handleCurrencyChange = useCallback(
    (newCurrency: Currency) => {
      const params = new URLSearchParams()
      if (newCurrency !== 'PEN') params.set('currency', newCurrency)
      const qs = params.toString()
      router.push(`/financial-position${qs ? `?${qs}` : ''}`)
    },
    [router]
  )

  return (
    <FPClient
      data={initialData}
      isAlex={isAlex}
      currency={currency}
      onCurrencyChange={handleCurrencyChange}
    />
  )
}
