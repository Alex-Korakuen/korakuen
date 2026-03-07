import { getPartnerName } from '@/lib/auth'
import { getPartnerCompaniesForFilter } from '@/lib/queries'
import { getPartnerFilter } from '@/lib/partner-filter-server'
import { Sidebar } from '@/components/sidebar'
import { Header } from '@/components/header'
import { PartnerFilterProvider } from '@/lib/partner-filter-context'

export default async function AppLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const [partnerName, partners, initialSelection] = await Promise.all([
    getPartnerName(),
    getPartnerCompaniesForFilter(),
    getPartnerFilter(),
  ])

  return (
    <PartnerFilterProvider partners={partners} initialSelection={initialSelection}>
      <div className="flex h-screen">
        <Sidebar />
        <div className="flex flex-1 flex-col overflow-hidden">
          <Header partnerName={partnerName} />
          <main className="flex-1 overflow-auto bg-zinc-50 p-6">
            {children}
          </main>
        </div>
      </div>
    </PartnerFilterProvider>
  )
}
