'use client'

import { useEffect, useCallback, useRef } from 'react'

type ModalProps = {
  isOpen: boolean
  onClose: () => void
  title: string
  /** Optional content rendered to the right of the title, before the close button */
  headerRight?: React.ReactNode
  /** Optional content rendered to the left of the title */
  headerLeft?: React.ReactNode
  children: React.ReactNode
}

export function Modal({ isOpen, onClose, title, headerLeft, headerRight, children }: ModalProps) {
  const previousFocusRef = useRef<HTMLElement | null>(null)
  const contentRef = useRef<HTMLDivElement>(null)

  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    },
    [onClose]
  )

  // Focus first element only when modal opens
  useEffect(() => {
    if (isOpen) {
      previousFocusRef.current = document.activeElement as HTMLElement | null
      document.body.style.overflow = 'hidden'
      requestAnimationFrame(() => {
        const focusable = contentRef.current?.querySelector<HTMLElement>(
          'input:not([disabled]), select:not([disabled]), textarea:not([disabled]), button:not([disabled])'
        )
        focusable?.focus()
      })
    }
    return () => {
      document.body.style.overflow = ''
      if (!isOpen) previousFocusRef.current?.focus()
    }
  }, [isOpen])

  // Escape key handler — separate effect so it doesn't re-trigger focus
  useEffect(() => {
    if (isOpen) {
      document.addEventListener('keydown', handleKeyDown)
      return () => document.removeEventListener('keydown', handleKeyDown)
    }
  }, [isOpen, handleKeyDown])

  if (!isOpen) return null

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-labelledby="modal-title"
    >
      <div
        className="relative mx-4 flex max-h-[85vh] w-full max-w-2xl flex-col rounded-[10px] bg-white shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between border-b border-edge px-6 py-4">
          <div className="flex items-center gap-2.5">
            {headerLeft}
            <h2 id="modal-title" className="text-lg font-semibold text-ink">{title}</h2>
          </div>
          <div className="flex items-center gap-3">
            {headerRight}
          <button
            type="button"
            onClick={onClose}
            className="rounded p-1 text-faint transition-colors hover:bg-surface hover:text-muted"
            aria-label="Close"
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              width="20"
              height="20"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <line x1="18" y1="6" x2="6" y2="18" />
              <line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
          </div>
        </div>

        {/* Scrollable content */}
        <div ref={contentRef} className="overflow-y-auto px-6 py-4">{children}</div>
      </div>
    </div>
  )
}
