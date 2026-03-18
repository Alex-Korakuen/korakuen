# Environment Setup

**Document version:** 2.0
**Date:** March 18, 2026
**Status:** Active

---

## Overview

This document describes how to set up a local development environment for the Korakuen management system website and database tooling.

---

## Prerequisites

| Tool | Version | Purpose |
|---|---|---|
| Node.js | 18+ | Next.js website |
| npm | latest | Node package manager |
| Supabase CLI | latest | Database migrations and schema management |
| Git | any | Version control |
| VS Code | latest | Recommended editor |

---

## Repository Structure

```
korakuen/
├── skills/                 → Claude Code skill files
│   ├── sql_schema.md
│   ├── sql_views.md
│   ├── ts_types.md
│   └── codebase_audit.md
├── supabase/               → SQL schema, migrations, and seeds
│   ├── migrations/
│   │   ├── 20260301000001_initial_schema.sql
│   │   ├── ...               → 60+ migrations through March 18
│   │   └── 20260318000004_...
│   ├── views/              → individual view source files (combined into migration for deploy)
│   │   ├── v_bank_balances.sql
│   │   ├── v_budget_vs_actual.sql
│   │   ├── v_igv_position.sql
│   │   ├── v_invoice_balances.sql
│   │   ├── v_invoice_totals.sql
│   │   ├── v_invoices_with_loans.sql
│   │   ├── v_loan_balances.sql
│   │   ├── v_obligation_calendar.sql
│   │   ├── v_payments_enriched.sql
│   │   └── v_retencion_dashboard.sql
│   └── seeds/
│       ├── 001_tags.sql
│       ├── 002_partner_companies.sql
│       └── 003_bank_accounts.sql
├── website/                → Next.js website (visualization + data entry)
│   ├── src/app/
│   ├── src/components/
│   ├── src/lib/
│   ├── package.json
│   └── .env.local          → never committed
├── docs/                   → all documentation
│   └── ...
├── .env.example            → template, committed
└── .gitignore
```

---

## 1. Supabase Setup

### 1.1 Create Supabase Project
1. Go to [supabase.com](https://supabase.com) and sign in
2. Create a new project named `korakuen`
3. Choose a strong database password and save it securely
4. Select region: South America (São Paulo) — closest to Lima

### 1.2 Get Credentials
From your Supabase project dashboard → Settings → API:
- **Project URL:** `https://[project-ref].supabase.co`
- **Anon key:** safe for client-side use (RLS policies enforce access control)
- **Service role key:** server-side only — never expose publicly

### 1.3 Install Supabase CLI
```bash
brew install supabase/tap/supabase    # macOS
# or: npm install -g supabase         # any platform
```

### 1.4 Link to Supabase Project
```bash
cd korakuen
supabase link --project-ref [your-project-ref]
```

The project ref is the subdomain in your Supabase URL: `https://[project-ref].supabase.co`

### 1.5 Apply Schema
All schema changes are applied via the Supabase CLI — never through the Supabase web dashboard.

```bash
# Apply all migrations (tables, indexes, is_active, views)
supabase db push
```

Seed data is not managed as migrations. Run seeds via `psql` or the Supabase SQL Editor:

```bash
# Via psql (using your database connection string from Supabase dashboard → Settings → Database)
psql "postgresql://postgres:[password]@db.[project-ref].supabase.co:5432/postgres" \
  -f supabase/seeds/001_tags.sql \
  -f supabase/seeds/002_partner_companies.sql \
  -f supabase/seeds/003_bank_accounts.sql

```

Alternatively, paste the seed SQL files directly into the Supabase SQL Editor (Dashboard → SQL Editor).

---

## 2. Website Setup

### 2.1 Install Dependencies
```bash
cd korakuen/website
npm install
```

### 2.2 Configure Environment
```bash
cp ../.env.example .env.local
```

Edit `.env.local`:
```
NEXT_PUBLIC_SUPABASE_URL=https://[project-ref].supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=[your-anon-key]
```

**Use anon key for website** — safe to expose in browser. Row Level Security on Supabase enforces read and write access for authenticated users.

### 2.3 Run Locally
```bash
npm run dev
```

Website available at `http://localhost:3000`

### 2.4 Deploy to Vercel
1. Push repository to GitHub
2. Go to [vercel.com](https://vercel.com) → New Project
3. Import the GitHub repository
4. Set root directory to `website/`
5. Add environment variables in Vercel dashboard (same as `.env.local`)
6. Deploy

Vercel auto-deploys on every push to `main`.

---

## 3. VS Code Setup

### Recommended Extensions
- **ESLint** — TypeScript linting
- **Prettier** — code formatting
- **Supabase** — Supabase integration (optional)
- **GitLens** — Git history and blame

### Workspace Settings
Create `.vscode/settings.json`:
```json
{
  "editor.formatOnSave": true,
  "editor.defaultFormatter": "esbenp.prettier-vscode"
}
```

---

## 4. Environment Variables Reference

| Variable | Used By | Description |
|---|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | Website | Supabase project URL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Website | Public key — safe for browser, RLS enforced |
| `SUPABASE_PROJECT_ID` | Supabase CLI | Project ref for linking and type generation |
| `SUPABASE_ACCESS_TOKEN` | Supabase CLI | CLI access token for migrations |

**.env.example** (committed to repo):
```
SUPABASE_PROJECT_ID=
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_ACCESS_TOKEN=
```

---

## 5. Common Issues

| Issue | Solution |
|---|---|
| `relation does not exist` | Schema not applied — run `supabase db push` or execute migration files via Supabase CLI |
| Website shows no data | Check `.env.local` has correct anon key and URL |
| Vercel deploy fails | Check environment variables are set in Vercel dashboard |

---

*Update this document when new dependencies are added or setup steps change.*
