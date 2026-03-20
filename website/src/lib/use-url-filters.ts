'use client'

import { useCallback } from 'react'
import { useRouter, useSearchParams, usePathname } from 'next/navigation'

/** Hook for updating URL searchParams as filter state. Resets page to 1 on any filter change. */
export function useUrlFilters() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const pathname = usePathname()

  const setFilter = useCallback((key: string, value: string) => {
    const params = new URLSearchParams(searchParams.toString())
    if (value) {
      params.set(key, value)
    } else {
      params.delete(key)
    }
    params.delete('page')
    router.push(`${pathname}?${params.toString()}`)
  }, [router, searchParams, pathname])

  const setFilters = useCallback((updates: Record<string, string>) => {
    const params = new URLSearchParams(searchParams.toString())
    for (const [key, value] of Object.entries(updates)) {
      if (value) {
        params.set(key, value)
      } else {
        params.delete(key)
      }
    }
    params.delete('page')
    router.push(`${pathname}?${params.toString()}`)
  }, [router, searchParams, pathname])

  const clearFilters = useCallback((keys: string[]) => {
    const params = new URLSearchParams(searchParams.toString())
    for (const key of keys) {
      params.delete(key)
    }
    params.delete('page')
    router.push(`${pathname}?${params.toString()}`)
  }, [router, searchParams, pathname])

  return { setFilter, setFilters, clearFilters }
}
