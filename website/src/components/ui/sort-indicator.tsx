'use client'

type SortIndicatorProps<T extends string> = {
  column: T
  sortColumn: T
  sortDirection: 'asc' | 'desc'
}

export function SortIndicator<T extends string>({
  column,
  sortColumn,
  sortDirection,
}: SortIndicatorProps<T>) {
  if (sortColumn !== column) {
    return <span className="ml-1 text-faint">&#x2195;</span>
  }
  return (
    <span className="ml-1">
      {sortDirection === 'asc' ? '\u2191' : '\u2193'}
    </span>
  )
}
