import { getPartnerName } from '@/lib/auth'
import { getPartnerCompanies } from '@/lib/queries'
import { getPartnerFilter } from '@/lib/partner-filter-server'
import { Sidebar } from '@/components/sidebar'
import { Header } from '@/components/header'
import { PartnerFilterProvider } from '@/lib/partner-filter-context'
import { SidebarProvider } from '@/lib/sidebar-context'

export default async function AppLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const [partnerName, partners, initialSelection] = await Promise.all([
    getPartnerName(),
    getPartnerCompanies(),
    getPartnerFilter(),
  ])

  return (
    <PartnerFilterProvider partners={partners} initialSelection={initialSelection}>
      <SidebarProvider>
        <div className="flex h-screen">
          <Sidebar partnerName={partnerName} />
          <div className="flex flex-1 flex-col overflow-hidden">
            <Header />
            <main className="flex-1 overflow-auto bg-surface p-6">
              {children}
            </main>
          </div>
        </div>
      </SidebarProvider>
    </PartnerFilterProvider>
  )
}
