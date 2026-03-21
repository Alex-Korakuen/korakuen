'use client'

import { useState, useRef, useCallback } from 'react'
import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { useSidebar } from '@/lib/sidebar-context'
import { useClickOutside } from '@/lib/use-click-outside'
import { createClient } from '@/lib/supabase/client'

interface NavItem {
  label: string
  href: string
  shortLabel: string
}

const browseItems: NavItem[] = [
  { label: 'Projects', href: '/projects', shortLabel: 'P' },
  { label: 'Entities', href: '/entities', shortLabel: 'E' },
  { label: 'Prices', href: '/prices', shortLabel: '$' },
  { label: 'Invoices', href: '/invoices', shortLabel: 'I' },
  { label: 'Payments', href: '/payments', shortLabel: 'Py' },
]

const dashboardItems: NavItem[] = [
  { label: 'Calendar', href: '/calendar', shortLabel: 'Cal' },
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
          ? 'bg-accent-bg font-medium text-accent'
          : 'text-muted hover:bg-surface hover:text-ink'
      } ${collapsed ? 'justify-center' : ''}`}
      title={collapsed ? item.label : undefined}
    >
      {collapsed ? (
        <span className="flex h-6 w-6 items-center justify-center rounded-full bg-surface text-xs font-medium text-muted">
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
        <h3 className="mb-2 px-3 text-[10px] font-medium uppercase tracking-[0.1em] text-faint">
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

function UserMenu({ collapsed, partnerName }: { collapsed: boolean; partnerName: string }) {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const menuRef = useRef<HTMLDivElement>(null)

  useClickOutside(menuRef, useCallback(() => setOpen(false), []))

  async function handleSignOut() {
    const supabase = createClient()
    await supabase.auth.signOut()
    router.push('/login')
    router.refresh()
  }

  const initials = partnerName
    .split(' ')
    .map((w) => w[0])
    .join('')
    .slice(0, 2)
    .toUpperCase()

  return (
    <div className="relative border-t border-edge p-2" ref={menuRef}>
      <button
        onClick={() => setOpen(!open)}
        className={`flex w-full items-center gap-2.5 rounded-md px-2 py-2 text-sm text-ink transition-colors hover:bg-surface ${collapsed ? 'justify-center' : ''}`}
      >
        <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-surface text-xs font-medium text-muted">
          {initials}
        </span>
        {!collapsed && <span className="truncate">{partnerName}</span>}
      </button>

      {open && (
        <div className={`absolute z-50 w-48 rounded-md border border-edge bg-white py-1 shadow-lg ${
          collapsed ? 'bottom-0 left-full ml-1' : 'bottom-full left-2 right-2 mb-1 w-auto'
        }`}>
          <Link
            href="/settings/password"
            className="block px-4 py-2 text-sm text-ink hover:bg-surface"
            onClick={() => setOpen(false)}
          >
            Change Password
          </Link>
          <button
            onClick={handleSignOut}
            className="block w-full px-4 py-2 text-left text-sm text-ink hover:bg-surface"
          >
            Sign Out
          </button>
        </div>
      )}
    </div>
  )
}

interface SidebarProps {
  partnerName: string
}

export function Sidebar({ partnerName }: SidebarProps) {
  const pathname = usePathname()
  const { collapsed, toggleSidebar } = useSidebar()
  const [mobileOpen, setMobileOpen] = useState(false)

  return (
    <>
      {/* Mobile hamburger button */}
      <button
        onClick={() => setMobileOpen(true)}
        className="fixed left-4 top-4 z-50 rounded-md border border-edge bg-white p-2 shadow-sm md:hidden"
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
        className={`fixed inset-y-0 left-0 z-40 flex flex-col border-r border-edge bg-white transition-all duration-200 md:relative md:translate-x-0 ${
          mobileOpen ? 'translate-x-0' : '-translate-x-full'
        } ${collapsed ? 'w-[var(--sidebar-collapsed-width)]' : 'w-[var(--sidebar-width)]'}`}
      >
        {/* Sidebar header */}
        <div className="flex h-14 items-center justify-between border-b border-edge px-4">
          <span className="text-lg font-bold tracking-widest text-ink">
            {collapsed ? 'K' : 'KORAKUEN'}
          </span>
          <div className="flex items-center gap-1">
            {/* Collapse toggle (desktop only, visible when expanded) */}
            {!collapsed && (
              <button
                onClick={toggleSidebar}
                className="hidden rounded-md p-1 text-faint transition-colors hover:bg-surface hover:text-muted md:block"
                aria-label="Collapse sidebar"
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
                >
                  <polyline points="10 3 5 8 10 13" />
                </svg>
              </button>
            )}
            {/* Mobile close button */}
            <button
              onClick={() => setMobileOpen(false)}
              className="rounded-md p-1 text-faint hover:text-muted md:hidden"
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
        </div>

        {/* Navigation */}
        <div className="flex-1 overflow-y-auto px-2 py-4">
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

        {/* User menu */}
        <UserMenu collapsed={collapsed} partnerName={partnerName} />
      </aside>
    </>
  )
}
