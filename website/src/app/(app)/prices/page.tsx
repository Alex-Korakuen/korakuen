import { getPriceHistory, getPriceFilterOptions } from '@/lib/queries'
import { PricesClient } from './prices-client'

export default async function PricesPage() {
  const [data, filterOptions] = await Promise.all([
    getPriceHistory(),
    getPriceFilterOptions(),
  ])

  return <PricesClient data={data} filterOptions={filterOptions} />
}
