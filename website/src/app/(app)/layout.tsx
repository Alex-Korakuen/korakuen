import { getPartnerName, isAdmin } from '@/lib/auth'
import { Sidebar } from '@/components/sidebar'
import { Header } from '@/components/header'
import { SidebarProvider } from '@/lib/sidebar-context'
import { AuthProvider } from '@/lib/auth-context'

export default async function AppLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const [partnerName, admin] = await Promise.all([
    getPartnerName(),
    isAdmin(),
  ])

  return (
    <AuthProvider isAdmin={admin} partnerName={partnerName}>
      <SidebarProvider>
        <div className="flex h-screen">
          <Sidebar />
          <div className="flex flex-1 flex-col overflow-hidden">
            <Header />
            <main className="flex-1 overflow-auto bg-surface p-6">
              {children}
            </main>
          </div>
        </div>
      </SidebarProvider>
    </AuthProvider>
  )
}
