'use client'

import { useRouter, useSearchParams, usePathname } from 'next/navigation'
import { paginationBtn, paginationBtnEnabled, paginationBtnDisabled, paginationBtnActive } from '@/lib/styles'

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

  return (
    <div className="flex items-center justify-between border-t border-edge px-3 py-3">
      <span className="text-xs text-muted">
        Showing {from}–{to} of {totalCount}
      </span>
      <div className="flex items-center gap-1">
        <button
          onClick={() => goTo(page - 1)}
          disabled={page <= 1}
          className={`${paginationBtn} ${page <= 1 ? paginationBtnDisabled : paginationBtnEnabled}`}
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
              className={`${paginationBtn} ${p === page ? paginationBtnActive : paginationBtnEnabled}`}
            >
              {p}
            </button>
          )
        )}
        <button
          onClick={() => goTo(page + 1)}
          disabled={page >= totalPages}
          className={`${paginationBtn} ${page >= totalPages ? paginationBtnDisabled : paginationBtnEnabled}`}
        >
          ›
        </button>
      </div>
    </div>
  )
}
