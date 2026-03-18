'use client'

import { usePathname } from 'next/navigation'

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
  const pageTitle = pageTitles[pathname] || ''

  return (
    <header className="flex h-14 items-center justify-between border-b border-zinc-200 bg-white px-4">
      {/* Left: Page title */}
      <div className="flex items-center">
        {/* Spacer for mobile hamburger button */}
        <div className="w-10 md:hidden" />
        <h1 className="text-lg font-semibold text-zinc-800">
          {pageTitle}
        </h1>
      </div>

      {/* Right: page-specific actions injected via HeaderPortal */}
      <div id="header-actions" className="flex items-center gap-2" />
    </header>
  )
}
