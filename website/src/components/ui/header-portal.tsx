'use client'

import { useState, useEffect } from 'react'
import { createPortal } from 'react-dom'

/**
 * Renders children into the #header-actions container in the Header component.
 * Use this to inject page-specific action buttons into the shared header bar.
 */
export function HeaderPortal({ children }: { children: React.ReactNode }) {
  const [container, setContainer] = useState<HTMLElement | null>(null)

  useEffect(() => {
    setContainer(document.getElementById('header-actions'))
  }, [])

  if (!container) return null
  return createPortal(children, container)
}
