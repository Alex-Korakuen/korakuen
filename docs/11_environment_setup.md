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
│   ├── ts_types.md
│   └── codebase_audit.md
├── cli/                    → Python CLI scripts
│   ├── add_project.py
│   ├── add_entity.py
│   ├── add_cost.py
│   ├── add_ar_invoice.py
│   ├── register_payment.py
│   ├── view_ap_calendar.py
│   ├── view_partner_balances.py
│   ├── requirements.txt
│   └── .env                → never committed
├── database/               → SQL schema and migrations
│   ├── migrations/
│   │   └── 001_initial_schema.sql
│   ├── views/
│   │   ├── cost_totals.sql
│   │   ├── cost_balances.sql
│   │   ├── ar_balances.sql
│   │   ├── ap_calendar.sql
│   │   ├── partner_ledger.sql
│   │   └── ...
│   └── seeds/
│       ├── tags.sql
│       └── partner_companies.sql
├── website/                → Next.js visualization website
│   ├── app/
│   ├── components/
│   ├── lib/
│   ├── package.json
│   └── .env.local          → never committed
├── docs/                   → all documentation
│   └── ...
├── .env.example            → template, committed
├── .gitignore
└── README.md
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

### 1.3 Apply Schema
1. Go to Supabase → SQL Editor
2. Run `database/migrations/001_initial_schema.sql`
3. Run each view file in `database/views/`
4. Run seed files in `database/seeds/`
5. Verify all 13 tables appear in Table Editor

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
```

### 2.4 Configure Environment
```bash
cp ../.env.example .env
```

Edit `.env`:
```
SUPABASE_URL=https://[project-ref].supabase.co
SUPABASE_SERVICE_KEY=[your-service-role-key]
```

**Use service role key for CLI** — it bypasses Row Level Security, which is appropriate since CLI scripts are used directly by partners, not by end users.

### 2.5 Test Connection
```bash
python add_project.py
```

If Supabase connects correctly, you will see the script prompt for input.

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
| `SUPABASE_SERVICE_KEY` | CLI only | Full access key — never expose |
| `NEXT_PUBLIC_SUPABASE_URL` | Website only | Same URL, prefixed for Next.js |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Website only | Read-only key — safe for browser |

**.env.example** (committed to repo):
```
SUPABASE_URL=
SUPABASE_SERVICE_KEY=
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
```

---

## 6. Common Issues

| Issue | Solution |
|---|---|
| `ModuleNotFoundError: supabase` | Virtual environment not activated — run `source venv/bin/activate` |
| `Invalid API key` | Check `.env` file has correct service key, not anon key |
| `relation does not exist` | Schema not applied — run migration SQL in Supabase SQL Editor |
| Website shows no data | Check `.env.local` has correct anon key and URL |
| Vercel deploy fails | Check environment variables are set in Vercel dashboard |

---

*Update this document when new dependencies are added or setup steps change.*
