'use client'

import { useRouter } from 'next/navigation'
import { useCallback } from 'react'
import { CashFlowClient } from './cash-flow-client'
import type { CashFlowData, Currency } from '@/lib/types'

type Props = {
  initialData: CashFlowData
  projects: { id: string; project_code: string; name: string }[]
  isAlex: boolean
  year: number
  projectId: string | null
  currency: Currency
}

export function CashFlowWrapper({
  initialData,
  projects,
  isAlex,
  year,
  projectId,
  currency,
}: Props) {
  const router = useRouter()

  const handleParamsChange = useCallback(
    (newYear: number, newProjectId: string | null, newCurrency: Currency) => {
      const params = new URLSearchParams()
      if (newYear !== new Date().getFullYear()) params.set('year', String(newYear))
      if (newProjectId) params.set('project', newProjectId)
      if (newCurrency !== 'PEN') params.set('currency', newCurrency)
      const qs = params.toString()
      router.push(`/cash-flow${qs ? `?${qs}` : ''}`)
    },
    [router]
  )

  return (
    <CashFlowClient
      initialData={initialData}
      projects={projects}
      isAlex={isAlex}
      year={year}
      projectId={projectId}
      currency={currency}
      onParamsChange={handleParamsChange}
    />
  )
}
