import type { ReactNode } from 'react'

interface AuthLayoutProps {
  children: ReactNode
}

/** Centered card layout with KORAKUEN branding — used by login and set-password pages. */
export function AuthLayout({ children }: AuthLayoutProps) {
  return (
    <div className="flex min-h-screen items-center justify-center bg-zinc-50">
      <div className="w-full max-w-sm">
        <div className="rounded-lg border border-zinc-200 bg-white px-8 py-10 shadow-sm">
          <div className="mb-8 text-center">
            <h1 className="text-2xl font-bold tracking-widest text-zinc-900">
              KORAKUEN
            </h1>
            <p className="mt-1 text-sm text-zinc-500">Management System</p>
          </div>
          {children}
        </div>
      </div>
    </div>
  )
}
