-- Migration: Insert dummy data for testing dual-currency features
-- Purpose: Populate all transaction tables with realistic PEN + USD data
-- Rollback: DELETE FROM tables in reverse dependency order

-- ============================================================
-- 1. Entities (8 rows)
-- ============================================================

INSERT INTO entities (entity_type, document_type, document_number, legal_name, common_name, city, region) VALUES
  ('company', 'RUC', '20456789011', 'Concretos del Sur SAC', 'Concretos del Sur', 'Arequipa', 'Arequipa'),
  ('company', 'RUC', '20456789022', 'Aceros Arequipa SAC', 'Aceros Arequipa', 'Arequipa', 'Arequipa'),
  ('company', 'RUC', '20456789033', 'Electro Instalaciones EIRL', 'Electro Instalaciones', 'Arequipa', 'Arequipa'),
  ('company', 'RUC', '20456789044', 'Maquinarias Pesadas SAC', 'Maquinarias Pesadas', 'Arequipa', 'Arequipa'),
  ('individual', 'DNI', '45678901', 'Juan Pérez Torres', NULL, 'Arequipa', 'Arequipa'),
  ('company', 'RUC', '20100100100', 'Municipalidad Provincial de Arequipa', 'Municipalidad Arequipa', 'Arequipa', 'Arequipa'),
  ('company', 'RUC', '20456789066', 'Inmobiliaria Los Andes SAC', 'Los Andes', 'Arequipa', 'Arequipa'),
  ('company', 'RUC', '20456789077', 'Supervisión & Control SAC', 'Supervisión & Control', 'Arequipa', 'Arequipa');

-- ============================================================
-- 2. Entity Contacts (8 rows — 1 primary per entity)
-- ============================================================

INSERT INTO entity_contacts (entity_id, full_name, role, phone, is_primary) VALUES
  ((SELECT id FROM entities WHERE document_number = '20456789011'), 'Roberto Cáceres', 'Gerente de Ventas', '954111001', true),
  ((SELECT id FROM entities WHERE document_number = '20456789022'), 'María Luisa Fernández', 'Ejecutiva Comercial', '954111002', true),
  ((SELECT id FROM entities WHERE document_number = '20456789033'), 'Pedro Quispe', 'Gerente General', '954111003', true),
  ((SELECT id FROM entities WHERE document_number = '20456789044'), 'Luis Mamani', 'Jefe de Operaciones', '954111004', true),
  ((SELECT id FROM entities WHERE document_number = '45678901'), 'Juan Pérez Torres', NULL, '954111005', true),
  ((SELECT id FROM entities WHERE document_number = '20100100100'), 'Ing. Carlos Ramos', 'Sub Gerente de Obras', '054-215000', true),
  ((SELECT id FROM entities WHERE document_number = '20456789066'), 'Fernando Delgado', 'Gerente de Proyectos', '954111007', true),
  ((SELECT id FROM entities WHERE document_number = '20456789077'), 'Ing. Ana Villanueva', 'Supervisora Principal', '954111008', true);

-- ============================================================
-- 3. Entity Tags (8 rows)
-- ============================================================

INSERT INTO entity_tags (entity_id, tag_id) VALUES
  ((SELECT id FROM entities WHERE document_number = '20456789011'), (SELECT id FROM tags WHERE name = 'concrete_supplier')),
  ((SELECT id FROM entities WHERE document_number = '20456789022'), (SELECT id FROM tags WHERE name = 'metal_supplier')),
  ((SELECT id FROM entities WHERE document_number = '20456789033'), (SELECT id FROM tags WHERE name = 'electrical_subcontractor')),
  ((SELECT id FROM entities WHERE document_number = '20456789044'), (SELECT id FROM tags WHERE name = 'equipment_rental')),
  ((SELECT id FROM entities WHERE document_number = '45678901'), (SELECT id FROM tags WHERE name = 'civil_works_subcontractor')),
  ((SELECT id FROM entities WHERE document_number = '20100100100'), (SELECT id FROM tags WHERE name = 'client')),
  ((SELECT id FROM entities WHERE document_number = '20456789066'), (SELECT id FROM tags WHERE name = 'client')),
  ((SELECT id FROM entities WHERE document_number = '20456789077'), (SELECT id FROM tags WHERE name = 'government_supervisor'));

-- ============================================================
-- 4. Projects (3 rows)
-- ============================================================

INSERT INTO projects (project_code, name, project_type, status, client_entity_id, contract_value, contract_currency, start_date, expected_end_date, location) VALUES
  ('PRY004', 'Pavimentación Av. Los Incas', 'subcontractor', 'active',
    (SELECT id FROM entities WHERE document_number = '20456789066'),
    850000.00, 'PEN', '2026-01-05', '2026-06-30', 'Arequipa'),
  ('PRY005', 'Módulo Policial Cerro Colorado', 'oxi', 'active',
    (SELECT id FROM entities WHERE document_number = '20100100100'),
    280000.00, 'USD', '2026-01-10', '2026-09-30', 'Cerro Colorado, Arequipa'),
  ('PRY006', 'Veredas Jr. Bolognesi', 'subcontractor', 'completed',
    (SELECT id FROM entities WHERE document_number = '20456789066'),
    320000.00, 'PEN', '2025-10-01', '2026-01-31', 'Arequipa');

-- ============================================================
-- 5. Project Entities (6 rows — link suppliers/clients to projects)
-- ============================================================

INSERT INTO project_entities (project_id, entity_id, tag_id, start_date) VALUES
  ((SELECT id FROM projects WHERE project_code = 'PRY004'), (SELECT id FROM entities WHERE document_number = '20456789011'), (SELECT id FROM tags WHERE name = 'concrete_supplier'), '2026-01-05'),
  ((SELECT id FROM projects WHERE project_code = 'PRY004'), (SELECT id FROM entities WHERE document_number = '20456789022'), (SELECT id FROM tags WHERE name = 'metal_supplier'), '2026-01-15'),
  ((SELECT id FROM projects WHERE project_code = 'PRY004'), (SELECT id FROM entities WHERE document_number = '20456789033'), (SELECT id FROM tags WHERE name = 'electrical_subcontractor'), '2026-02-01'),
  ((SELECT id FROM projects WHERE project_code = 'PRY005'), (SELECT id FROM entities WHERE document_number = '20456789022'), (SELECT id FROM tags WHERE name = 'metal_supplier'), '2026-01-10'),
  ((SELECT id FROM projects WHERE project_code = 'PRY005'), (SELECT id FROM entities WHERE document_number = '20456789044'), (SELECT id FROM tags WHERE name = 'equipment_rental'), '2026-01-15'),
  ((SELECT id FROM projects WHERE project_code = 'PRY005'), (SELECT id FROM entities WHERE document_number = '20456789033'), (SELECT id FROM tags WHERE name = 'electrical_subcontractor'), '2026-02-01');

-- ============================================================
-- 6. Valuations (5 rows)
-- ============================================================

INSERT INTO valuations (project_id, valuation_number, period_month, period_year, status, billed_value, billed_currency, date_closed) VALUES
  ((SELECT id FROM projects WHERE project_code = 'PRY004'), 1, 1, 2026, 'closed', 180000.00, 'PEN', '2026-02-05'),
  ((SELECT id FROM projects WHERE project_code = 'PRY004'), 2, 2, 2026, 'open', NULL, 'PEN', NULL),
  ((SELECT id FROM projects WHERE project_code = 'PRY005'), 1, 1, 2026, 'closed', 55000.00, 'USD', '2026-02-10'),
  ((SELECT id FROM projects WHERE project_code = 'PRY005'), 2, 2, 2026, 'open', NULL, 'USD', NULL),
  ((SELECT id FROM projects WHERE project_code = 'PRY006'), 1, 1, 2026, 'closed', 320000.00, 'PEN', '2026-01-31');

-- ============================================================
-- 7. Costs (10 rows)
-- ============================================================

-- Cost 1: PRY004, concrete, PEN, overdue, will be fully paid
INSERT INTO costs (project_id, valuation_id, bank_account_id, entity_id, cost_type, date, title, igv_rate, detraccion_rate, currency, exchange_rate, comprobante_type, comprobante_number, payment_method, document_ref, due_date)
VALUES (
  (SELECT id FROM projects WHERE project_code = 'PRY004'),
  (SELECT id FROM valuations WHERE project_id = (SELECT id FROM projects WHERE project_code = 'PRY004') AND valuation_number = 1),
  (SELECT id FROM bank_accounts WHERE account_number_last4 = '0001'),
  (SELECT id FROM entities WHERE document_number = '20456789011'),
  'project_cost', '2026-01-10', 'Concrete delivery Batch 1', 18.00, 4.00, 'PEN', 3.70,
  'factura', 'F001-00234', 'bank_transfer', 'PRY004-AP-001', '2026-01-20'
);

-- Cost 2: PRY004, steel rebar, PEN, due today, partial payment
INSERT INTO costs (project_id, valuation_id, bank_account_id, entity_id, cost_type, date, title, igv_rate, detraccion_rate, currency, exchange_rate, comprobante_type, comprobante_number, payment_method, document_ref, due_date)
VALUES (
  (SELECT id FROM projects WHERE project_code = 'PRY004'),
  (SELECT id FROM valuations WHERE project_id = (SELECT id FROM projects WHERE project_code = 'PRY004') AND valuation_number = 2),
  (SELECT id FROM bank_accounts WHERE account_number_last4 = '0001'),
  (SELECT id FROM entities WHERE document_number = '20456789022'),
  'project_cost', '2026-02-15', 'Steel rebar 1/2" x 9m', 18.00, 4.00, 'PEN', 3.72,
  'factura', 'F001-01456', 'bank_transfer', 'PRY004-AP-002', '2026-03-03'
);

-- Cost 3: PRY004, electrical sub, PEN, this week, pending
INSERT INTO costs (project_id, valuation_id, bank_account_id, entity_id, cost_type, date, title, igv_rate, currency, exchange_rate, comprobante_type, comprobante_number, payment_method, document_ref, due_date)
VALUES (
  (SELECT id FROM projects WHERE project_code = 'PRY004'),
  (SELECT id FROM valuations WHERE project_id = (SELECT id FROM projects WHERE project_code = 'PRY004') AND valuation_number = 2),
  (SELECT id FROM bank_accounts WHERE account_number_last4 = '0001'),
  (SELECT id FROM entities WHERE document_number = '20456789033'),
  'project_cost', '2026-02-20', 'Electrical installation Phase 1', 18.00, 'PEN', 3.72,
  'factura', 'E001-00089', 'bank_transfer', 'PRY004-AP-003', '2026-03-06'
);

-- Cost 4: PRY004, day labor, PEN, overdue, pending
INSERT INTO costs (project_id, valuation_id, bank_account_id, cost_type, date, title, igv_rate, currency, exchange_rate, comprobante_type, payment_method, due_date, notes)
VALUES (
  (SELECT id FROM projects WHERE project_code = 'PRY004'),
  (SELECT id FROM valuations WHERE project_id = (SELECT id FROM projects WHERE project_code = 'PRY004') AND valuation_number = 2),
  (SELECT id FROM bank_accounts WHERE account_number_last4 = '0001'),
  'project_cost', '2026-02-28', 'Day labor February', 0.00, 'PEN', 3.72,
  'planilla_jornales', 'cash', '2026-02-28', '12 workers x 20 days'
);

-- Cost 5: PRY005, imported steel, USD, future, pending
INSERT INTO costs (project_id, valuation_id, bank_account_id, entity_id, cost_type, date, title, igv_rate, detraccion_rate, currency, exchange_rate, comprobante_type, comprobante_number, payment_method, document_ref, due_date)
VALUES (
  (SELECT id FROM projects WHERE project_code = 'PRY005'),
  (SELECT id FROM valuations WHERE project_id = (SELECT id FROM projects WHERE project_code = 'PRY005') AND valuation_number = 1),
  (SELECT id FROM bank_accounts WHERE account_number_last4 = '0003'),
  (SELECT id FROM entities WHERE document_number = '20456789022'),
  'project_cost', '2026-02-01', 'Imported steel beams W10x22', 18.00, 4.00, 'USD', 3.70,
  'factura', 'F002-00567', 'bank_transfer', 'PRY005-AP-001', '2026-03-15'
);

-- Cost 6: PRY005, equipment rental, USD, future, pending
INSERT INTO costs (project_id, valuation_id, bank_account_id, entity_id, cost_type, date, title, igv_rate, currency, exchange_rate, comprobante_type, comprobante_number, payment_method, document_ref, due_date)
VALUES (
  (SELECT id FROM projects WHERE project_code = 'PRY005'),
  (SELECT id FROM valuations WHERE project_id = (SELECT id FROM projects WHERE project_code = 'PRY005') AND valuation_number = 2),
  (SELECT id FROM bank_accounts WHERE account_number_last4 = '0003'),
  (SELECT id FROM entities WHERE document_number = '20456789044'),
  'project_cost', '2026-02-20', 'CAT 320 excavator rental — Feb', 18.00, 'USD', 3.72,
  'factura', 'M001-00123', 'bank_transfer', 'PRY005-AP-002', '2026-04-01'
);

-- Cost 7: PRY005, electrical materials, USD, future, pending
INSERT INTO costs (project_id, valuation_id, bank_account_id, entity_id, cost_type, date, title, igv_rate, currency, exchange_rate, comprobante_type, comprobante_number, payment_method, document_ref, due_date)
VALUES (
  (SELECT id FROM projects WHERE project_code = 'PRY005'),
  (SELECT id FROM valuations WHERE project_id = (SELECT id FROM projects WHERE project_code = 'PRY005') AND valuation_number = 2),
  (SELECT id FROM bank_accounts WHERE account_number_last4 = '0003'),
  (SELECT id FROM entities WHERE document_number = '20456789033'),
  'project_cost', '2026-02-25', 'Electrical materials — cables and panels', 18.00, 'USD', 3.72,
  'factura', 'E001-00090', 'bank_transfer', 'PRY005-AP-003', '2026-03-20'
);

-- Cost 8: PRY006, concrete finishing, PEN, paid (completed project)
INSERT INTO costs (project_id, valuation_id, bank_account_id, entity_id, cost_type, date, title, igv_rate, detraccion_rate, currency, exchange_rate, comprobante_type, comprobante_number, payment_method, document_ref, due_date)
VALUES (
  (SELECT id FROM projects WHERE project_code = 'PRY006'),
  (SELECT id FROM valuations WHERE project_id = (SELECT id FROM projects WHERE project_code = 'PRY006') AND valuation_number = 1),
  (SELECT id FROM bank_accounts WHERE account_number_last4 = '0001'),
  (SELECT id FROM entities WHERE document_number = '20456789011'),
  'project_cost', '2026-01-05', 'Concrete finishing — veredas', 18.00, 4.00, 'PEN', 3.68,
  'factura', 'F001-00198', 'bank_transfer', 'PRY006-AP-001', '2026-01-15'
);

-- Cost 9: SG&A, software license, PEN, future, pending
INSERT INTO costs (bank_account_id, cost_type, date, title, igv_rate, currency, exchange_rate, comprobante_type, comprobante_number, payment_method, due_date)
VALUES (
  (SELECT id FROM bank_accounts WHERE account_number_last4 = '0001'),
  'sga', '2026-03-01', 'Accounting software Contasis — March', 0.00, 'PEN', 3.72,
  'boleta', 'B001-00456', 'bank_transfer', '2026-03-31'
);

-- Cost 10: SG&A, legal advisory, USD, future, pending
INSERT INTO costs (bank_account_id, entity_id, cost_type, date, title, igv_rate, currency, exchange_rate, comprobante_type, comprobante_number, payment_method, due_date)
VALUES (
  (SELECT id FROM bank_accounts WHERE account_number_last4 = '0003'),
  NULL,
  'sga', '2026-03-01', 'Legal advisory retainer — Q1 2026', 18.00, 'USD', 3.72,
  'recibo_por_honorarios', 'RH-001-2026', 'bank_transfer', '2026-04-15'
);

-- ============================================================
-- 8. Cost Items (15 rows)
-- ============================================================

-- Cost 1 items (concrete delivery)
INSERT INTO cost_items (cost_id, title, category, quantity, unit_of_measure, unit_price, subtotal) VALUES
  ((SELECT id FROM costs WHERE document_ref = 'PRY004-AP-001'), 'Concreto premezclado f''c=210 kg/cm2', 'materials', 85.00, 'm3', 420.00, 35700.00),
  ((SELECT id FROM costs WHERE document_ref = 'PRY004-AP-001'), 'Servicio de bombeo', 'materials', 85.00, 'm3', 35.00, 2975.00);

-- Cost 2 items (steel rebar)
INSERT INTO cost_items (cost_id, title, category, quantity, unit_of_measure, unit_price, subtotal) VALUES
  ((SELECT id FROM costs WHERE document_ref = 'PRY004-AP-002'), 'Acero corrugado 1/2" x 9m', 'materials', 500.00, 'varilla', 32.50, 16250.00),
  ((SELECT id FROM costs WHERE document_ref = 'PRY004-AP-002'), 'Alambre de amarre #16', 'materials', 100.00, 'kg', 5.80, 580.00);

-- Cost 3 items (electrical sub)
INSERT INTO cost_items (cost_id, title, category, quantity, unit_of_measure, unit_price, subtotal) VALUES
  ((SELECT id FROM costs WHERE document_ref = 'PRY004-AP-003'), 'Electrical installation Phase 1 — labor and materials', 'subcontractor', 1.00, 'glb', 22000.00, 22000.00);

-- Cost 4 items (day labor) — no entity, planilla
INSERT INTO cost_items (cost_id, title, category, quantity, unit_of_measure, unit_price, subtotal) VALUES
  ((SELECT id FROM costs WHERE title = 'Day labor February' AND date = '2026-02-28'), 'Jornales — peones', 'labor', 200.00, 'jornal', 65.00, 13000.00),
  ((SELECT id FROM costs WHERE title = 'Day labor February' AND date = '2026-02-28'), 'Jornales — operarios', 'labor', 40.00, 'jornal', 95.00, 3800.00);

-- Cost 5 items (imported steel beams, USD)
INSERT INTO cost_items (cost_id, title, category, quantity, unit_of_measure, unit_price, subtotal) VALUES
  ((SELECT id FROM costs WHERE document_ref = 'PRY005-AP-001'), 'Steel beams W10x22', 'materials', 24.00, 'unit', 485.00, 11640.00),
  ((SELECT id FROM costs WHERE document_ref = 'PRY005-AP-001'), 'Freight and customs clearance', 'materials', 1.00, 'glb', 1200.00, 1200.00);

-- Cost 6 items (excavator rental, USD)
INSERT INTO cost_items (cost_id, title, category, quantity, unit_of_measure, unit_price, subtotal) VALUES
  ((SELECT id FROM costs WHERE document_ref = 'PRY005-AP-002'), 'CAT 320 excavator — February rental', 'equipment_rental', 20.00, 'day', 350.00, 7000.00);

-- Cost 7 items (electrical materials, USD)
INSERT INTO cost_items (cost_id, title, category, quantity, unit_of_measure, unit_price, subtotal) VALUES
  ((SELECT id FROM costs WHERE document_ref = 'PRY005-AP-003'), 'Cable NYY 3x6mm2', 'materials', 500.00, 'm', 4.20, 2100.00),
  ((SELECT id FROM costs WHERE document_ref = 'PRY005-AP-003'), 'Electrical panel 12-circuit', 'materials', 4.00, 'unit', 280.00, 1120.00);

-- Cost 8 items (concrete finishing, completed project)
INSERT INTO cost_items (cost_id, title, category, quantity, unit_of_measure, unit_price, subtotal) VALUES
  ((SELECT id FROM costs WHERE document_ref = 'PRY006-AP-001'), 'Concreto para veredas f''c=175', 'materials', 120.00, 'm3', 380.00, 45600.00);

-- Cost 9 items (software, SG&A)
INSERT INTO cost_items (cost_id, title, category, subtotal) VALUES
  ((SELECT id FROM costs WHERE title = 'Accounting software Contasis — March'), 'Contasis monthly license', 'software_licenses', 350.00);

-- Cost 10 items (legal advisory, SG&A, USD)
INSERT INTO cost_items (cost_id, title, category, subtotal) VALUES
  ((SELECT id FROM costs WHERE title = 'Legal advisory retainer — Q1 2026'), 'Legal retainer fee — Q1', 'professional_services', 2500.00);

-- ============================================================
-- 9. AR Invoices (4 rows)
-- ============================================================

-- AR 1: PRY004, PEN, current (due 2026-03-15)
INSERT INTO ar_invoices (project_id, valuation_id, bank_account_id, entity_id, partner_company_id, invoice_number, comprobante_type, invoice_date, due_date, subtotal, igv_rate, detraccion_rate, retencion_applicable, currency, exchange_rate, document_ref, is_internal_settlement)
VALUES (
  (SELECT id FROM projects WHERE project_code = 'PRY004'),
  (SELECT id FROM valuations WHERE project_id = (SELECT id FROM projects WHERE project_code = 'PRY004') AND valuation_number = 2),
  (SELECT id FROM bank_accounts WHERE account_number_last4 = '0001'),
  (SELECT id FROM entities WHERE document_number = '20456789066'),
  (SELECT id FROM partner_companies WHERE ruc = '20000000001'),
  'F001-00045', 'factura', '2026-02-15', '2026-03-15',
  152542.37, 18.00, 4.00, false, 'PEN', 3.72, 'PRY004-AR-002', false
);

-- AR 2: PRY004, PEN, 90+ days overdue (due 2026-01-18)
INSERT INTO ar_invoices (project_id, valuation_id, bank_account_id, entity_id, partner_company_id, invoice_number, comprobante_type, invoice_date, due_date, subtotal, igv_rate, detraccion_rate, retencion_applicable, currency, exchange_rate, document_ref, is_internal_settlement)
VALUES (
  (SELECT id FROM projects WHERE project_code = 'PRY004'),
  (SELECT id FROM valuations WHERE project_id = (SELECT id FROM projects WHERE project_code = 'PRY004') AND valuation_number = 1),
  (SELECT id FROM bank_accounts WHERE account_number_last4 = '0001'),
  (SELECT id FROM entities WHERE document_number = '20456789066'),
  (SELECT id FROM partner_companies WHERE ruc = '20000000001'),
  'F001-00038', 'factura', '2026-01-01', '2026-01-18',
  84745.76, 18.00, 4.00, false, 'PEN', 3.68, 'PRY004-AR-001', false
);

-- AR 3: PRY005, USD, 31-60 days overdue (due 2026-02-01)
INSERT INTO ar_invoices (project_id, valuation_id, bank_account_id, entity_id, partner_company_id, invoice_number, comprobante_type, invoice_date, due_date, subtotal, igv_rate, detraccion_rate, retencion_applicable, retencion_rate, currency, exchange_rate, document_ref, is_internal_settlement)
VALUES (
  (SELECT id FROM projects WHERE project_code = 'PRY005'),
  (SELECT id FROM valuations WHERE project_id = (SELECT id FROM projects WHERE project_code = 'PRY005') AND valuation_number = 1),
  (SELECT id FROM bank_accounts WHERE account_number_last4 = '0003'),
  (SELECT id FROM entities WHERE document_number = '20100100100'),
  (SELECT id FROM partner_companies WHERE ruc = '20000000001'),
  'F001-00040', 'factura', '2026-01-15', '2026-02-01',
  46610.17, 18.00, 4.00, true, 3.00, 'USD', 3.70, 'PRY005-AR-001', false
);

-- AR 4: PRY005, USD, 61-90 days overdue (due 2026-01-20)
INSERT INTO ar_invoices (project_id, valuation_id, bank_account_id, entity_id, partner_company_id, invoice_number, comprobante_type, invoice_date, due_date, subtotal, igv_rate, detraccion_rate, retencion_applicable, retencion_rate, currency, exchange_rate, document_ref, is_internal_settlement)
VALUES (
  (SELECT id FROM projects WHERE project_code = 'PRY005'),
  (SELECT id FROM valuations WHERE project_id = (SELECT id FROM projects WHERE project_code = 'PRY005') AND valuation_number = 1),
  (SELECT id FROM bank_accounts WHERE account_number_last4 = '0003'),
  (SELECT id FROM entities WHERE document_number = '20100100100'),
  (SELECT id FROM partner_companies WHERE ruc = '20000000001'),
  'F001-00039', 'factura', '2026-01-01', '2026-01-20',
  33898.31, 18.00, 4.00, true, 3.00, 'USD', 3.70, 'PRY005-AR-002', false
);

-- ============================================================
-- 10. Payments (12 rows)
-- ============================================================

-- Payment 1: Outbound regular — pay concrete supplier (Cost 1), PEN, full payment
INSERT INTO payments (related_to, related_id, direction, payment_type, payment_date, amount, currency, exchange_rate, bank_account_id, partner_company_id, notes) VALUES
  ('cost',
   (SELECT id FROM costs WHERE document_ref = 'PRY004-AP-001'),
   'outbound', 'regular', '2026-01-18',
   45636.50, 'PEN', 3.70,
   (SELECT id FROM bank_accounts WHERE account_number_last4 = '0001'),
   (SELECT id FROM partner_companies WHERE ruc = '20000000001'),
   'Full payment concrete Batch 1 (net of detraccion)');

-- Payment 2: Outbound detraccion — deposit to concrete supplier BdN (Cost 1), PEN
INSERT INTO payments (related_to, related_id, direction, payment_type, payment_date, amount, currency, exchange_rate, bank_account_id, partner_company_id, notes) VALUES
  ('cost',
   (SELECT id FROM costs WHERE document_ref = 'PRY004-AP-001'),
   'outbound', 'detraccion', '2026-01-19',
   1827.00, 'PEN', 3.70,
   (SELECT id FROM bank_accounts WHERE account_number_last4 = '0004'),
   (SELECT id FROM partner_companies WHERE ruc = '20000000001'),
   'Detraccion deposit to supplier BdN account');

-- Payment 3: Outbound regular — partial pay steel rebar (Cost 2), PEN
INSERT INTO payments (related_to, related_id, direction, payment_type, payment_date, amount, currency, exchange_rate, bank_account_id, partner_company_id) VALUES
  ('cost',
   (SELECT id FROM costs WHERE document_ref = 'PRY004-AP-002'),
   'outbound', 'regular', '2026-02-25',
   10000.00, 'PEN', 3.72,
   (SELECT id FROM bank_accounts WHERE account_number_last4 = '0001'),
   (SELECT id FROM partner_companies WHERE ruc = '20000000001'));

-- Payment 4: Outbound regular — pay completed project concrete (Cost 8), PEN
INSERT INTO payments (related_to, related_id, direction, payment_type, payment_date, amount, currency, exchange_rate, bank_account_id, partner_company_id) VALUES
  ('cost',
   (SELECT id FROM costs WHERE document_ref = 'PRY006-AP-001'),
   'outbound', 'regular', '2026-01-14',
   51667.20, 'PEN', 3.68,
   (SELECT id FROM bank_accounts WHERE account_number_last4 = '0001'),
   (SELECT id FROM partner_companies WHERE ruc = '20000000001'));

-- Payment 5: Outbound detraccion — deposit for completed project (Cost 8), PEN
INSERT INTO payments (related_to, related_id, direction, payment_type, payment_date, amount, currency, exchange_rate, bank_account_id, partner_company_id) VALUES
  ('cost',
   (SELECT id FROM costs WHERE document_ref = 'PRY006-AP-001'),
   'outbound', 'detraccion', '2026-01-14',
   2152.80, 'PEN', 3.68,
   (SELECT id FROM bank_accounts WHERE account_number_last4 = '0004'),
   (SELECT id FROM partner_companies WHERE ruc = '20000000001'));

-- Payment 6: Outbound regular — partial pay imported steel (Cost 5), USD
INSERT INTO payments (related_to, related_id, direction, payment_type, payment_date, amount, currency, exchange_rate, bank_account_id, partner_company_id) VALUES
  ('cost',
   (SELECT id FROM costs WHERE document_ref = 'PRY005-AP-001'),
   'outbound', 'regular', '2026-02-15',
   5000.00, 'USD', 3.70,
   (SELECT id FROM bank_accounts WHERE account_number_last4 = '0003'),
   (SELECT id FROM partner_companies WHERE ruc = '20000000001'));

-- Payment 7: Outbound regular — partial pay excavator (Cost 6), USD
INSERT INTO payments (related_to, related_id, direction, payment_type, payment_date, amount, currency, exchange_rate, bank_account_id, partner_company_id) VALUES
  ('cost',
   (SELECT id FROM costs WHERE document_ref = 'PRY005-AP-002'),
   'outbound', 'regular', '2026-02-28',
   3500.00, 'USD', 3.72,
   (SELECT id FROM bank_accounts WHERE account_number_last4 = '0003'),
   (SELECT id FROM partner_companies WHERE ruc = '20000000001'));

-- Payment 8: Inbound regular — client pays AR 2 partially, PEN
INSERT INTO payments (related_to, related_id, direction, payment_type, payment_date, amount, currency, exchange_rate, bank_account_id, partner_company_id, notes) VALUES
  ('ar_invoice',
   (SELECT id FROM ar_invoices WHERE document_ref = 'PRY004-AR-001'),
   'inbound', 'regular', '2026-01-25',
   60000.00, 'PEN', 3.68,
   (SELECT id FROM bank_accounts WHERE account_number_last4 = '0001'),
   (SELECT id FROM partner_companies WHERE ruc = '20000000001'),
   'Partial payment from Los Andes');

-- Payment 9: Inbound detraccion — client deposits detraccion to our BdN (AR 2), PEN
INSERT INTO payments (related_to, related_id, direction, payment_type, payment_date, amount, currency, exchange_rate, bank_account_id, partner_company_id) VALUES
  ('ar_invoice',
   (SELECT id FROM ar_invoices WHERE document_ref = 'PRY004-AR-001'),
   'inbound', 'detraccion', '2026-01-28',
   4000.00, 'PEN', 3.68,
   (SELECT id FROM bank_accounts WHERE account_number_last4 = '0004'),
   (SELECT id FROM partner_companies WHERE ruc = '20000000001'));

-- Payment 10: Inbound regular — government partial pay AR 3, USD
INSERT INTO payments (related_to, related_id, direction, payment_type, payment_date, amount, currency, exchange_rate, bank_account_id, partner_company_id, notes) VALUES
  ('ar_invoice',
   (SELECT id FROM ar_invoices WHERE document_ref = 'PRY005-AR-001'),
   'inbound', 'regular', '2026-02-20',
   25000.00, 'USD', 3.70,
   (SELECT id FROM bank_accounts WHERE account_number_last4 = '0003'),
   (SELECT id FROM partner_companies WHERE ruc = '20000000001'),
   'First payment from Municipalidad');

-- Payment 11: Inbound retencion — government withheld retencion on AR 3, USD
INSERT INTO payments (related_to, related_id, direction, payment_type, payment_date, amount, currency, exchange_rate, partner_company_id, notes) VALUES
  ('ar_invoice',
   (SELECT id FROM ar_invoices WHERE document_ref = 'PRY005-AR-001'),
   'inbound', 'retencion', '2026-02-20',
   1649.40, 'USD', 3.70,
   (SELECT id FROM partner_companies WHERE ruc = '20000000001'),
   'Retencion 3% on AR invoice');

-- Payment 12: Inbound regular — government partial pay AR 4, USD
INSERT INTO payments (related_to, related_id, direction, payment_type, payment_date, amount, currency, exchange_rate, bank_account_id, partner_company_id) VALUES
  ('ar_invoice',
   (SELECT id FROM ar_invoices WHERE document_ref = 'PRY005-AR-002'),
   'inbound', 'regular', '2026-02-05',
   15000.00, 'USD', 3.70,
   (SELECT id FROM bank_accounts WHERE account_number_last4 = '0003'),
   (SELECT id FROM partner_companies WHERE ruc = '20000000001'));

-- ============================================================
-- 11. Loans (2 rows)
-- ============================================================

INSERT INTO loans (lender_name, lender_contact, amount, currency, exchange_rate, date_borrowed, project_id, purpose, return_type, agreed_return_rate, due_date, status) VALUES
  ('Carlos Mendoza', '951222333',
   50000.00, 'PEN', 3.70, '2026-01-05',
   (SELECT id FROM projects WHERE project_code = 'PRY004'),
   'Working capital for Av. Los Incas project startup',
   'percentage', 8.00, '2026-06-30', 'partially_paid'),
  ('Maria Santos', '951444555',
   8000.00, 'USD', 3.70, '2026-01-10',
   (SELECT id FROM projects WHERE project_code = 'PRY005'),
   'Equipment deposit for Cerro Colorado module',
   'fixed', NULL, '2026-09-30', 'active');

-- Set agreed_return_amount for fixed loan (Maria Santos)
UPDATE loans SET agreed_return_amount = 800.00 WHERE lender_name = 'Maria Santos';

-- ============================================================
-- 12. Loan Schedule (4 entries)
-- ============================================================

INSERT INTO loan_schedule (loan_id, scheduled_date, scheduled_amount, exchange_rate, paid) VALUES
  ((SELECT id FROM loans WHERE lender_name = 'Carlos Mendoza'), '2026-03-31', 18000.00, 3.72, false),
  ((SELECT id FROM loans WHERE lender_name = 'Carlos Mendoza'), '2026-04-30', 18000.00, 3.72, false),
  ((SELECT id FROM loans WHERE lender_name = 'Maria Santos'), '2026-04-30', 4400.00, 3.72, false),
  ((SELECT id FROM loans WHERE lender_name = 'Maria Santos'), '2026-05-31', 4400.00, 3.72, false);

-- ============================================================
-- 13. Loan Payments (2 entries)
-- ============================================================

INSERT INTO loan_payments (loan_id, payment_date, amount, currency, exchange_rate, source, notes) VALUES
  ((SELECT id FROM loans WHERE lender_name = 'Carlos Mendoza'), '2026-02-15', 18000.00, 'PEN', 3.72, 'personal_funds', 'First repayment installment'),
  ((SELECT id FROM loans WHERE lender_name = 'Maria Santos'), '2026-02-28', 2000.00, 'USD', 3.72, 'personal_funds', 'Partial repayment');

-- ============================================================
-- 14. Project Budgets (6 rows)
-- ============================================================

INSERT INTO project_budgets (project_id, category, budgeted_amount, currency) VALUES
  ((SELECT id FROM projects WHERE project_code = 'PRY004'), 'materials', 180000.00, 'PEN'),
  ((SELECT id FROM projects WHERE project_code = 'PRY004'), 'labor', 80000.00, 'PEN'),
  ((SELECT id FROM projects WHERE project_code = 'PRY004'), 'subcontractor', 60000.00, 'PEN'),
  ((SELECT id FROM projects WHERE project_code = 'PRY005'), 'materials', 45000.00, 'USD'),
  ((SELECT id FROM projects WHERE project_code = 'PRY005'), 'labor', 20000.00, 'USD'),
  ((SELECT id FROM projects WHERE project_code = 'PRY005'), 'equipment_rental', 15000.00, 'USD');
