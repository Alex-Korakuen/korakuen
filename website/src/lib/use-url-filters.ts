'use client'

import { useCallback } from 'react'
import { useRouter, useSearchParams, usePathname } from 'next/navigation'
import { pushParamsWithPageReset } from './url-params'

/** Hook for updating URL searchParams as filter state. Resets page to 1 on any filter change. */
export function useUrlFilters() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const pathname = usePathname()

  const setFilter = useCallback((key: string, value: string) => {
    pushParamsWithPageReset(router, pathname, searchParams, params => {
      if (value) params.set(key, value)
      else params.delete(key)
    })
  }, [router, searchParams, pathname])

  const setFilters = useCallback((updates: Record<string, string>) => {
    pushParamsWithPageReset(router, pathname, searchParams, params => {
      for (const [key, value] of Object.entries(updates)) {
        if (value) params.set(key, value)
        else params.delete(key)
      }
    })
  }, [router, searchParams, pathname])

  const clearFilters = useCallback((keys: string[]) => {
    pushParamsWithPageReset(router, pathname, searchParams, params => {
      for (const key of keys) params.delete(key)
    })
  }, [router, searchParams, pathname])

  return { setFilter, setFilters, clearFilters }
}
