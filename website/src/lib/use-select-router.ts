'use client'

import { useRouter } from 'next/navigation'
import { useCallback } from 'react'

export function useSelectRouter(basePath: string) {
  const router = useRouter()
  return useCallback(
    (id: string | null) => {
      router.push(id ? `${basePath}?selected=${id}` : basePath)
    },
    [router, basePath]
  )
}
