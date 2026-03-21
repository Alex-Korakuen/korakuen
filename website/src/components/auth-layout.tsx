import type { ReactNode } from 'react'

interface AuthLayoutProps {
  children: ReactNode
}

/** Centered card layout with KORAKUEN branding — used by login and set-password pages. */
export function AuthLayout({ children }: AuthLayoutProps) {
  return (
    <div className="flex min-h-screen items-center justify-center bg-surface">
      <div className="w-full max-w-sm">
        <div className="rounded-[10px] border border-edge bg-white px-8 py-10">
          <div className="mb-8 text-center">
            <h1 className="text-2xl font-bold tracking-widest text-ink">
              KORAKUEN
            </h1>
            <p className="mt-1 text-sm text-muted">Management System</p>
          </div>
          {children}
        </div>
      </div>
    </div>
  )
}
