/** Shared Tailwind class strings — single source of truth for repeated UI patterns */

// ── Form inputs ──────────────────────────────────────────────────────

/** Full-width input used in modals and pickers */
export const inputClass =
  'w-full rounded border border-zinc-200 px-3 py-2 text-sm focus:border-blue-400 focus:outline-none focus:ring-1 focus:ring-blue-400'

/** Compact input used in inline forms (no w-full, smaller padding) */
export const inputCompactClass =
  'rounded border border-zinc-200 px-2 py-1.5 text-sm focus:border-blue-400 focus:outline-none focus:ring-1 focus:ring-blue-400'

// ── Buttons ──────────────────────────────────────────────────────────

/** Primary action button — header CTAs, inline actions */
export const btnPrimary =
  'rounded bg-blue-600 px-3 py-1.5 text-sm font-medium text-white transition-colors hover:bg-blue-700'

/** Primary button for modals — slightly larger padding */
export const btnPrimaryLg =
  'rounded bg-blue-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-blue-700'

/** Danger button with label — delete actions in modal footers */
export const btnDangerOutline =
  'inline-flex items-center gap-1.5 rounded-md border border-red-200 px-3 py-1.5 text-sm font-medium text-red-600 transition-colors hover:bg-red-50'

/** Danger icon-only button — trash icon in tables and lists */
export const btnDangerIcon =
  'rounded border border-red-200 p-1.5 text-red-400 transition-colors hover:bg-red-50 hover:text-red-600'

/** Edit/neutral icon-only button — pencil icon in headers */
export const btnEditIcon =
  'rounded border border-zinc-200 p-1.5 text-zinc-400 transition-colors hover:bg-zinc-100 hover:text-zinc-700'

/** Auth page primary button — dark zinc with focus ring */
export const btnAuthPrimary =
  'rounded-md bg-zinc-900 px-4 py-2 text-sm font-medium text-white shadow-sm transition-colors hover:bg-zinc-800 focus:outline-none focus:ring-2 focus:ring-zinc-500 focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50'

// ── Tables ───────────────────────────────────────────────────────────

/** Table header row — uppercase, muted, compact */
export const tableHead =
  'bg-zinc-50 text-xs font-medium uppercase tracking-wide text-zinc-500'

/** Clickable table row — standard hover */
export const tableRowHover =
  'cursor-pointer transition-colors hover:bg-zinc-50'

// ── Selects ──────────────────────────────────────────────────────────

/** Native select / filter dropdown */
export const selectClass =
  'rounded border border-zinc-300 bg-white px-3 py-1.5 text-xs text-zinc-700'

// ── Direction badges (colors only — compose with layout classes) ─────

/** Accounts Payable badge */
export const badgeAP = 'bg-orange-50 text-orange-700'

/** Accounts Receivable badge */
export const badgeAR = 'bg-emerald-50 text-emerald-700'

/** Loan badge */
export const badgeLoan = 'bg-amber-50 text-amber-700'

// ── SVG icon paths (Heroicons 20×20 solid) ──────────────────────────

/** Pencil icon — edit actions */
export const iconPencil = 'M2.695 14.763l-1.262 3.154a.5.5 0 00.65.65l3.155-1.262a4 4 0 001.343-.885L17.5 5.5a2.121 2.121 0 00-3-3L3.58 13.42a4 4 0 00-.885 1.343z'

/** Trash icon — delete actions */
export const iconTrash = 'M8.75 1A2.75 2.75 0 006 3.75v.443c-.795.077-1.584.176-2.365.298a.75.75 0 10.23 1.482l.149-.022.841 10.518A2.75 2.75 0 007.596 19h4.807a2.75 2.75 0 002.742-2.53l.841-10.519.149.023a.75.75 0 00.23-1.482A41.03 41.03 0 0014 4.193V3.75A2.75 2.75 0 0011.25 1h-2.5zM10 4c.84 0 1.673.025 2.5.075V3.75c0-.69-.56-1.25-1.25-1.25h-2.5c-.69 0-1.25.56-1.25 1.25v.325C8.327 4.025 9.16 4 10 4zM8.58 7.72a.75.75 0 00-1.5.06l.3 7.5a.75.75 0 101.5-.06l-.3-7.5zm4.34.06a.75.75 0 10-1.5-.06l-.3 7.5a.75.75 0 101.5.06l.3-7.5z'
