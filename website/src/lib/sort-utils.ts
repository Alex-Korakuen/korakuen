'use client'

import { useState } from 'react'

/**
 * Generic sort function that handles nulls (sort last), numbers (numeric compare),
 * and strings (localeCompare), with direction multiplier.
 *
 * @param rows - Array of rows to sort (returns a new sorted array)
 * @param sortColumn - Column name to sort by
 * @param sortDirection - 'asc' or 'desc'
 * @param getValue - Optional callback to extract the value for a given row and column.
 *                   Without it, uses direct bracket-notation access (row[column]).
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

/**
 * Hook that manages sortColumn and sortDirection state.
 * Returns the current sort state and a handleSort function that toggles direction
 * if the same column is clicked, otherwise sets the new column with 'asc'.
 */
export function useSort<TColumn extends string>(
  defaultColumn: TColumn,
  defaultDirection: 'asc' | 'desc' = 'asc'
) {
  const [sortColumn, setSortColumn] = useState<TColumn>(defaultColumn)
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>(defaultDirection)

  function handleSort(column: TColumn) {
    if (sortColumn === column) {
      setSortDirection((prev) => (prev === 'asc' ? 'desc' : 'asc'))
    } else {
      setSortColumn(column)
      setSortDirection('asc')
    }
  }

  return { sortColumn, sortDirection, handleSort }
}
