'use client'

import { useState } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { usePartnerFilter } from '@/lib/partner-filter-context'

interface NavItem {
  label: string
  href: string
  shortLabel: string
}

const browseItems: NavItem[] = [
  { label: 'Projects', href: '/projects', shortLabel: 'P' },
  { label: 'Entities', href: '/entities', shortLabel: 'E' },
  { label: 'Prices', href: '/prices', shortLabel: '$' },
]

const dashboardItems: NavItem[] = [
  { label: 'AP Calendar', href: '/ap-calendar', shortLabel: 'AP' },
  { label: 'AR Outstanding', href: '/ar-outstanding', shortLabel: 'AR' },
  { label: 'Cash Flow', href: '/cash-flow', shortLabel: 'CF' },
  { label: 'Partner Balances', href: '/partner-balances', shortLabel: 'PB' },
  { label: 'Financial Pos.', href: '/financial-position', shortLabel: 'FP' },
]

function NavLink({
  item,
  isActive,
  collapsed,
}: {
  item: NavItem
  isActive: boolean
  collapsed: boolean
}) {
  return (
    <Link
      href={item.href}
      className={`flex items-center rounded-md px-3 py-2 text-sm transition-colors ${
        isActive
          ? 'bg-zinc-100 font-semibold text-zinc-900'
          : 'text-zinc-600 hover:bg-zinc-50 hover:text-zinc-900'
      } ${collapsed ? 'justify-center' : ''}`}
      title={collapsed ? item.label : undefined}
    >
      {collapsed ? (
        <span className="flex h-6 w-6 items-center justify-center rounded-full bg-zinc-100 text-xs font-medium text-zinc-600">
          {item.shortLabel}
        </span>
      ) : (
        item.label
      )}
    </Link>
  )
}

function NavSection({
  title,
  items,
  pathname,
  collapsed,
}: {
  title: string
  items: NavItem[]
  pathname: string
  collapsed: boolean
}) {
  return (
    <div className="mb-6">
      {!collapsed && (
        <h3 className="mb-2 px-3 text-xs font-medium uppercase tracking-wider text-zinc-400">
          {title}
        </h3>
      )}
      <nav className="flex flex-col gap-0.5">
        {items.map((item) => (
          <NavLink
            key={item.href}
            item={item}
            isActive={pathname === item.href}
            collapsed={collapsed}
          />
        ))}
      </nav>
    </div>
  )
}

function PartnerFilter({ collapsed }: { collapsed: boolean }) {
  const { partners, selectedPartnerIds, togglePartner, clearFilter, applyFilter, isFiltered, isDirty } = usePartnerFilter()

  if (collapsed) {
    return (
      <div className="mb-6">
        <div className="flex flex-col gap-1 px-2">
          {partners.map((p) => {
            const selected = selectedPartnerIds.length === 0 || selectedPartnerIds.includes(p.id)
            return (
              <button
                key={p.id}
                onClick={() => togglePartner(p.id)}
                className={`flex h-6 w-full items-center justify-center rounded text-xs font-medium transition-colors ${
                  selected
                    ? 'bg-zinc-800 text-white'
                    : 'bg-zinc-100 text-zinc-400'
                }`}
                title={p.name}
              >
                {p.name.charAt(0)}
              </button>
            )
          })}
        </div>
      </div>
    )
  }

  return (
    <div className="mb-6">
      <div className="mb-2 flex items-center justify-between px-3">
        <h3 className="text-xs font-medium uppercase tracking-wider text-zinc-400">
          Partners
        </h3>
        {isFiltered && (
          <button
            onClick={clearFilter}
            className="text-xs text-zinc-400 hover:text-zinc-600"
          >
            All
          </button>
        )}
      </div>
      <div className="flex flex-col gap-1 px-2">
        {partners.map((p) => {
          const selected = selectedPartnerIds.length === 0 || selectedPartnerIds.includes(p.id)
          return (
            <button
              key={p.id}
              onClick={() => togglePartner(p.id)}
              className={`rounded-md px-3 py-1.5 text-left text-sm transition-colors ${
                selected
                  ? 'bg-zinc-100 font-medium text-zinc-900'
                  : 'text-zinc-400 hover:text-zinc-600'
              }`}
            >
              {p.name}
            </button>
          )
        })}
        {isDirty && (
          <button
            onClick={applyFilter}
            className="mt-1 rounded-md bg-zinc-800 px-3 py-1.5 text-sm font-medium text-white transition-colors hover:bg-zinc-700"
          >
            Apply
          </button>
        )}
      </div>
    </div>
  )
}

export function Sidebar() {
  const pathname = usePathname()
  const [collapsed, setCollapsed] = useState(false)
  const [mobileOpen, setMobileOpen] = useState(false)

  return (
    <>
      {/* Mobile hamburger button */}
      <button
        onClick={() => setMobileOpen(true)}
        className="fixed left-4 top-4 z-50 rounded-md border border-zinc-200 bg-white p-2 shadow-sm md:hidden"
        aria-label="Open navigation"
      >
        <svg
          width="20"
          height="20"
          viewBox="0 0 20 20"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
        >
          <line x1="3" y1="5" x2="17" y2="5" />
          <line x1="3" y1="10" x2="17" y2="10" />
          <line x1="3" y1="15" x2="17" y2="15" />
        </svg>
      </button>

      {/* Mobile overlay */}
      {mobileOpen && (
        <div
          className="fixed inset-0 z-40 bg-black/20 md:hidden"
          onClick={() => setMobileOpen(false)}
        />
      )}

      {/* Sidebar */}
      <aside
        aria-label="Main navigation"
        className={`fixed inset-y-0 left-0 z-40 flex flex-col border-r border-zinc-200 bg-white transition-all duration-200 md:relative md:translate-x-0 ${
          mobileOpen ? 'translate-x-0' : '-translate-x-full'
        } ${collapsed ? 'w-[var(--sidebar-collapsed-width)]' : 'w-[var(--sidebar-width)]'}`}
      >
        {/* Sidebar header */}
        <div className="flex h-14 items-center justify-between border-b border-zinc-200 px-4">
          <span className="text-lg font-bold tracking-widest text-zinc-800">
            {collapsed ? 'K' : 'KORAKUEN'}
          </span>
          {/* Mobile close button */}
          <button
            onClick={() => setMobileOpen(false)}
            className="rounded-md p-1 text-zinc-400 hover:text-zinc-600 md:hidden"
            aria-label="Close navigation"
          >
            <svg
              width="18"
              height="18"
              viewBox="0 0 18 18"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
            >
              <line x1="4" y1="4" x2="14" y2="14" />
              <line x1="14" y1="4" x2="4" y2="14" />
            </svg>
          </button>
        </div>

        {/* Navigation */}
        <div className="flex-1 overflow-y-auto px-2 py-4">
          <PartnerFilter collapsed={collapsed} />
          <NavSection
            title="Browse"
            items={browseItems}
            pathname={pathname}
            collapsed={collapsed}
          />
          <NavSection
            title="Dashboards"
            items={dashboardItems}
            pathname={pathname}
            collapsed={collapsed}
          />
        </div>

        {/* Collapse toggle (desktop only) */}
        <div className="hidden border-t border-zinc-200 p-2 md:block">
          <button
            onClick={() => setCollapsed(!collapsed)}
            className="flex w-full items-center justify-center rounded-md p-2 text-zinc-400 transition-colors hover:bg-zinc-50 hover:text-zinc-600"
            aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
            aria-expanded={!collapsed}
          >
            <svg
              width="16"
              height="16"
              viewBox="0 0 16 16"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              className={`transition-transform ${collapsed ? 'rotate-180' : ''}`}
            >
              <polyline points="10 3 5 8 10 13" />
            </svg>
          </button>
        </div>
      </aside>
    </>
  )
}
