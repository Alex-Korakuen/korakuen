'use client'

import { useState, useEffect } from 'react'
import { fetchExchangeRateForDate } from '@/lib/actions'

/** Auto-fetches the mid exchange rate whenever `date` changes. Returns null while loading or on error. */
export function useExchangeRate(date: string, enabled: boolean = true): number | null {
  const [rate, setRate] = useState<number | null>(null)

  useEffect(() => {
    if (!enabled) return
    fetchExchangeRateForDate(date)
      .then(r => setRate(r?.mid_rate ?? null))
      .catch(() => setRate(null))
  }, [date, enabled])

  return rate
}
