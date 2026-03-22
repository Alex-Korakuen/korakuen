'use client'

import { useRouter, useSearchParams, usePathname } from 'next/navigation'

type Props = {
  page: number
  totalCount: number
  pageSize: number
}

export function Pagination({ page, totalCount, pageSize }: Props) {
  const router = useRouter()
  const searchParams = useSearchParams()
  const pathname = usePathname()

  const totalPages = Math.max(1, Math.ceil(totalCount / pageSize))
  if (totalCount <= pageSize) return null

  const from = (page - 1) * pageSize + 1
  const to = Math.min(page * pageSize, totalCount)

  function goTo(p: number) {
    const params = new URLSearchParams(searchParams.toString())
    if (p <= 1) {
      params.delete('page')
    } else {
      params.set('page', String(p))
    }
    router.push(`${pathname}?${params.toString()}`)
  }

  // Build page numbers: show first, last, and neighbors of current
  const pages: (number | 'ellipsis')[] = []
  for (let i = 1; i <= totalPages; i++) {
    if (i === 1 || i === totalPages || (i >= page - 1 && i <= page + 1)) {
      pages.push(i)
    } else if (pages[pages.length - 1] !== 'ellipsis') {
      pages.push('ellipsis')
    }
  }

  const btnBase = 'rounded border px-2.5 py-1 text-sm'
  const btnEnabled = 'border-edge bg-white text-ink hover:bg-surface'
  const btnDisabled = 'border-edge bg-surface text-edge-strong cursor-default'
  const btnActive = 'border-accent bg-accent-bg text-accent font-medium'

  return (
    <div className="flex items-center justify-between border-t border-edge px-3 py-3">
      <span className="text-xs text-muted">
        Showing {from}–{to} of {totalCount}
      </span>
      <div className="flex items-center gap-1">
        <button
          onClick={() => goTo(page - 1)}
          disabled={page <= 1}
          className={`${btnBase} ${page <= 1 ? btnDisabled : btnEnabled}`}
        >
          ‹
        </button>
        {pages.map((p, i) =>
          p === 'ellipsis' ? (
            <span key={`e${i}`} className="px-1 text-sm text-faint">…</span>
          ) : (
            <button
              key={p}
              onClick={() => goTo(p)}
              className={`${btnBase} ${p === page ? btnActive : btnEnabled}`}
            >
              {p}
            </button>
          )
        )}
        <button
          onClick={() => goTo(page + 1)}
          disabled={page >= totalPages}
          className={`${btnBase} ${page >= totalPages ? btnDisabled : btnEnabled}`}
        >
          ›
        </button>
      </div>
    </div>
  )
}
