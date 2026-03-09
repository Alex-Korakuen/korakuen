'use client'

import { useState, useCallback, useRef } from 'react'

export function useDetailModal<TRow, TDetail>() {
  const [selectedRow, setSelectedRow] = useState<TRow | null>(null)
  const [detail, setDetail] = useState<TDetail | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(false)
  const fetcherRef = useRef<(() => Promise<TDetail | null>) | null>(null)

  const open = useCallback(async (row: TRow, fetcher: () => Promise<TDetail | null>) => {
    setSelectedRow(row)
    setDetail(null)
    setLoading(true)
    setError(false)
    fetcherRef.current = fetcher
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
    fetcherRef.current = null
  }, [])

  const refetch = useCallback(async () => {
    if (!fetcherRef.current) return
    setLoading(true)
    setError(false)
    try {
      setDetail(await fetcherRef.current())
    } catch {
      setError(true)
    } finally {
      setLoading(false)
    }
  }, [])

  return { selectedRow, detail, loading, error, open, close, refetch }
}
