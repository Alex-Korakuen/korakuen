import Link from 'next/link'

type Props = {
  backHref: string
  backLabel: string
  title: string
  children?: React.ReactNode
}

/** Back-link chevron + separator + current-page title, rendered inside HeaderTitlePortal
 *  on detail pages. Optional `children` render after the title (e.g. status badges). */
export function DetailBreadcrumb({ backHref, backLabel, title, children }: Props) {
  return (
    <>
      <Link
        href={backHref}
        className="flex items-center gap-1 rounded px-2 py-1 text-sm text-muted transition-colors hover:bg-surface hover:text-ink"
      >
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <polyline points="15,18 9,12 15,6" />
        </svg>
        {backLabel}
      </Link>
      <div className="h-4 w-px bg-edge" />
      <span className="text-sm text-muted truncate">{title}</span>
      {children}
    </>
  )
}
