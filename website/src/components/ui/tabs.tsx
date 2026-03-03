'use client'

type TabsProps = {
  tabs: { id: string; label: string }[]
  activeTab: string
  onTabChange: (tabId: string) => void
  children: React.ReactNode
}

export function Tabs({ tabs, activeTab, onTabChange, children }: TabsProps) {
  return (
    <div>
      <div className="border-b border-zinc-200">
        <nav className="-mb-px flex gap-6" aria-label="Tabs">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              type="button"
              onClick={() => onTabChange(tab.id)}
              className={`
                whitespace-nowrap border-b-2 px-1 py-3 text-sm font-medium transition-colors
                ${
                  activeTab === tab.id
                    ? 'border-zinc-900 text-zinc-900'
                    : 'border-transparent text-zinc-500 hover:border-zinc-300 hover:text-zinc-700'
                }
              `}
            >
              {tab.label}
            </button>
          ))}
        </nav>
      </div>
      <div className="pt-4">{children}</div>
    </div>
  )
}
