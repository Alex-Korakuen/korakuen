'use client'

import {
  paginationBtn,
  paginationBtnEnabled,
  paginationBtnDisabled,
  paginationBtnActive,
} from '@/lib/styles'

type Props = {
  page: number
  totalCount: number
  pageSize: number
  onPageChange: (p: number) => void
}

/** Client-state pagination — sibling of `Pagination` but driven by a callback
 *  instead of URL search params. Use for tables with local search/filter state. */
export function LocalPagination({ page, totalCount, pageSize, onPageChange }: Props) {
  const totalPages = Math.max(1, Math.ceil(totalCount / pageSize))
  if (totalCount <= pageSize) return null

  const from = (page - 1) * pageSize + 1
  const to = Math.min(page * pageSize, totalCount)

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
    <div className="flex items-center justify-between border-t border-edge px-4 py-2">
      <span className="text-xs text-muted">
        {from}–{to} of {totalCount}
      </span>
      <div className="flex items-center gap-1">
        <button
          onClick={() => onPageChange(Math.max(1, page - 1))}
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
              onClick={() => onPageChange(p)}
              className={`${paginationBtn} ${p === page ? paginationBtnActive : paginationBtnEnabled}`}
            >
              {p}
            </button>
          )
        )}
        <button
          onClick={() => onPageChange(Math.min(totalPages, page + 1))}
          disabled={page >= totalPages}
          className={`${paginationBtn} ${page >= totalPages ? paginationBtnDisabled : paginationBtnEnabled}`}
        >
          ›
        </button>
      </div>
    </div>
  )
}
