'use client'

import { useState, useCallback } from 'react'

export function useDetailModal<TRow, TDetail>() {
  const [selectedRow, setSelectedRow] = useState<TRow | null>(null)
  const [detail, setDetail] = useState<TDetail | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(false)

  const open = useCallback(async (row: TRow, fetcher: () => Promise<TDetail | null>) => {
    setSelectedRow(row)
    setDetail(null)
    setLoading(true)
    setError(false)
    try {
      setDetail(await fetcher())
    } catch {
      setError(true)
    } finally {
      setLoading(false)
    }
  }, [])

  const close = useCallback(() => {
    setSelectedRow(null)
    setDetail(null)
  }, [])

  return { selectedRow, detail, loading, error, open, close }
}
