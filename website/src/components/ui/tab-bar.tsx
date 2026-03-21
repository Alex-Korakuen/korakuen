'use client'

import { useState } from 'react'

export type Tab = {
  key: string
  label: string
  content: React.ReactNode
}

type Props = {
  tabs: Tab[]
  defaultTab?: string
}

export function TabBar({ tabs, defaultTab }: Props) {
  const [activeTab, setActiveTab] = useState(defaultTab ?? tabs[0]?.key ?? '')
  const active = tabs.find(t => t.key === activeTab) ?? tabs[0]

  return (
    <div>
      <div className="flex gap-1 border-b border-edge px-4">
        {tabs.map(t => (
          <button
            key={t.key}
            onClick={() => setActiveTab(t.key)}
            className={`px-3 py-2 text-sm font-medium transition-colors ${
              t.key === active?.key
                ? 'border-b-2 border-accent text-accent'
                : 'text-faint hover:text-ink'
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>
      {active && <div>{active.content}</div>}
    </div>
  )
}
