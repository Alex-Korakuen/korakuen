/**
 * Generic sort function that handles nulls (sort last), numbers (numeric compare),
 * and strings (localeCompare), with direction multiplier.
 *
 * This is a pure utility with no React dependencies, safe to use on both
 * server (queries.ts) and client.
 */
export function sortRows<T>(
  rows: T[],
  sortColumn: string,
  sortDirection: 'asc' | 'desc',
  getValue?: (row: T, column: string) => string | number | null
): T[] {
  const dir = sortDirection === 'asc' ? 1 : -1

  return [...rows].sort((a, b) => {
    const aVal = getValue
      ? getValue(a, sortColumn)
      : (a as Record<string, unknown>)[sortColumn] as string | number | null
    const bVal = getValue
      ? getValue(b, sortColumn)
      : (b as Record<string, unknown>)[sortColumn] as string | number | null

    // Nulls sort last regardless of direction
    if (aVal === null && bVal === null) return 0
    if (aVal === null) return 1
    if (bVal === null) return -1

    // Numeric comparison
    if (typeof aVal === 'number' && typeof bVal === 'number') {
      return (aVal - bVal) * dir
    }

    // String comparison
    return String(aVal).localeCompare(String(bVal)) * dir
  })
}
