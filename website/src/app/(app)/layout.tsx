import { getPartnerName } from '@/lib/auth'
import { Sidebar } from '@/components/sidebar'
import { Header } from '@/components/header'
import { SidebarProvider } from '@/lib/sidebar-context'

export default async function AppLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const partnerName = await getPartnerName()

  return (
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
  )
}
