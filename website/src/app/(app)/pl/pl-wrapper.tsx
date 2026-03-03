'use client'

import { useRouter } from 'next/navigation'
import { useCallback } from 'react'
import { PLClient } from './pl-client'
import type { PLData, PLPeriodMode, Currency } from '@/lib/types'

type Props = {
  initialData: PLData
  isAlex: boolean
  periodMode: PLPeriodMode
  year: number
  quarter: number
  month: number
  currency: Currency
}

export function PLWrapper({
  initialData,
  isAlex,
  periodMode,
  year,
  quarter,
  month,
  currency,
}: Props) {
  const router = useRouter()

  const handleParamsChange = useCallback(
    (newPeriod: PLPeriodMode, newYear: number, newQuarter: number, newMonth: number, newCurrency: Currency) => {
      const params = new URLSearchParams()
      if (newPeriod !== 'year') params.set('period', newPeriod)
      if (newYear !== new Date().getFullYear()) params.set('year', String(newYear))
      if (newPeriod === 'quarter') params.set('quarter', String(newQuarter))
      if (newPeriod === 'month') params.set('month', String(newMonth))
      if (newCurrency !== 'PEN') params.set('currency', newCurrency)
      const qs = params.toString()
      router.push(`/pl${qs ? `?${qs}` : ''}`)
    },
    [router]
  )

  return (
    <PLClient
      data={initialData}
      isAlex={isAlex}
      periodMode={periodMode}
      year={year}
      quarter={quarter}
      month={month}
      currency={currency}
      onParamsChange={handleParamsChange}
    />
  )
}
