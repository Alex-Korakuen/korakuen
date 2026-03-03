'use server'

import { getCostDetail, getLoanDetail } from '@/lib/queries'
import { createServerSupabaseClient } from '@/lib/supabase/server'

export async function fetchCostDetail(costId: string) {
  return getCostDetail(costId)
}

export async function fetchLoanDetailFromSchedule(
  lenderName: string,
  scheduledDate: string,
  scheduledAmount: number
) {
  // The v_ap_calendar doesn't expose loan_id directly.
  // We look up the loan_schedule row matching the given criteria to find the loan_id.
  const supabase = await createServerSupabaseClient()

  const { data: scheduleRow } = await supabase
    .from('loan_schedule')
    .select('loan_id, loans!fk_loan_schedule_loans(lender_name)')
    .eq('scheduled_date', scheduledDate)
    .eq('scheduled_amount', scheduledAmount)
    .eq('paid', false)
    .limit(1)
    .single()

  if (!scheduleRow?.loan_id) return null

  return getLoanDetail(scheduleRow.loan_id)
}
