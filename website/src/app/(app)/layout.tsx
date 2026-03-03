import { getPartnerName } from '@/lib/auth'
import { Sidebar } from '@/components/sidebar'
import { Header } from '@/components/header'

export default async function AppLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const partnerName = await getPartnerName()

  return (
    <div className="flex h-screen">
      <Sidebar />
      <div className="flex flex-1 flex-col overflow-hidden">
        <Header partnerName={partnerName} />
        <main className="flex-1 overflow-auto bg-zinc-50 p-6">
          {children}
        </main>
      </div>
    </div>
  )
}
