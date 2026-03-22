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

function createTemplate(filename, columns) {
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

  const wb = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(wb, ws, 'Data')
  XLSX.writeFile(wb, join(OUT_DIR, filename))
  console.log(`  ✓ ${filename}`)
}

// ============================================================
// Quotes Template
// ============================================================
createTemplate('quotes-template.xlsx', [
  { key: 'project_code',            description: 'Project code',                  example: 'PRY001',       valid: 'Must exist in DB' },
  { key: 'entity_document_number',  description: 'Supplier RUC/DNI',              example: '20123456789',  valid: 'Must exist in DB' },
  { key: 'date_received',           description: 'Date received',                 example: '2026-03-15',   valid: 'YYYY-MM-DD' },
  { key: 'title',                   description: 'Quote title',                   example: 'Cement supply Q1', valid: 'Required' },
  { key: 'quantity',                description: 'Quantity',                       example: '100',          valid: 'Optional, number' },
  { key: 'unit_of_measure',        description: 'Unit of measure',                example: 'bags',         valid: 'Optional' },
  { key: 'unit_price',             description: 'Unit price',                     example: '25.50',        valid: 'Optional, number' },
  { key: 'subtotal',               description: 'Subtotal (before IGV)',          example: '2550.00',      valid: 'Required, number' },
  { key: 'igv_amount',             description: 'IGV amount (18% of subtotal)',   example: '459.00',       valid: 'Optional, number' },
  { key: 'total',                  description: 'Total (subtotal + IGV)',         example: '3009.00',      valid: 'Required, number' },
  { key: 'currency',               description: 'Currency code',                  example: 'PEN',          valid: 'USD, PEN' },
  { key: 'exchange_rate',          description: 'Exchange rate (PEN per USD)',     example: '3.72',         valid: 'Required, 2.5–6.0' },
  { key: 'status',                 description: 'Quote status',                   example: 'pending',      valid: 'pending, accepted, rejected' },
  { key: 'document_ref',           description: 'Document reference',             example: 'COT-001',      valid: 'Optional' },
  { key: 'notes',                  description: 'Notes',                          example: '',             valid: 'Optional' },
])

// ============================================================
// Invoices Template
// ============================================================
createTemplate('invoices-template.xlsx', [
  { key: 'direction',              description: 'Invoice direction',                      example: 'payable',          valid: 'payable, receivable' },
  { key: 'partner_name',   description: 'Partner name',                   example: 'Korakuen SAC',     valid: 'Must exist in DB' },
  { key: 'invoice_date',           description: 'Invoice date',                           example: '2026-03-15',       valid: 'YYYY-MM-DD' },
  { key: 'title',                  description: 'Invoice title (header)',                 example: 'Road materials',   valid: 'Optional' },
  { key: 'invoice_number',         description: 'Invoice number',                         example: 'F001-00123',       valid: 'Optional' },
  { key: 'currency',               description: 'Currency code',                          example: 'PEN',              valid: 'USD, PEN' },
  { key: 'igv_rate',               description: 'IGV rate',                               example: '0.18',             valid: 'Required, 0 or 0.18' },
  { key: 'exchange_rate',          description: 'Exchange rate (PEN per USD)',             example: '3.72',             valid: 'Required, 2.5–6.0' },
  { key: 'project_code',           description: 'Project code',                           example: 'PRY001',           valid: 'Required for receivable' },
  { key: 'entity_document_number', description: 'Entity RUC/DNI',                         example: '20123456789',      valid: 'Required for receivable' },
  { key: 'comprobante_type',       description: 'Comprobante type',                       example: 'factura',          valid: 'factura, boleta, recibo_por_honorarios, liquidacion_de_compra, planilla_jornales, none' },
  { key: 'document_ref',           description: 'Document reference (grouping key)',      example: 'PRY001-AP-001',    valid: 'Required for payable' },
  { key: 'due_date',               description: 'Due date',                               example: '2026-04-15',       valid: 'Optional, YYYY-MM-DD' },
  { key: 'detraccion_rate',        description: 'Detracción rate',                        example: '0.12',             valid: 'Optional, PEN only' },
  { key: 'retencion_applicable',   description: 'Retención applies?',                     example: 'false',            valid: 'true/false, receivable only' },
  { key: 'retencion_rate',         description: 'Retención rate',                         example: '0.03',             valid: 'Optional' },
  { key: 'payment_method',         description: 'Payment method',                         example: 'transfer',         valid: 'Optional' },
  { key: 'quote_document_ref',     description: 'Linked quote document_ref',              example: 'COT-001',          valid: 'Optional, must exist in DB' },
  { key: 'notes',                  description: 'Notes',                                  example: '',                 valid: 'Optional' },
  { key: 'item_title',             description: 'Line item title',                        example: 'Cement bags',      valid: 'Required' },
  { key: 'category',               description: 'Line item category',                     example: 'materials',        valid: 'Required for payable. Values: materials, labor, subcontractor, equipment_rental, permits_regulatory, other, software_licenses, partner_compensation, professional_services, other_sga' },
  { key: 'subtotal',               description: 'Line item subtotal (before IGV)',        example: '5000.00',          valid: 'Required, number' },
  { key: 'quantity',               description: 'Line item quantity',                     example: '200',              valid: 'Optional, number' },
  { key: 'unit_of_measure',        description: 'Unit of measure',                        example: 'bags',             valid: 'Optional' },
  { key: 'unit_price',             description: 'Unit price',                             example: '25.00',            valid: 'Optional, number' },
])

// ============================================================
// Payments Template
// ============================================================
createTemplate('payments-template.xlsx', [
  { key: 'invoice_document_ref',   description: 'Invoice document_ref to pay',    example: 'PRY001-AP-001',     valid: 'Must exist in DB' },
  { key: 'direction',              description: 'Cash flow direction',             example: 'outbound',          valid: 'inbound, outbound' },
  { key: 'payment_type',           description: 'Payment type',                   example: 'regular',           valid: 'regular, detraccion, retencion' },
  { key: 'payment_date',           description: 'Payment date',                   example: '2026-03-20',        valid: 'YYYY-MM-DD' },
  { key: 'amount',                 description: 'Payment amount',                 example: '5000.00',           valid: 'Required, > 0' },
  { key: 'currency',               description: 'Currency code',                  example: 'PEN',               valid: 'USD, PEN' },
  { key: 'exchange_rate',          description: 'Exchange rate (PEN per USD)',     example: '3.72',              valid: 'Required, 2.5–6.0' },
  { key: 'bank_account',           description: 'Bank account (BankName-Last4)',  example: 'BCP-1234',          valid: 'Required for regular/detraccion' },
  { key: 'partner_name',   description: 'Partner name',           example: 'Korakuen SAC',      valid: 'Must exist in DB' },
  { key: 'notes',                  description: 'Notes',                          example: '',                  valid: 'Optional' },
])

// ============================================================
// Direct Transactions Template
// ============================================================
createTemplate('direct-transactions-template.xlsx', [
  { key: 'direction',              description: 'Transaction direction',           example: 'outflow',           valid: 'outflow, inflow' },
  { key: 'partner_name',   description: 'Partner name',            example: 'Korakuen SAC',      valid: 'Must exist in DB' },
  { key: 'project_code',           description: 'Project code',                   example: 'PRY001',            valid: 'Must exist in DB' },
  { key: 'date',                   description: 'Transaction date',               example: '2026-03-20',        valid: 'YYYY-MM-DD' },
  { key: 'amount',                 description: 'Amount',                         example: '500.00',            valid: 'Required, > 0' },
  { key: 'currency',               description: 'Currency code',                  example: 'PEN',               valid: 'USD, PEN' },
  { key: 'exchange_rate',          description: 'Exchange rate (PEN per USD)',     example: '3.72',              valid: 'Optional — auto-filled from exchange_rates table if blank' },
  { key: 'category',               description: 'Cost category (outflow only)',   example: 'materials',         valid: 'Required for outflow. Values: materials, labor, subcontractor, equipment_rental, permits_regulatory, other' },
  { key: 'notes',                  description: 'Notes / description',            example: 'Cash for nails',    valid: 'Optional' },
])

console.log(`\nAll templates written to: ${OUT_DIR}`)
