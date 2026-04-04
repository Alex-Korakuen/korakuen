'use client'

import { useCallback } from 'react'
import { useRouter, useSearchParams, usePathname } from 'next/navigation'
import { pushParamsWithPageReset } from './url-params'

/**
 * URL-driven sort hook for paginated pages.
 * Reads sort/dir from URL searchParams, updates via router.push.
 * Resets page to 1 on sort change.
 */
export function useUrlSort(defaultColumn: string, defaultDirection: 'asc' | 'desc' = 'asc') {
  const router = useRouter()
  const searchParams = useSearchParams()
  const pathname = usePathname()

  const sortColumn = searchParams.get('sort') || defaultColumn
  const sortDirection = (searchParams.get('dir') === 'desc' ? 'desc' : searchParams.get('dir') === 'asc' ? 'asc' : defaultDirection) as 'asc' | 'desc'

  const handleSort = useCallback((column: string) => {
    pushParamsWithPageReset(router, pathname, searchParams, params => {
      if (column === sortColumn) {
        params.set('dir', sortDirection === 'asc' ? 'desc' : 'asc')
      } else {
        params.set('sort', column)
        params.set('dir', 'asc')
      }
    })
  }, [router, searchParams, pathname, sortColumn, sortDirection])

  return { sortColumn, sortDirection, handleSort }
}
