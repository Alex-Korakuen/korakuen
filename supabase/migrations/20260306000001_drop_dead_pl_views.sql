-- Drop unused P&L views — P&L is computed in queries.ts, not via SQL views
DROP VIEW IF EXISTS v_project_pl;
DROP VIEW IF EXISTS v_company_pl;
