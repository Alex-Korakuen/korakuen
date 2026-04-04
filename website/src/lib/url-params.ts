'use client'

import type { ReadonlyURLSearchParams } from 'next/navigation'

type Router = { push: (url: string) => void }

/**
 * Push a new URL after running `mutator` over a cloned URLSearchParams.
 * Always resets `page` to 1 — filter and sort changes should re-paginate from the start.
 */
export function pushParamsWithPageReset(
  router: Router,
  pathname: string,
  searchParams: ReadonlyURLSearchParams,
  mutator: (params: URLSearchParams) => void,
): void {
  const params = new URLSearchParams(searchParams.toString())
  mutator(params)
  params.delete('page')
  router.push(`${pathname}?${params.toString()}`)
}
