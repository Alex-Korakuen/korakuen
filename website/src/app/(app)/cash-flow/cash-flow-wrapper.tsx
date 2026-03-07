'use client'

import { useRouter } from 'next/navigation'
import { useCallback } from 'react'
import { CashFlowClient } from './cash-flow-client'
import type { CashFlowData } from '@/lib/types'

type Props = {
  initialData: CashFlowData
  projects: { id: string; project_code: string; name: string }[]
  year: number
  projectId: string | null
  exchangeRate: { mid_rate: number; rate_date: string } | null
}

export function CashFlowWrapper({
  initialData,
  projects,
  year,
  projectId,
  exchangeRate,
}: Props) {
  const router = useRouter()

  const handleParamsChange = useCallback(
    (newYear: number, newProjectId: string | null) => {
      const params = new URLSearchParams()
      if (newYear !== new Date().getFullYear()) params.set('year', String(newYear))
      if (newProjectId) params.set('project', newProjectId)
      const qs = params.toString()
      router.push(`/cash-flow${qs ? `?${qs}` : ''}`)
    },
    [router]
  )

  return (
    <CashFlowClient
      initialData={initialData}
      projects={projects}
      year={year}
      projectId={projectId}
      exchangeRate={exchangeRate}
      onParamsChange={handleParamsChange}
    />
  )
}
