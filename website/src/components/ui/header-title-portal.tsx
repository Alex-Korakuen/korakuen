'use client'

import { useState, useEffect } from 'react'
import { createPortal } from 'react-dom'

/**
 * Renders children into the #header-title-portal container in the Header component.
 * Use this to inject breadcrumbs or custom titles into the left side of the header.
 */
export function HeaderTitlePortal({ children }: { children: React.ReactNode }) {
  const [container, setContainer] = useState<HTMLElement | null>(null)

  useEffect(() => {
    setContainer(document.getElementById('header-title-portal'))
  }, [])

  if (!container) return null
  return createPortal(children, container)
}
