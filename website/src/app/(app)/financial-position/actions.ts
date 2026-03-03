'use server'

import { getBankTransactions } from '@/lib/queries'
import type { BankTransaction } from '@/lib/types'

export async function fetchBankTransactions(
  bankAccountId: string
): Promise<BankTransaction[]> {
  return getBankTransactions(bankAccountId)
}
