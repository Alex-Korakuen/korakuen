'use client'

import { useEffect, useCallback } from 'react'

type SlideOverProps = {
  isOpen: boolean
  onClose: () => void
  title: string
  subtitle?: React.ReactNode
  actions?: React.ReactNode
  onPrev?: () => void
  onNext?: () => void
  children: React.ReactNode
}

export function SlideOver({
  isOpen,
  onClose,
  title,
  subtitle,
  actions,
  onPrev,
  onNext,
  children,
}: SlideOverProps) {
  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    },
    [onClose]
  )

  useEffect(() => {
    if (isOpen) {
      document.addEventListener('keydown', handleKeyDown)
      document.body.style.overflow = 'hidden'
    }
    return () => {
      document.removeEventListener('keydown', handleKeyDown)
      document.body.style.overflow = ''
    }
  }, [isOpen, handleKeyDown])

  if (!isOpen) return null

  return (
    <div
      className="fixed inset-0 z-50 flex justify-end bg-black/30"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-labelledby="slide-over-title"
    >
      <div
        className="relative flex h-full w-full max-w-2xl flex-col bg-white shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between border-b border-zinc-200 px-6 py-3">
          <div className="flex items-center gap-2">
            {/* Prev / Next navigation */}
            {(onPrev || onNext) && (
              <div className="mr-1 flex gap-1">
                <button
                  type="button"
                  onClick={onPrev}
                  disabled={!onPrev}
                  className="rounded border border-zinc-300 p-1 text-zinc-500 transition-colors hover:bg-zinc-50 disabled:opacity-30"
                  aria-label="Previous"
                >
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <polyline points="15 18 9 12 15 6" />
                  </svg>
                </button>
                <button
                  type="button"
                  onClick={onNext}
                  disabled={!onNext}
                  className="rounded border border-zinc-300 p-1 text-zinc-500 transition-colors hover:bg-zinc-50 disabled:opacity-30"
                  aria-label="Next"
                >
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <polyline points="9 18 15 12 9 6" />
                  </svg>
                </button>
              </div>
            )}
            <div>
              <h2 id="slide-over-title" className="text-base font-semibold text-zinc-900">{title}</h2>
              {subtitle && <div className="mt-0.5">{subtitle}</div>}
            </div>
          </div>

          <div className="flex items-center gap-2">
            {actions}
            <button
              type="button"
              onClick={onClose}
              className="rounded p-1 text-zinc-400 transition-colors hover:bg-zinc-100 hover:text-zinc-600"
              aria-label="Close"
            >
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <line x1="18" y1="6" x2="6" y2="18" />
                <line x1="6" y1="6" x2="18" y2="18" />
              </svg>
            </button>
          </div>
        </div>

        {/* Scrollable content */}
        <div className="flex-1 overflow-y-auto px-6 py-4">{children}</div>
      </div>
    </div>
  )
}
