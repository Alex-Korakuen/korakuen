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
      <div className="flex gap-1 border-b border-zinc-200 px-4">
        {tabs.map(t => (
          <button
            key={t.key}
            onClick={() => setActiveTab(t.key)}
            className={`px-3 py-2 text-sm font-medium transition-colors ${
              t.key === active?.key
                ? 'border-b-2 border-blue-600 text-blue-600'
                : 'text-zinc-500 hover:text-zinc-700'
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
