#!/usr/bin/env node
/**
 * Generate Excel import templates for the Korakuen system.
 * Run: node website/scripts/generate-templates.mjs
 *
 * Template structure (matches import-modal parser):
 *   Row 1: Column headers (snake_case keys)
 *   Row 2: Description
 *   Row 3: Example values
 *   Row 4: Valid values / constraints
 *   Row 5+: Data rows (user fills in)
 */

import XLSX from 'xlsx'
import { fileURLToPath } from 'url'
import { dirname, join } from 'path'

const __dirname = dirname(fileURLToPath(import.meta.url))
const OUT_DIR = join(__dirname, '..', 'public', 'templates')

function createTemplate(filename, columns, notes) {
  const headers = columns.map(c => c.key)
  const descriptions = columns.map(c => c.description)
  const examples = columns.map(c => c.example ?? '')
  const valids = columns.map(c => c.valid ?? '')

  const ws = XLSX.utils.aoa_to_sheet([headers, descriptions, examples, valids])

  // Set column widths based on longest content
  ws['!cols'] = columns.map(c => {
    const maxLen = Math.max(
      c.key.length,
      c.description.length,
      (c.example ?? '').toString().length,
      (c.valid ?? '').toString().length
    )
    return { wch: Math.min(Math.max(maxLen + 2, 12), 40) }
  })

  // Instructions sheet — structured table with all fields
  const instructionRows = [
    ['Data sheet structure:'],
    ['  Row 1: Column headers (do not modify)'],
    ['  Row 2: Column descriptions'],
    ['  Row 3: Example values'],
    ['  Row 4: Valid values / constraints'],
    ['  Row 5+: Enter your data here'],
    [],
    // Field reference table
    ['Field', 'Required', 'Description', 'Valid Values'],
    ...columns.map(c => [c.key, c.required ?? '', c.description, c.valid ?? '']),
    [],
    ...(notes ?? []).map(line => [line]),
  ]
  const wsInstructions = XLSX.utils.aoa_to_sheet(instructionRows)
  wsInstructions['!cols'] = [{ wch: 28 }, { wch: 44 }, { wch: 44 }, { wch: 60 }]

  const wb = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(wb, wsInstructions, 'Instructions')
  XLSX.utils.book_append_sheet(wb, ws, 'Data')
  XLSX.writeFile(wb, join(OUT_DIR, filename))
  console.log(`  ✓ ${filename}`)
}

// ============================================================
// Quotes Template (imports as pending invoices + invoice_items)
// ============================================================
createTemplate('quotes-template.xlsx', [
  { key: 'partner_name',            required: 'Yes',  description: 'Partner name',                   example: 'Korakuen SAC',     valid: 'Must exist in DB (tagged partner)' },
  { key: 'project_code',            required: 'Yes',  description: 'Project code',                  example: 'PRY001',           valid: 'Must exist in DB' },
  { key: 'entity_document_number',  required: 'Yes',  description: 'Supplier RUC/DNI',              example: '20123456789',      valid: 'Must exist in DB' },
  { key: 'date_received',           required: 'Yes',  description: 'Date received (quote date)',     example: '2026-03-15',       valid: 'YYYY-MM-DD' },
  { key: 'title',                   required: 'Yes',  description: 'Item title',                    example: 'Cement supply Q1' },
  { key: 'category',                required: 'No',   description: 'Item category',                 example: 'materials',        valid: 'Must exist in categories' },
  { key: 'quantity',                required: 'No',   description: 'Quantity',                       example: '100',              valid: 'Number' },
  { key: 'unit_of_measure',        required: 'No',   description: 'Unit of measure',                example: 'bags' },
  { key: 'unit_price',             required: 'No',   description: 'Unit price',                     example: '25.50',            valid: 'Number' },
  { key: 'subtotal',               required: 'Yes',  description: 'Subtotal (before IGV)',          example: '2550.00',          valid: 'Number, > 0' },
  { key: 'currency',               required: 'Yes',  description: 'Currency code',                  example: 'PEN',              valid: 'USD, PEN' },
  { key: 'exchange_rate',          required: 'Yes',  description: 'Exchange rate (PEN per USD)',     example: '3.72',             valid: '2.5–6.0' },
  { key: 'status',                 required: 'Yes',  description: 'Quote status',                   example: 'pending',          valid: 'pending, accepted, rejected' },
  { key: 'document_ref',           required: 'No',   description: 'Document reference',             example: 'COT-001' },
  { key: 'notes',                  required: 'No',   description: 'Notes',                          example: '' },
], [
  'Notes:',
  '  - Each row creates a quote (pending invoice) + one invoice_item',
  '  - Quotes with status "pending" or "rejected" are invisible to financial views',
  '  - Only "accepted" quotes become real invoices visible in totals, balances, and settlement',
  '  - You can change quote status from the Prices page after import',
  '  - partner_name must match an entity tagged as "partner" in the database',
  '  - project_code and entity_document_number must already exist in the database',
  '  - If quantity and unit_price are provided: subtotal must equal quantity × unit_price',
  '  - igv_amount and total are derived automatically (18% IGV)',
])

// ============================================================
// Invoices Template
// ============================================================
createTemplate('invoices-template.xlsx', [
  { key: 'direction',              required: 'Yes',                          description: 'Invoice direction',                      example: 'payable',          valid: 'payable, receivable' },
  { key: 'partner_name',           required: 'Yes',                          description: 'Partner name',                           example: 'Korakuen SAC',     valid: 'Must exist in DB' },
  { key: 'invoice_date',           required: 'Yes',                          description: 'Invoice date',                           example: '2026-03-15',       valid: 'YYYY-MM-DD' },
  { key: 'title',                  required: 'No',                           description: 'Invoice title (header)',                 example: 'Road materials' },
  { key: 'invoice_number',         required: 'No',                           description: 'Invoice number',                         example: 'F001-00123' },
  { key: 'currency',               required: 'Yes',                          description: 'Currency code',                          example: 'PEN',              valid: 'USD, PEN' },
  { key: 'igv_rate',               required: 'Yes',                          description: 'IGV rate (%)',                             example: '18',               valid: '0 or 18' },
  { key: 'exchange_rate',          required: 'Yes',                          description: 'Exchange rate (PEN per USD)',             example: '3.72',             valid: '2.5–6.0' },
  { key: 'project_code',           required: 'Yes, for receivable',          description: 'Project code',                           example: 'PRY001',           valid: 'Must exist in DB' },
  { key: 'entity_document_number', required: 'Yes, for receivable',          description: 'Entity RUC/DNI',                         example: '20123456789',      valid: 'Must exist in DB' },
  { key: 'comprobante_type',       required: 'Yes',                          description: 'Comprobante type',                       example: 'factura',          valid: 'factura, boleta, recibo_por_honorarios, liquidacion_de_compra, planilla_jornales, none, pending' },
  { key: 'document_ref',           required: 'Yes, for payable',             description: 'Document reference (grouping key)',      example: 'PRY001-AP-001' },
  { key: 'due_date',               required: 'No',                           description: 'Due date',                               example: '2026-04-15',       valid: 'YYYY-MM-DD' },
  { key: 'detraccion_rate',        required: 'No',                           description: 'Detracción rate (%)',                    example: '12',               valid: '0–100, PEN invoices only' },
  { key: 'retencion_applicable',   required: 'No',                           description: 'Retención applies?',                     example: 'false',            valid: 'true/false, receivable only' },
  { key: 'retencion_rate',         required: 'No',                           description: 'Retención rate (%). Defaults to 8% if retencion_applicable=true', example: '8', valid: '0–100, receivable only' },
  { key: 'notes',                  required: 'No',                           description: 'Notes',                                  example: '' },
  { key: 'item_title',             required: 'Yes',                          description: 'Line item title',                        example: 'Cement bags' },
  { key: 'category',               required: 'Yes, for payable',             description: 'Line item category',                     example: 'materials',        valid: 'materials, labor, subcontractor, equipment_rental, housing_food, other, software_licenses, partner_compensation, professional_services, other_sga' },
  { key: 'subtotal',               required: 'Yes',                          description: 'Line item subtotal (before IGV)',        example: '5000.00',          valid: 'Number, > 0' },
  { key: 'quantity',               required: 'No',                           description: 'Line item quantity',                     example: '200',              valid: 'Number' },
  { key: 'unit_of_measure',        required: 'No',                           description: 'Unit of measure',                        example: 'bags' },
  { key: 'unit_price',             required: 'No',                           description: 'Unit price',                             example: '25.00',            valid: 'Number' },
], [
  'Notes:',
  '  - Rows with the same document_ref are grouped into one invoice with multiple line items',
  '  - partner_name must match an entity tagged as "partner" in the database',
  '  - Detracción only applies to PEN invoices',
  '  - Retención only applies to receivable invoices',
  '  - If retencion_applicable=true and no retencion_rate is provided, defaults to 8%',
])

// ============================================================
// Payments Template (handles both invoice payments and direct transactions)
// ============================================================
createTemplate('payments-template.xlsx', [
  { key: 'invoice_document_ref',   required: 'No',                                            description: 'Links payment to an existing invoice. Leave blank to create a direct transaction',  example: 'PRY001-AP-001', valid: 'Must exist in DB if provided' },
  { key: 'direction',              required: 'Yes',                                            description: 'Cash flow direction',                          example: 'outbound',          valid: 'inbound, outbound' },
  { key: 'partner_name',           required: 'Yes',                                            description: 'Partner name',                                 example: 'Korakuen SAC',      valid: 'Must exist in DB' },
  { key: 'title',                  required: 'No',                                             description: 'What appears on bank app. Defaults: Pago/Cobro/Detraccion/Retencion', example: 'Pago cemento', valid: 'Free text' },
  { key: 'payment_date',           required: 'Yes',                                            description: 'Payment date',                                 example: '2026-03-20',        valid: 'YYYY-MM-DD' },
  { key: 'amount',                 required: 'Yes',                                            description: 'Payment amount',                               example: '5000.00',           valid: 'Number, > 0' },
  { key: 'currency',               required: 'Yes',                                            description: 'Currency code',                                example: 'PEN',               valid: 'USD, PEN' },
  { key: 'exchange_rate',          required: 'No',                                             description: 'Exchange rate (PEN per USD). Auto-filled from DB if blank', example: '3.72', valid: '2.5–6.0' },
  { key: 'payment_type',           required: 'No',                                             description: 'Payment type. Defaults to regular if blank',   example: 'regular',           valid: 'regular, detraccion, retencion' },
  { key: 'operation_number',        required: 'Yes, except retencion',                          description: 'Bank operation/transaction number (numero de operacion)',           example: '00123456',          valid: 'Free text' },
  { key: 'bank_account',           required: 'Yes, for invoice regular/detraccion payments',   description: 'Bank account in BankName-Last4 format. Currency must match payment', example: 'BCP-1234', valid: 'Must exist in DB' },
  { key: 'entity_document_number',  required: 'No (direct transactions only)',                  description: 'Supplier/client RUC/DNI for direct transactions', example: '20123456789',    valid: 'Must exist in DB if provided' },
  { key: 'project_code',           required: 'No (direct transactions only)',                  description: 'Project code for direct transactions',         example: 'PRY001',            valid: 'Must exist in DB' },
  { key: 'category',               required: 'Yes, for outbound direct transactions',          description: 'Cost category for direct transactions',        example: 'materials',         valid: 'Must match cost_type (project_cost if project_code given, sga otherwise)' },
  { key: 'document_ref',           required: 'No',                                             description: 'Payment receipt reference',                    example: 'PRY001-PY-001' },
  { key: 'notes',                  required: 'No',                                             description: 'Notes',                                       example: '' },
], [
  'Notes:',
  '  - If invoice_document_ref is provided: links payment to an existing invoice',
  '  - If invoice_document_ref is blank: creates a direct transaction (auto-generates invoice + payment)',
  '  - partner_name must match an entity tagged as "partner" in the database',
  '  - Retención only applies to receivable invoices',
  '  - exchange_rate is auto-filled from the database if left blank',
])

console.log(`\nAll templates written to: ${OUT_DIR}`)
