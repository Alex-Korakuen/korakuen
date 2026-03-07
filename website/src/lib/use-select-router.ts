'use client'

import { useRouter, useSearchParams } from 'next/navigation'
import { useCallback } from 'react'

export function useSelectRouter(basePath: string) {
  const router = useRouter()
  const searchParams = useSearchParams()
  return useCallback(
    (id: string | null) => {
      const params = new URLSearchParams(searchParams.toString())
      if (id) {
        params.set('selected', id)
      } else {
        params.delete('selected')
      }
      const qs = params.toString()
      router.push(qs ? `${basePath}?${qs}` : basePath)
    },
    [router, basePath, searchParams]
  )
}
