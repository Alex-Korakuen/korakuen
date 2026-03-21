'use client'

import { usePathname } from 'next/navigation'
import { useSidebar } from '@/lib/sidebar-context'

const pageTitles: Record<string, string> = {
  '/projects': 'Projects',
  '/entities': 'Entities',
  '/prices': 'Prices',
  '/invoices': 'Invoices',
  '/payments': 'Payments',
  '/calendar': 'Calendar',
  '/financial-position': 'Financial Position',
  '/settings/password': 'Change Password',
}

export function Header() {
  const pathname = usePathname()
  const { collapsed, toggleSidebar } = useSidebar()
  const pageTitle = pageTitles[pathname] || ''

  return (
    <header className="flex h-14 items-center justify-between border-b border-edge bg-white px-4">
      {/* Left: expand toggle (when collapsed) + Page title */}
      <div className="flex items-center gap-2">
        {/* Spacer for mobile hamburger button */}
        <div className="w-10 md:hidden" />
        {collapsed && (
          <button
            onClick={toggleSidebar}
            className="hidden rounded-md p-1 text-faint transition-colors hover:bg-surface hover:text-muted md:block"
            aria-label="Expand sidebar"
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
              <polyline points="5 3 10 8 5 13" />
            </svg>
          </button>
        )}
        <h1 className="text-lg font-semibold text-ink">
          {pageTitle}
        </h1>
        {/* Left-side portal: pages can inject breadcrumbs or custom titles */}
        <div id="header-title-portal" className="flex items-center gap-2" />
      </div>

      {/* Right: page-specific actions injected via HeaderPortal */}
      <div id="header-actions" className="flex items-center gap-2" />
    </header>
  )
}
