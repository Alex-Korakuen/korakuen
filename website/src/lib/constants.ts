const PROJECT_COST_CATEGORIES = [
  { key: 'materials', label: 'Materials' },
  { key: 'labor', label: 'Labor' },
  { key: 'subcontractor', label: 'Subcontractor' },
  { key: 'equipment_rental', label: 'Equipment' },
  { key: 'permits_regulatory', label: 'Permits' },
  { key: 'other', label: 'Other' },
] as const

const SGA_CATEGORIES = [
  { key: 'software_licenses', label: 'Software Licenses' },
  { key: 'partner_compensation', label: 'Partner Compensation' },
  { key: 'professional_services', label: 'Professional Services' },
  { key: 'other', label: 'Other' },
] as const

/** SGA-only category keys (excludes 'other' which is shared with project costs) */
export const SGA_ONLY_CATEGORY_KEYS: Set<string> = new Set(
  SGA_CATEGORIES.filter(c => c.key !== 'other').map(c => c.key)
)

/** Maps category key to display label for project cost categories */
export const categoryLabels: Record<string, string> = Object.fromEntries(
  PROJECT_COST_CATEGORIES.map(c => [c.key, c.label])
)
