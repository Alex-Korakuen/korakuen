# Environment Setup

**Document version:** 1.0
**Date:** February 28, 2026
**Status:** Active

---

## Overview

This document describes how to set up a local development environment for the Korakuen management system. The system has two components that need separate setup: the Python CLI scripts and the Next.js visualization website.

---

## Prerequisites

| Tool | Version | Purpose |
|---|---|---|
| Python | 3.11+ | CLI scripts |
| pip | latest | Python package manager |
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
│   ├── cli_script.md
│   ├── import_script.md
│   ├── ts_types.md
│   └── codebase_audit.md
├── cli/                    → Python CLI application
│   ├── main.py             → single entry point (python main.py)
│   ├── modules/
│   │   ├── __init__.py
│   │   ├── projects.py     → add single + import from Excel
│   │   ├── entities.py     → add entity, contact, tag + import
│   │   ├── costs.py        → add single + import costs/cost_items
│   │   ├── quotes.py       → add single + import from Excel
│   │   ├── ar_invoices.py  → add single + import from Excel
│   │   ├── payments.py     → register payment, verify retencion
│   │   ├── loans.py        → add loan, schedule, register repayment
│   │   └── exchange_rates.py → add daily SUNAT rate, list recent rates
│   ├── lib/
│   │   ├── __init__.py
│   │   ├── db.py           → shared Supabase client
│   │   ├── helpers.py      → shared input helpers + clear_screen
│   │   └── import_helpers.py → shared import validation/highlighting
│   └── requirements.txt
├── supabase/               → SQL schema, migrations, and seeds
│   ├── migrations/
│   │   ├── 20260301000001_initial_schema.sql
│   │   ├── 20260301000002_indexes.sql
│   │   ├── 20260301000003_add_is_active.sql
│   │   ├── 20260301000004_views.sql
│   │   ├── 20260301000005_seed_data.sql
│   │   ├── 20260301000007_views_security_invoker.sql
│   │   ├── 20260301000008_fix_function_search_path.sql
│   │   ├── 20260301000009_v_cost_totals_add_notes.sql
│   │   ├── 20260302000001_entity_location_fields.sql
│   │   ├── 20260302000002_informal_payment_support.sql
│   │   ├── 20260302000003_loans_tables.sql
│   │   ├── 20260302000004_project_budgets.sql
│   │   ├── 20260302000005_phase35_views.sql
│   │   ├── 20260302000006_phase35_indexes.sql
│   │   ├── 20260302000007_fix_payments_index.sql
│   │   ├── 20260303000001_fix_v_bank_balances_is_active.sql
│   │   ├── 20260303000002_rls_authenticated_read.sql
│   │   ├── 20260303000003_exchange_rate_required.sql
│   │   ├── 20260303000004_views_exchange_rate_passthrough.sql
│   │   ├── 20260303000005_dummy_data.sql
│   │   ├── 20260303000006_dummy_partner_costs.sql
│   │   └── 20260303000007_create_v_igv_position.sql
│   ├── views/              → individual view source files (combined into migration above)
│   │   ├── v_ap_calendar.sql
│   │   ├── v_ar_balances.sql
│   │   ├── v_bank_balances.sql
│   │   ├── v_cost_balances.sql
│   │   ├── v_cost_totals.sql
│   │   ├── v_entity_transactions.sql
│   │   ├── v_retencion_dashboard.sql
│   │   ├── v_loan_balances.sql
│   │   ├── v_budget_vs_actual.sql
│   │   └── v_igv_position.sql
│   └── seeds/
│       ├── 001_tags.sql
│       ├── 002_partner_companies.sql
│       └── 003_bank_accounts.sql
├── website/                → Next.js visualization website
│   ├── app/
│   ├── components/
│   ├── lib/
│   ├── package.json
│   └── .env.local          → never committed
├── imports/                → Excel templates for bulk data import
│   └── templates/          → one .xlsx template per entity type
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
- **Anon key:** safe for client-side use (read-only website)
- **Service role key:** server-side only (CLI scripts) — never expose publicly

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

## 2. CLI Setup

### 2.1 Clone Repository
```bash
git clone [repo-url]
cd korakuen/cli
```

### 2.2 Create Virtual Environment
```bash
python -m venv venv
source venv/bin/activate        # macOS/Linux
# or
venv\Scripts\activate           # Windows
```

### 2.3 Install Dependencies
```bash
pip install -r requirements.txt
```

**requirements.txt contents:**
```
supabase==2.x.x
python-dotenv==1.x.x
rich==13.x.x          # for nice terminal output
pandas==2.x.x         # for reading Excel files (import scripts)
openpyxl==3.x.x       # Excel engine for pandas + cell formatting
```

### 2.4 Configure Environment
```bash
cp ../.env.example .env
```

Edit `.env`:
```
SUPABASE_URL=https://[project-ref].supabase.co
SUPABASE_SERVICE_ROLE_KEY=[your-service-role-key]
```

**Use service role key for CLI** — it bypasses Row Level Security, which is appropriate since CLI scripts are used directly by partners, not by end users.

### 2.5 Test Connection
```bash
python main.py
```

If Supabase connects correctly, you will see the main menu. Select any option to verify database connectivity.

---

## 3. Website Setup

### 3.1 Install Dependencies
```bash
cd korakuen/website
npm install
```

### 3.2 Configure Environment
```bash
cp ../.env.example .env.local
```

Edit `.env.local`:
```
NEXT_PUBLIC_SUPABASE_URL=https://[project-ref].supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=[your-anon-key]
```

**Use anon key for website** — read-only access, safe to expose in browser. Row Level Security on Supabase enforces read-only access.

### 3.3 Run Locally
```bash
npm run dev
```

Website available at `http://localhost:3000`

### 3.4 Deploy to Vercel
1. Push repository to GitHub
2. Go to [vercel.com](https://vercel.com) → New Project
3. Import the GitHub repository
4. Set root directory to `website/`
5. Add environment variables in Vercel dashboard (same as `.env.local`)
6. Deploy

Vercel auto-deploys on every push to `main`.

---

## 4. VS Code Setup

### Recommended Extensions
- **Python** (Microsoft) — Python language support
- **Pylance** — Python type checking
- **ESLint** — TypeScript linting
- **Prettier** — code formatting
- **Supabase** — Supabase integration (optional)
- **GitLens** — Git history and blame

### Workspace Settings
Create `.vscode/settings.json`:
```json
{
  "python.defaultInterpreterPath": "./cli/venv/bin/python",
  "editor.formatOnSave": true,
  "editor.defaultFormatter": "esbenp.prettier-vscode",
  "[python]": {
    "editor.defaultFormatter": "ms-python.python"
  }
}
```

---

## 5. Environment Variables Reference

| Variable | Used By | Description |
|---|---|---|
| `SUPABASE_URL` | CLI + website | Supabase project URL |
| `SUPABASE_SERVICE_ROLE_KEY` | CLI only | Full access key — never expose |
| `NEXT_PUBLIC_SUPABASE_URL` | Website only | Same URL, prefixed for Next.js |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Website only | Read-only key — safe for browser |
| `SUPABASE_PROJECT_ID` | Supabase CLI | Project ref for linking and type generation |
| `SUPABASE_ACCESS_TOKEN` | Supabase CLI | CLI access token for migrations |

**.env.example** (committed to repo):
```
SUPABASE_URL=
SUPABASE_SERVICE_ROLE_KEY=
SUPABASE_PROJECT_ID=
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_ACCESS_TOKEN=
```

---

## 6. Common Issues

| Issue | Solution |
|---|---|
| `ModuleNotFoundError: supabase` | Virtual environment not activated — run `source venv/bin/activate` |
| `Invalid API key` | Check `.env` file has correct service key, not anon key |
| `relation does not exist` | Schema not applied — run `supabase db push` or execute migration files via Supabase CLI |
| Website shows no data | Check `.env.local` has correct anon key and URL |
| Vercel deploy fails | Check environment variables are set in Vercel dashboard |

---

*Update this document when new dependencies are added or setup steps change.*
