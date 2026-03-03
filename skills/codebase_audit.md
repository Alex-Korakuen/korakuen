# Skill: Codebase Audit

**Trigger:** Run periodically, before any major phase transition, or when inconsistencies are suspected.

**Input:**
- All files in `cli/`
- All files in `supabase/`
- All files in `website/lib/` and `website/app/`
- `docs/08_schema.md` — the source of truth
- `docs/10_coding_standards.md` — the conventions to check against
- `CLAUDE.md` — the never-do list

**Output:** A written audit report listing every issue found, categorized by severity, with suggested fixes.

---

## Audit Checklist

### Category 1 — Schema Consistency

- [ ] Every table in `08_schema.md` has a corresponding CREATE TABLE in `001_initial_schema.sql`
- [ ] Field names in SQL match field names in schema document exactly
- [ ] Field types in SQL match the types specified in schema document
- [ ] Every FK in SQL references the correct table and field
- [ ] The 6 reference/master tables have `is_active` (partner_companies, bank_accounts, entities, entity_contacts, tags, projects). All tables have `created_at`. All tables have `updated_at` except `entity_tags`
- [ ] TypeScript types in `database.types.ts` match current schema — regenerate if schema changed
- [ ] Enum values in `types.ts` match VARCHAR values in schema exactly
- [ ] CLI scripts reference field names that exist in the current schema

### Category 2 — Coding Standards

- [ ] All CLI scripts use `from lib.db import supabase` — never direct import
- [ ] All CLI scripts use `from lib.helpers import ...` for input/confirm/list
- [ ] All CLI scripts show confirmation summary before inserting
- [ ] All CLI scripts have success/error messages with try/except
- [ ] No business logic (calculations) in CLI scripts — only in database
- [ ] All view SQL files have header comments
- [ ] All TypeScript files use no `any` types
- [ ] All query functions in `website/lib/queries.ts` — not inline in components

### Category 3 — DRY Violations

- [ ] No duplicated input helper code across CLI scripts — all in `lib/helpers.py`
- [ ] No duplicated Supabase client initialization — all in `lib/db.py`
- [ ] No duplicated query logic across website pages — all in `lib/queries.ts`
- [ ] No duplicated currency formatting — all in `lib/formatters.ts`
- [ ] No duplicated TypeScript types — all in `lib/types.ts`

### Category 4 — Security

- [ ] No `.env` file committed to git
- [ ] No Supabase keys hardcoded anywhere in code
- [ ] Service role key not referenced in website code — only anon key
- [ ] `.env.example` exists and has all required variable names with empty values
- [ ] `.gitignore` includes `.env`, `.env.local`, `venv/`, `node_modules/`

### Category 5 — Documentation Drift

- [ ] `09_dev_roadmap.md` task statuses reflect actual completion state
- [ ] Any new architectural decision made during development is recorded in `02_system_architecture.md`
- [ ] Any new CLI script is listed in `10_coding_standards.md` file naming section
- [ ] `CLAUDE.md` current status section reflects actual phase

### Category 6 — Dead Files

- [ ] No commented-out code blocks anywhere in the codebase
- [ ] No unused functions in `cli/lib/helpers.py` or `cli/lib/db.py`
- [ ] No unused query functions in `website/lib/queries.ts`
- [ ] No unused TypeScript types in `website/lib/types.ts`
- [ ] No unused React components in `website/components/`
- [ ] No build-time documents that have served their purpose (e.g. `docs/12_skills.md` if skills are already built)
- [ ] No stale skill files in `/skills/` — every skill must match current conventions exactly
- [ ] No superseded migration files outside of `supabase/migrations/` numbered sequence

---

## Severity Levels

| Level | Meaning | Action |
|---|---|---|
| CRITICAL | Schema mismatch, security issue, or broken functionality | Fix immediately before proceeding |
| HIGH | DRY violation or missing convention that will compound | Fix before next task |
| MEDIUM | Documentation drift or missing comment | Fix in current session |
| LOW | Minor style inconsistency | Note and fix when convenient |

---

## Report Format

```
## Codebase Audit — [Date]

### CRITICAL
- [file:line] Description of issue → suggested fix

### HIGH
- [file:line] Description of issue → suggested fix

### MEDIUM
- [file:line] Description of issue → suggested fix

### LOW
- [file:line] Description of issue → suggested fix

### Summary
X critical, X high, X medium, X low issues found.
```

---

## How to Run

1. Read `docs/08_schema.md` as the source of truth
2. Walk each category in the checklist
3. For each check, examine the relevant files
4. Record every issue found with file path, line number, and suggested fix
5. Classify each issue by severity
6. Produce the report in the format above

If no issues are found in a category, note "No issues found" under that category.

---

## When to Run

- Before starting a new phase (Phase 2 → Phase 3, etc.)
- After completing a batch of related tasks
- When something seems inconsistent or broken
- When explicitly requested
