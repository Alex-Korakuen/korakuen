'use server'

import { getCostDetail, getLoanDetail, getLoanIdFromSchedule, getArInvoiceDetail, getPartnerCostDetails, getBankTransactions } from '@/lib/queries'
import type { PartnerCostDetail, BankTransaction } from '@/lib/types'

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

export async function fetchArInvoiceDetail(arInvoiceId: string) {
  return getArInvoiceDetail(arInvoiceId)
}

export async function fetchPartnerCosts(
  projectId: string,
  partnerCompanyId: string,
): Promise<PartnerCostDetail[]> {
  return getPartnerCostDetails(projectId, partnerCompanyId)
}

export async function fetchBankTransactions(
  bankAccountId: string
): Promise<BankTransaction[]> {
  return getBankTransactions(bankAccountId)
}
