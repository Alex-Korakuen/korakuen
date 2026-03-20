'use client'

import { useState, useEffect } from 'react'
import { createPortal } from 'react-dom'

/** Base portal that renders children into a DOM element identified by containerId. */
export function Portal({ containerId, children }: { containerId: string; children: React.ReactNode }) {
  const [container, setContainer] = useState<HTMLElement | null>(null)

  useEffect(() => {
    setContainer(document.getElementById(containerId))
  }, [containerId])

  if (!container) return null
  return createPortal(children, container)
}
