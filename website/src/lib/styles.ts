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

/** Danger button with label — delete actions in slide-over footers */
export const btnDangerOutline =
  'inline-flex items-center gap-1.5 rounded-md border border-red-200 px-3 py-1.5 text-sm font-medium text-red-600 transition-colors hover:bg-red-50'

/** Danger icon-only button — trash icon in tables and lists */
export const btnDangerIcon =
  'rounded border border-red-200 p-1.5 text-red-400 transition-colors hover:bg-red-50 hover:text-red-600'

/** Edit/neutral icon-only button — pencil icon in headers */
export const btnEditIcon =
  'rounded border border-zinc-200 p-1.5 text-zinc-400 transition-colors hover:bg-zinc-100 hover:text-zinc-700'

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
  'rounded border border-zinc-300 bg-white px-3 py-1.5 text-sm text-zinc-700'

// ── Direction badges (colors only — compose with layout classes) ─────

/** Accounts Payable badge */
export const badgeAP = 'bg-orange-50 text-orange-700'

/** Accounts Receivable badge */
export const badgeAR = 'bg-emerald-50 text-emerald-700'

/** Loan badge */
export const badgeLoan = 'bg-amber-50 text-amber-700'
