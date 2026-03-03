import { isCompanyView } from '@/lib/auth'
import { getFinancialPosition } from '@/lib/queries'
import { FPClient } from './fp-client'

export default async function FinancialPositionPage() {
  const isAlex = await isCompanyView()
  const data = await getFinancialPosition(isAlex)

  return <FPClient data={data} isAlex={isAlex} />
}
