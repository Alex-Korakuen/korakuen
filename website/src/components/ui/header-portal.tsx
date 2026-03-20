'use client'

import { Portal } from './portal'

/**
 * Renders children into the #header-actions container in the Header component.
 * Use this to inject page-specific action buttons into the shared header bar.
 */
export function HeaderPortal({ children }: { children: React.ReactNode }) {
  return <Portal containerId="header-actions">{children}</Portal>
}
