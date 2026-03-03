-- Migration: Add dummy costs from Partner B and Partner C bank accounts
-- Purpose: Populate partner contributions so v_partner_ledger shows multiple partners per project
-- Rollback: DELETE FROM cost_items / costs / payments / ar_invoices where relevant

-- ============================================================
-- 1. Partner B bank account for USD (needed for PRY005 contributions)
-- ============================================================

INSERT INTO bank_accounts (partner_company_id, bank_name, account_number_last4, account_type, currency, is_detraccion_account)
VALUES (
  (SELECT id FROM partner_companies WHERE ruc = '20000000002'),
  'Scotiabank',
  '0007',
  'checking',
  'USD',
  false
);

-- ============================================================
-- 2. Partner C bank account for USD
-- ============================================================

INSERT INTO bank_accounts (partner_company_id, bank_name, account_number_last4, account_type, currency, is_detraccion_account)
VALUES (
  (SELECT id FROM partner_companies WHERE ruc = '20000000003'),
  'Interbank',
  '0008',
  'checking',
  'USD',
  false
);

-- ============================================================
-- 3. Costs paid by Partner B (PRY004 — PEN)
-- ============================================================

-- Cost B1: PRY004, labor costs paid by Partner B, PEN
INSERT INTO costs (project_id, valuation_id, bank_account_id, entity_id, cost_type, date, title, igv_rate, currency, exchange_rate, comprobante_type, payment_method, due_date, notes)
VALUES (
  (SELECT id FROM projects WHERE project_code = 'PRY004'),
  (SELECT id FROM valuations WHERE project_id = (SELECT id FROM projects WHERE project_code = 'PRY004') AND valuation_number = 1),
  (SELECT id FROM bank_accounts WHERE account_number_last4 = '0005'),
  NULL,
  'project_cost', '2026-01-15', 'Mano de obra — cuadrilla Partner B', 0.00, 'PEN', 3.70,
  'planilla_jornales', 'cash', '2026-01-31', 'Partner B labor team, 15 workers x 15 days'
);

INSERT INTO cost_items (cost_id, title, category, quantity, unit_of_measure, unit_price, subtotal) VALUES
  ((SELECT id FROM costs WHERE title = 'Mano de obra — cuadrilla Partner B'), 'Jornales peones Partner B', 'labor', 180.00, 'jornal', 60.00, 10800.00),
  ((SELECT id FROM costs WHERE title = 'Mano de obra — cuadrilla Partner B'), 'Jornales operarios Partner B', 'labor', 45.00, 'jornal', 90.00, 4050.00);

-- Cost B2: PRY004, materials paid by Partner B, PEN
INSERT INTO costs (project_id, valuation_id, bank_account_id, entity_id, cost_type, date, title, igv_rate, detraccion_rate, currency, exchange_rate, comprobante_type, comprobante_number, payment_method, document_ref, due_date)
VALUES (
  (SELECT id FROM projects WHERE project_code = 'PRY004'),
  (SELECT id FROM valuations WHERE project_id = (SELECT id FROM projects WHERE project_code = 'PRY004') AND valuation_number = 2),
  (SELECT id FROM bank_accounts WHERE account_number_last4 = '0005'),
  (SELECT id FROM entities WHERE document_number = '20456789011'),
  'project_cost', '2026-02-10', 'Agregados y arena gruesa', 18.00, 4.00, 'PEN', 3.72,
  'factura', 'F001-00278', 'bank_transfer', 'PRY004-AP-004', '2026-02-25'
);

INSERT INTO cost_items (cost_id, title, category, quantity, unit_of_measure, unit_price, subtotal) VALUES
  ((SELECT id FROM costs WHERE document_ref = 'PRY004-AP-004'), 'Arena gruesa para concreto', 'materials', 40.00, 'm3', 85.00, 3400.00),
  ((SELECT id FROM costs WHERE document_ref = 'PRY004-AP-004'), 'Piedra chancada 1/2"', 'materials', 35.00, 'm3', 110.00, 3850.00);

-- ============================================================
-- 4. Costs paid by Partner C (PRY004 — PEN)
-- ============================================================

-- Cost C1: PRY004, equipment rental paid by Partner C, PEN
INSERT INTO costs (project_id, valuation_id, bank_account_id, entity_id, cost_type, date, title, igv_rate, currency, exchange_rate, comprobante_type, comprobante_number, payment_method, document_ref, due_date)
VALUES (
  (SELECT id FROM projects WHERE project_code = 'PRY004'),
  (SELECT id FROM valuations WHERE project_id = (SELECT id FROM projects WHERE project_code = 'PRY004') AND valuation_number = 1),
  (SELECT id FROM bank_accounts WHERE account_number_last4 = '0006'),
  (SELECT id FROM entities WHERE document_number = '20456789044'),
  'project_cost', '2026-01-20', 'Alquiler retroexcavadora — enero', 18.00, 'PEN', 3.70,
  'factura', 'M001-00098', 'bank_transfer', 'PRY004-AP-005', '2026-02-20'
);

INSERT INTO cost_items (cost_id, title, category, quantity, unit_of_measure, unit_price, subtotal) VALUES
  ((SELECT id FROM costs WHERE document_ref = 'PRY004-AP-005'), 'Retroexcavadora JCB 3CX — 15 días', 'equipment_rental', 15.00, 'day', 950.00, 14250.00);

-- Cost C2: PRY004, subcontractor paid by Partner C, PEN
INSERT INTO costs (project_id, valuation_id, bank_account_id, entity_id, cost_type, date, title, igv_rate, currency, exchange_rate, comprobante_type, comprobante_number, payment_method, document_ref, due_date)
VALUES (
  (SELECT id FROM projects WHERE project_code = 'PRY004'),
  (SELECT id FROM valuations WHERE project_id = (SELECT id FROM projects WHERE project_code = 'PRY004') AND valuation_number = 2),
  (SELECT id FROM bank_accounts WHERE account_number_last4 = '0006'),
  (SELECT id FROM entities WHERE document_number = '45678901'),
  'project_cost', '2026-02-18', 'Trabajos civiles — cimiento corrido', 0.00, 'PEN', 3.72,
  'recibo_por_honorarios', 'RH-JP-001', 'bank_transfer', 'PRY004-AP-006', '2026-03-10'
);

INSERT INTO cost_items (cost_id, title, category, quantity, unit_of_measure, unit_price, subtotal) VALUES
  ((SELECT id FROM costs WHERE document_ref = 'PRY004-AP-006'), 'Cimiento corrido — mano de obra civil', 'subcontractor', 1.00, 'glb', 18500.00, 18500.00);

-- ============================================================
-- 5. Costs paid by Partner B (PRY005 — USD)
-- ============================================================

-- Cost B3: PRY005, materials paid by Partner B, USD
INSERT INTO costs (project_id, valuation_id, bank_account_id, entity_id, cost_type, date, title, igv_rate, detraccion_rate, currency, exchange_rate, comprobante_type, comprobante_number, payment_method, document_ref, due_date)
VALUES (
  (SELECT id FROM projects WHERE project_code = 'PRY005'),
  (SELECT id FROM valuations WHERE project_id = (SELECT id FROM projects WHERE project_code = 'PRY005') AND valuation_number = 1),
  (SELECT id FROM bank_accounts WHERE account_number_last4 = '0007'),
  (SELECT id FROM entities WHERE document_number = '20456789022'),
  'project_cost', '2026-01-25', 'Acero estructural para módulo', 18.00, 4.00, 'USD', 3.70,
  'factura', 'F002-00612', 'bank_transfer', 'PRY005-AP-004', '2026-02-25'
);

INSERT INTO cost_items (cost_id, title, category, quantity, unit_of_measure, unit_price, subtotal) VALUES
  ((SELECT id FROM costs WHERE document_ref = 'PRY005-AP-004'), 'Perfiles de acero W8x18', 'materials', 16.00, 'unit', 380.00, 6080.00),
  ((SELECT id FROM costs WHERE document_ref = 'PRY005-AP-004'), 'Plancha de acero A36 1/4"', 'materials', 8.00, 'unit', 290.00, 2320.00);

-- ============================================================
-- 6. Costs paid by Partner C (PRY005 — USD)
-- ============================================================

-- Cost C3: PRY005, permits paid by Partner C, USD
INSERT INTO costs (project_id, valuation_id, bank_account_id, entity_id, cost_type, date, title, igv_rate, currency, exchange_rate, comprobante_type, comprobante_number, payment_method, document_ref, due_date)
VALUES (
  (SELECT id FROM projects WHERE project_code = 'PRY005'),
  (SELECT id FROM valuations WHERE project_id = (SELECT id FROM projects WHERE project_code = 'PRY005') AND valuation_number = 1),
  (SELECT id FROM bank_accounts WHERE account_number_last4 = '0008'),
  (SELECT id FROM entities WHERE document_number = '20100100100'),
  'project_cost', '2026-01-12', 'Licencia de construcción y permisos', 18.00, 'USD', 3.70,
  'factura', 'F-MPA-2026-001', 'bank_transfer', 'PRY005-AP-005', '2026-02-12'
);

INSERT INTO cost_items (cost_id, title, category, quantity, unit_of_measure, unit_price, subtotal) VALUES
  ((SELECT id FROM costs WHERE document_ref = 'PRY005-AP-005'), 'Licencia de construcción módulo policial', 'permits_regulatory', 1.00, 'glb', 3200.00, 3200.00),
  ((SELECT id FROM costs WHERE document_ref = 'PRY005-AP-005'), 'Tasa de supervisión ProInversión', 'permits_regulatory', 1.00, 'glb', 1800.00, 1800.00);

-- ============================================================
-- 7. Payments for the partner costs
-- ============================================================

-- Payment B1: Partner B pays labor cost (Cost B1), PEN — full
INSERT INTO payments (related_to, related_id, direction, payment_type, payment_date, amount, currency, exchange_rate, bank_account_id, partner_company_id) VALUES
  ('cost',
   (SELECT id FROM costs WHERE title = 'Mano de obra — cuadrilla Partner B'),
   'outbound', 'regular', '2026-01-30',
   14850.00, 'PEN', 3.70,
   (SELECT id FROM bank_accounts WHERE account_number_last4 = '0005'),
   (SELECT id FROM partner_companies WHERE ruc = '20000000002'));

-- Payment B2: Partner B partial payment on materials (Cost B2), PEN
INSERT INTO payments (related_to, related_id, direction, payment_type, payment_date, amount, currency, exchange_rate, bank_account_id, partner_company_id) VALUES
  ('cost',
   (SELECT id FROM costs WHERE document_ref = 'PRY004-AP-004'),
   'outbound', 'regular', '2026-02-24',
   5000.00, 'PEN', 3.72,
   (SELECT id FROM bank_accounts WHERE account_number_last4 = '0005'),
   (SELECT id FROM partner_companies WHERE ruc = '20000000002'));

-- Payment C1: Partner C pays equipment rental (Cost C1), PEN — full
INSERT INTO payments (related_to, related_id, direction, payment_type, payment_date, amount, currency, exchange_rate, bank_account_id, partner_company_id) VALUES
  ('cost',
   (SELECT id FROM costs WHERE document_ref = 'PRY004-AP-005'),
   'outbound', 'regular', '2026-02-18',
   16815.00, 'PEN', 3.70,
   (SELECT id FROM bank_accounts WHERE account_number_last4 = '0006'),
   (SELECT id FROM partner_companies WHERE ruc = '20000000003'));

-- Payment B3: Partner B pays steel for PRY005 (Cost B3), USD — full
INSERT INTO payments (related_to, related_id, direction, payment_type, payment_date, amount, currency, exchange_rate, bank_account_id, partner_company_id) VALUES
  ('cost',
   (SELECT id FROM costs WHERE document_ref = 'PRY005-AP-004'),
   'outbound', 'regular', '2026-02-24',
   9912.00, 'USD', 3.70,
   (SELECT id FROM bank_accounts WHERE account_number_last4 = '0007'),
   (SELECT id FROM partner_companies WHERE ruc = '20000000002'));

-- Payment C2: Partner C pays permits for PRY005 (Cost C3), USD — full
INSERT INTO payments (related_to, related_id, direction, payment_type, payment_date, amount, currency, exchange_rate, bank_account_id, partner_company_id) VALUES
  ('cost',
   (SELECT id FROM costs WHERE document_ref = 'PRY005-AP-005'),
   'outbound', 'regular', '2026-02-10',
   5900.00, 'USD', 3.70,
   (SELECT id FROM bank_accounts WHERE account_number_last4 = '0008'),
   (SELECT id FROM partner_companies WHERE ruc = '20000000003'));

-- ============================================================
-- 8. AR Invoices from Partner B and C (for income distribution)
-- ============================================================

-- AR B1: Partner B invoices for PRY004, PEN
INSERT INTO ar_invoices (project_id, valuation_id, bank_account_id, entity_id, partner_company_id, invoice_number, comprobante_type, invoice_date, due_date, subtotal, igv_rate, detraccion_rate, retencion_applicable, currency, exchange_rate, document_ref, is_internal_settlement)
VALUES (
  (SELECT id FROM projects WHERE project_code = 'PRY004'),
  (SELECT id FROM valuations WHERE project_id = (SELECT id FROM projects WHERE project_code = 'PRY004') AND valuation_number = 1),
  (SELECT id FROM bank_accounts WHERE account_number_last4 = '0005'),
  (SELECT id FROM entities WHERE document_number = '20456789066'),
  (SELECT id FROM partner_companies WHERE ruc = '20000000002'),
  'FB01-00012', 'factura', '2026-01-20', '2026-02-20',
  45000.00, 18.00, 4.00, false, 'PEN', 3.70, 'PRY004-AR-003', false
);

-- AR C1: Partner C invoices for PRY004, PEN
INSERT INTO ar_invoices (project_id, valuation_id, bank_account_id, entity_id, partner_company_id, invoice_number, comprobante_type, invoice_date, due_date, subtotal, igv_rate, detraccion_rate, retencion_applicable, currency, exchange_rate, document_ref, is_internal_settlement)
VALUES (
  (SELECT id FROM projects WHERE project_code = 'PRY004'),
  (SELECT id FROM valuations WHERE project_id = (SELECT id FROM projects WHERE project_code = 'PRY004') AND valuation_number = 2),
  (SELECT id FROM bank_accounts WHERE account_number_last4 = '0006'),
  (SELECT id FROM entities WHERE document_number = '20456789066'),
  (SELECT id FROM partner_companies WHERE ruc = '20000000003'),
  'FC01-00008', 'factura', '2026-02-25', '2026-03-25',
  38000.00, 18.00, 4.00, false, 'PEN', 3.72, 'PRY004-AR-004', false
);

-- AR B2: Partner B invoices for PRY005, USD
INSERT INTO ar_invoices (project_id, valuation_id, bank_account_id, entity_id, partner_company_id, invoice_number, comprobante_type, invoice_date, due_date, subtotal, igv_rate, detraccion_rate, retencion_applicable, retencion_rate, currency, exchange_rate, document_ref, is_internal_settlement)
VALUES (
  (SELECT id FROM projects WHERE project_code = 'PRY005'),
  (SELECT id FROM valuations WHERE project_id = (SELECT id FROM projects WHERE project_code = 'PRY005') AND valuation_number = 1),
  (SELECT id FROM bank_accounts WHERE account_number_last4 = '0007'),
  (SELECT id FROM entities WHERE document_number = '20100100100'),
  (SELECT id FROM partner_companies WHERE ruc = '20000000002'),
  'FB01-00013', 'factura', '2026-02-01', '2026-03-01',
  18000.00, 18.00, 4.00, true, 3.00, 'USD', 3.70, 'PRY005-AR-003', false
);

-- Inbound payment on Partner B's AR for PRY004 — partial
INSERT INTO payments (related_to, related_id, direction, payment_type, payment_date, amount, currency, exchange_rate, bank_account_id, partner_company_id) VALUES
  ('ar_invoice',
   (SELECT id FROM ar_invoices WHERE document_ref = 'PRY004-AR-003'),
   'inbound', 'regular', '2026-02-18',
   30000.00, 'PEN', 3.70,
   (SELECT id FROM bank_accounts WHERE account_number_last4 = '0005'),
   (SELECT id FROM partner_companies WHERE ruc = '20000000002'));

-- Inbound payment on Partner B's AR for PRY005 — partial
INSERT INTO payments (related_to, related_id, direction, payment_type, payment_date, amount, currency, exchange_rate, bank_account_id, partner_company_id) VALUES
  ('ar_invoice',
   (SELECT id FROM ar_invoices WHERE document_ref = 'PRY005-AR-003'),
   'inbound', 'regular', '2026-03-01',
   10000.00, 'USD', 3.72,
   (SELECT id FROM bank_accounts WHERE account_number_last4 = '0007'),
   (SELECT id FROM partner_companies WHERE ruc = '20000000002'));
