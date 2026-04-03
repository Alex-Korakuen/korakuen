/** Shared Tailwind class strings — single source of truth for repeated UI patterns */

// ── Form inputs ──────────────────────────────────────────────────────

/** Full-width input used in modals and pickers */
export const inputClass =
  'w-full rounded border border-edge px-3 py-2 text-sm text-ink focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent'

/** Compact input used in inline forms (no w-full, smaller padding) */
export const inputCompactClass =
  'rounded border border-edge px-2 py-1.5 text-sm text-ink focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent'

// ── Form labels ─────────────────────────────────────────────────────

/** Section header label — form titles like "New Payment" */
export const formSectionLabel =
  'text-xs font-bold uppercase tracking-wide text-accent'

/** Field label — form inputs with block display and margin */
export const formFieldLabel =
  'mb-1 block text-xs font-bold uppercase tracking-wide text-accent'

/** Filter control label — compact, subdued, used in FilterBar dropdowns and search */
export const filterLabel =
  'text-xs font-medium text-muted'

// ── Buttons ──────────────────────────────────────────────────────────

/** Primary action button — header CTAs, inline actions */
export const btnPrimary =
  'rounded bg-accent px-3 py-1.5 text-sm font-medium text-white transition-colors hover:bg-accent-hover'

/** Primary button for modals — slightly larger padding */
export const btnPrimaryLg =
  'rounded bg-accent px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-accent-hover'

/** Danger button with label — delete actions in modal footers */
export const btnDangerOutline =
  'inline-flex items-center gap-1.5 rounded-md border border-negative/20 px-3 py-1.5 text-sm font-medium text-negative transition-colors hover:bg-negative-bg'

/** Danger icon-only button — trash icon in tables and lists */
export const btnDangerIcon =
  'rounded border border-negative/20 p-1.5 text-negative/60 transition-colors hover:bg-negative-bg hover:text-negative'

/** Edit/neutral icon-only button — pencil icon in headers */
export const btnEditIcon =
  'rounded border border-edge p-1.5 text-faint transition-colors hover:bg-surface hover:text-muted'

/** Auth page primary button — dark with focus ring */
export const btnAuthPrimary =
  'rounded-md bg-ink px-4 py-2 text-sm font-medium text-white shadow-sm transition-colors hover:bg-ink/90 focus:outline-none focus:ring-2 focus:ring-accent focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50'

// ── Tables ───────────────────────────────────────────────────────────

/** Table header row — uppercase, faint, compact */
export const tableHead =
  'bg-panel text-[10px] font-medium uppercase tracking-[0.08em] text-faint'

/** Clickable table row — standard hover */
export const tableRowHover =
  'cursor-pointer transition-colors hover:bg-panel'

// ── Selects ──────────────────────────────────────────────────────────

/** Native select / filter dropdown */
export const selectClass =
  'rounded border border-edge bg-white px-3 py-1.5 text-xs text-ink'

// ── Direction badges (colors only — compose with layout classes) ─────

/** Accounts Payable badge */
export const badgeAP = 'bg-caution-bg text-caution'

/** Accounts Receivable badge */
export const badgeAR = 'bg-positive-bg text-positive'

/** Loan badge */
export const badgeLoan = 'bg-caution-bg text-caution'

// ── SVG icon paths (Heroicons 20×20 solid) ──────────────────────────

/** Pencil icon — edit actions */
export const iconPencil = 'M2.695 14.763l-1.262 3.154a.5.5 0 00.65.65l3.155-1.262a4 4 0 001.343-.885L17.5 5.5a2.121 2.121 0 00-3-3L3.58 13.42a4 4 0 00-.885 1.343z'

/** Trash icon — delete actions */
export const iconTrash = 'M8.75 1A2.75 2.75 0 006 3.75v.443c-.795.077-1.584.176-2.365.298a.75.75 0 10.23 1.482l.149-.022.841 10.518A2.75 2.75 0 007.596 19h4.807a2.75 2.75 0 002.742-2.53l.841-10.519.149.023a.75.75 0 00.23-1.482A41.03 41.03 0 0014 4.193V3.75A2.75 2.75 0 0011.25 1h-2.5zM10 4c.84 0 1.673.025 2.5.075V3.75c0-.69-.56-1.25-1.25-1.25h-2.5c-.69 0-1.25.56-1.25 1.25v.325C8.327 4.025 9.16 4 10 4zM8.58 7.72a.75.75 0 00-1.5.06l.3 7.5a.75.75 0 101.5-.06l-.3-7.5zm4.34.06a.75.75 0 10-1.5-.06l-.3 7.5a.75.75 0 101.5.06l.3-7.5z'

/** Check icon — confirm inline edit */
export const iconCheck = 'M16.704 4.153a.75.75 0 01.143 1.052l-8 10.5a.75.75 0 01-1.127.075l-4.5-4.5a.75.75 0 011.06-1.06l3.894 3.893 7.48-9.817a.75.75 0 011.05-.143z'

/** X icon — cancel inline edit */
export const iconX = 'M6.28 5.22a.75.75 0 00-1.06 1.06L8.94 10l-3.72 3.72a.75.75 0 101.06 1.06L10 11.06l3.72 3.72a.75.75 0 101.06-1.06L11.06 10l3.72-3.72a.75.75 0 00-1.06-1.06L10 8.94 6.28 5.22z'
