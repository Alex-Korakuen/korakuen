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
  const btnEnabled = 'border-zinc-300 bg-white text-zinc-700 hover:bg-zinc-50'
  const btnDisabled = 'border-zinc-200 bg-zinc-50 text-zinc-300 cursor-default'
  const btnActive = 'border-blue-500 bg-blue-50 text-blue-700 font-medium'

  return (
    <div className="flex items-center justify-between border-t border-zinc-200 px-2 pt-3">
      <span className="text-xs text-zinc-500">
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
            <span key={`e${i}`} className="px-1 text-sm text-zinc-400">…</span>
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
