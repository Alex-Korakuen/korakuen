'use server'

import { getCostDetail, getLoanDetail, getLoanIdFromSchedule } from '@/lib/queries'

export async function fetchCostDetail(costId: string) {
  return getCostDetail(costId)
}

export async function fetchLoanDetailFromSchedule(
  lenderName: string,
  scheduledDate: string,
  scheduledAmount: number
) {
  const loanId = await getLoanIdFromSchedule(scheduledDate, scheduledAmount)
  if (!loanId) return null
  return getLoanDetail(loanId)
}
