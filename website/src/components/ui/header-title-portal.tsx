'use client'

import { Portal } from './portal'

/**
 * Renders children into the #header-title-portal container in the Header component.
 * Use this to inject breadcrumbs or custom titles into the left side of the header.
 */
export function HeaderTitlePortal({ children }: { children: React.ReactNode }) {
  return <Portal containerId="header-title-portal">{children}</Portal>
}
