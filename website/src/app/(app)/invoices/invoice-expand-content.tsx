'use client'

import { useState, useEffect, useTransition } from 'react'
import { formatCurrency, formatDate, formatComprobanteType } from '@/lib/formatters'
import { DetailField } from '@/components/ui/detail-field'
import { StatusBadge } from '@/components/ui/status-badge'
import { PaymentHistoryTable } from '@/components/ui/payment-history-table'
import { inputCompactClass } from '@/lib/styles'
import { updateInvoice, deactivateInvoice, fetchExchangeRateForDate } from '@/lib/actions'
import type { InvoiceDetailData, InvoicesPageRow } from '@/lib/types'
import type { CategoryOption } from '@/lib/queries'

type Props = {
  detail: InvoiceDetailData
  row: InvoicesPageRow
  mode: 'view' | 'edit' | 'delete'
  onSetMode: (mode: 'view' | 'edit' | 'delete') => void
  onMutationSuccess: () => void
  onPaymentSuccess: () => void
  categories: CategoryOption[]
}

// --- Lock icon ---
function LockIcon() {
  return (
    <svg width="12" height="12" viewBox="0 0 20 20" fill="currentColor" className="inline-block text-zinc-300 ml-1">
      <path fillRule="evenodd" d="M10 1a4.5 4.5 0 00-4.5 4.5V9H5a2 2 0 00-2 2v6a2 2 0 002 2h10a2 2 0 002-2v-6a2 2 0 00-2-2h-.5V5.5A4.5 4.5 0 0010 1zm3 8V5.5a3 3 0 10-6 0V9h6z" clipRule="evenodd" />
    </svg>
  )
}

// --- Pencil icon SVG path ---
const pencilPath = "M2.695 14.763l-1.262 3.154a.5.5 0 00.65.65l3.155-1.262a4 4 0 001.343-.885L17.5 5.5a2.121 2.121 0 00-3-3L3.58 13.42a4 4 0 00-.885 1.343z"
const trashPath = "M8.75 1A2.75 2.75 0 006 3.75v.443c-.795.077-1.584.176-2.365.298a.75.75 0 10.23 1.482l.149-.022.841 10.518A2.75 2.75 0 007.596 19h4.807a2.75 2.75 0 002.742-2.53l.841-10.519.149.023a.75.75 0 00.23-1.482A41.03 41.03 0 0014 4.193V3.75A2.75 2.75 0 0011.25 1h-2.5zM10 4c.84 0 1.673.025 2.5.075V3.75c0-.69-.56-1.25-1.25-1.25h-2.5c-.69 0-1.25.56-1.25 1.25v.325C8.327 4.025 9.16 4 10 4zM8.58 7.72a.75.75 0 00-1.5.06l.3 7.5a.75.75 0 101.5-.06l-.3-7.5zm4.34.06a.75.75 0 10-1.5-.06l-.3 7.5a.75.75 0 101.5.06l.3-7.5z"

type EditItem = {
  key: number
  title: string
  category: string
  quantity: string
  unit_of_measure: string
  unit_price: string
  subtotal: string
}

let itemKeyCounter = 0

// --- View Mode ---
function ViewContent({ detail, onSetMode, onPaymentSuccess }: {
  detail: InvoiceDetailData
  onSetMode: (mode: 'view' | 'edit' | 'delete') => void
  onPaymentSuccess: () => void
}) {
  const invoice = detail.invoice!
  const currency = invoice.currency ?? 'PEN'
  const invoiceDetraccion = invoice.detraccion_amount ?? 0
  const invoiceRetencion = invoice.retencion_amount ?? 0
  const invoiceOutstanding = invoice.outstanding ?? 0
  const bdnOutstanding = invoice.bdn_outstanding ?? 0
  const bdnOutstandingPen = invoice.bdn_outstanding_pen ?? 0
  const retencionOutstanding = invoice.retencion_outstanding ?? 0
  const invoicePayable = invoice.payable_or_receivable ?? 0
  const direction = invoice.direction === 'receivable' ? 'inbound' as const : 'outbound' as const

  return (
    <div className="space-y-4 px-4 py-3">
      {/* Header info */}
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        <DetailField label="Title" value={invoice.title ?? '--'} />
        <DetailField label="Entity" value={invoice.entity_id ? '—' : 'Informal'} />
        <DetailField label="Date" value={invoice.invoice_date ? formatDate(invoice.invoice_date) : '--'} />
        <DetailField label="Due Date" value={invoice.due_date ? formatDate(invoice.due_date) : '--'} />
        <DetailField label="Comprobante" value={formatComprobanteType(invoice.comprobante_type)} />
        <DetailField label="Invoice #" value={invoice.invoice_number ?? '--'} />
        <DetailField label="Document Ref" value={invoice.document_ref ?? '--'} />
        <DetailField label="Payment Method" value={invoice.payment_method ?? '--'} />
      </div>

      {/* Line items */}
      {detail.items.length > 0 && (
        <div>
          <h3 className="mb-2 text-sm font-semibold text-zinc-700">Line Items</h3>
          <div className="overflow-x-auto rounded border border-zinc-200">
            <table className="w-full text-left text-xs">
              <thead className="bg-zinc-50 text-zinc-500">
                <tr>
                  <th className="px-3 py-2">Title</th>
                  <th className="px-3 py-2 text-right">Qty</th>
                  <th className="px-3 py-2">Unit</th>
                  <th className="px-3 py-2 text-right">Unit Price</th>
                  <th className="px-3 py-2 text-right">Subtotal</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-100">
                {detail.items.map((item) => (
                  <tr key={item.id}>
                    <td className="px-3 py-2 text-zinc-700">{item.title}</td>
                    <td className="px-3 py-2 text-right text-zinc-600">{item.quantity ?? '--'}</td>
                    <td className="px-3 py-2 text-zinc-500">{item.unit_of_measure ?? '--'}</td>
                    <td className="px-3 py-2 text-right font-mono text-zinc-600">
                      {item.unit_price != null ? formatCurrency(item.unit_price, currency) : '--'}
                    </td>
                    <td className="px-3 py-2 text-right font-mono text-zinc-700">
                      {formatCurrency(item.subtotal, currency)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Totals */}
      <div className="rounded border border-zinc-200 bg-zinc-50 px-4 py-3">
        <div className="grid grid-cols-2 gap-x-8 gap-y-1 text-sm">
          <div className="space-y-1">
            <div className="flex justify-between">
              <span className="text-zinc-500">Subtotal</span>
              <span className="font-mono text-zinc-700">{formatCurrency(invoice.subtotal ?? 0, currency)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-zinc-500">IGV</span>
              <span className="font-mono text-zinc-700">{formatCurrency(invoice.igv_amount ?? 0, currency)}</span>
            </div>
            <div className="flex justify-between">
              <span className="font-medium text-zinc-700">Total</span>
              <span className="font-mono font-semibold text-zinc-900">{formatCurrency(invoice.total ?? 0, currency)}</span>
            </div>
          </div>
          <div className="space-y-1">
            {invoiceDetraccion > 0 && (
              <div className="flex justify-between">
                <span className="text-zinc-500">Detraccion</span>
                <span className="font-mono text-zinc-700">{formatCurrency(invoiceDetraccion, currency)}</span>
              </div>
            )}
            {invoiceRetencion > 0 && (
              <div className="flex justify-between">
                <span className="text-zinc-500">Retencion</span>
                <span className="font-mono text-zinc-700">{formatCurrency(invoiceRetencion, currency)}</span>
              </div>
            )}
            <div className="flex justify-between">
              <span className="font-medium text-zinc-500">Paid</span>
              <span className="font-mono text-zinc-700">{formatCurrency(invoice.amount_paid ?? 0, currency)}</span>
            </div>
            <div className="flex justify-between">
              <span className="font-medium text-zinc-500">Outstanding</span>
              <span className="font-mono font-semibold text-red-600">{formatCurrency(invoiceOutstanding, currency)}</span>
            </div>
          </div>
        </div>
      </div>

      {/* Payment history + inline form */}
      <PaymentHistoryTable
        payments={detail.payments}
        paymentFormProps={
          invoice.invoice_id && invoiceOutstanding > 0
            ? {
                relatedTo: 'invoice',
                relatedId: invoice.invoice_id,
                direction,
                partnerCompanyId: invoice.partner_company_id ?? '',
                currency,
                outstanding: invoiceOutstanding,
                payable: invoicePayable,
                bdnOutstanding,
                bdnOutstandingPen,
                retencionOutstanding,
                detraccionAmount: invoiceDetraccion,
                retencionAmount: invoiceRetencion,
                onSuccess: onPaymentSuccess,
              }
            : undefined
        }
      />

      {/* Action footer */}
      <div className="flex items-center justify-between border-t border-zinc-200 pt-3">
        <button
          onClick={() => onSetMode('delete')}
          className="inline-flex items-center gap-1.5 rounded-md border border-red-200 px-3 py-1.5 text-sm font-medium text-red-600 transition-colors hover:bg-red-50"
        >
          <svg width="14" height="14" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d={trashPath} clipRule="evenodd" /></svg>
          Delete
        </button>
        <button
          onClick={() => onSetMode('edit')}
          className="inline-flex items-center gap-1.5 rounded-md bg-zinc-800 px-4 py-1.5 text-sm font-medium text-white transition-colors hover:bg-zinc-700"
        >
          <svg width="14" height="14" viewBox="0 0 20 20" fill="currentColor"><path d={pencilPath} /></svg>
          Edit
        </button>
      </div>
    </div>
  )
}

// --- Edit Mode ---
function EditContent({ detail, row, categories, onCancel, onSuccess }: {
  detail: InvoiceDetailData
  row: InvoicesPageRow
  categories: CategoryOption[]
  onCancel: () => void
  onSuccess: () => void
}) {
  const invoice = detail.invoice!
  const [isPending, startTransition] = useTransition()
  const currency = invoice.currency ?? 'PEN'
  const isReceivable = invoice.direction === 'receivable'

  // Header fields
  const [title, setTitle] = useState(invoice.title ?? '')
  const [entityId, setEntityId] = useState(invoice.entity_id ?? '')
  const [invoiceDate, setInvoiceDate] = useState(invoice.invoice_date ?? '')
  const [dueDate, setDueDate] = useState(invoice.due_date ?? '')
  const [comprobanteType, setComprobanteType] = useState(invoice.comprobante_type ?? '')
  const [invoiceNumber, setInvoiceNumber] = useState(invoice.invoice_number ?? '')
  const [documentRef, setDocumentRef] = useState(invoice.document_ref ?? '')
  const [paymentMethod, setPaymentMethod] = useState(invoice.payment_method ?? '')
  const [exchangeRate, setExchangeRate] = useState(invoice.exchange_rate?.toString() ?? '')
  const [detraccionRate, setDetraccionRate] = useState(invoice.detraccion_rate?.toString() ?? '')
  const [retencionRate, setRetencionRate] = useState(invoice.retencion_rate?.toString() ?? '')
  const [notes, setNotes] = useState(invoice.notes ?? '')
  const [error, setError] = useState<string | null>(null)

  // Line items
  const [items, setItems] = useState<EditItem[]>(() =>
    detail.items.map(item => ({
      key: ++itemKeyCounter,
      title: item.title,
      category: item.category ?? '',
      quantity: item.quantity?.toString() ?? '',
      unit_of_measure: item.unit_of_measure ?? '',
      unit_price: item.unit_price?.toString() ?? '',
      subtotal: item.subtotal.toString(),
    }))
  )

  const hasPayments = detail.payments.length > 0
  const amountPaid = invoice.amount_paid ?? 0

  // Auto-fetch exchange rate when date changes
  useEffect(() => {
    if (invoiceDate && invoiceDate !== invoice.invoice_date) {
      fetchExchangeRateForDate(invoiceDate)
        .then(rate => {
          if (rate?.mid_rate) setExchangeRate(rate.mid_rate.toString())
        })
        .catch(() => {})
    }
  }, [invoiceDate, invoice.invoice_date])

  // Computed totals
  const computedSubtotal = items.reduce((sum, item) => sum + (parseFloat(item.subtotal) || 0), 0)
  const igvRate = invoice.igv_rate ?? 18
  const computedIgv = Math.round(computedSubtotal * (igvRate / 100) * 100) / 100
  const computedTotal = computedSubtotal + computedIgv
  const parsedDetraccion = parseFloat(detraccionRate) || 0
  const computedDetraccion = parsedDetraccion > 0 ? Math.round((computedSubtotal + computedIgv) * parsedDetraccion / 100 * 100) / 100 : 0

  function updateItem(key: number, field: keyof EditItem, value: string) {
    setItems(prev => prev.map(item => {
      if (item.key !== key) return item
      const updated = { ...item, [field]: value }
      // Auto-compute subtotal from qty * unit_price
      if (field === 'quantity' || field === 'unit_price') {
        const qty = parseFloat(field === 'quantity' ? value : updated.quantity)
        const price = parseFloat(field === 'unit_price' ? value : updated.unit_price)
        if (!isNaN(qty) && !isNaN(price) && qty > 0 && price > 0) {
          updated.subtotal = (Math.round(qty * price * 100) / 100).toString()
        }
      }
      return updated
    }))
  }

  function addItem() {
    setItems(prev => [...prev, {
      key: ++itemKeyCounter,
      title: '',
      category: '',
      quantity: '',
      unit_of_measure: '',
      unit_price: '',
      subtotal: '',
    }])
  }

  function removeItem(key: number) {
    setItems(prev => prev.filter(item => item.key !== key))
  }

  function handleSubmit() {
    setError(null)
    if (items.length === 0) { setError('At least one line item is required'); return }
    const parsedRate = parseFloat(exchangeRate)
    if (isNaN(parsedRate) || parsedRate <= 0) { setError('Enter a valid exchange rate'); return }

    const parsedItems = items.map(item => ({
      title: item.title.trim(),
      category: item.category || null,
      quantity: item.quantity ? parseFloat(item.quantity) : null,
      unit_of_measure: item.unit_of_measure.trim() || null,
      unit_price: item.unit_price ? parseFloat(item.unit_price) : null,
      subtotal: parseFloat(item.subtotal) || 0,
    }))

    if (parsedItems.some(i => !i.title)) { setError('All items must have a title'); return }
    if (parsedItems.some(i => i.subtotal <= 0)) { setError('All items must have a subtotal > 0'); return }

    startTransition(async () => {
      const result = await updateInvoice({
        id: invoice.invoice_id!,
        title: title.trim() || null,
        entity_id: entityId || null,
        invoice_date: invoiceDate,
        due_date: dueDate || null,
        comprobante_type: comprobanteType || null,
        invoice_number: invoiceNumber.trim() || null,
        document_ref: documentRef.trim() || null,
        payment_method: paymentMethod || null,
        exchange_rate: parsedRate,
        detraccion_rate: parsedDetraccion > 0 ? parsedDetraccion : null,
        retencion_rate: isReceivable && retencionRate ? parseFloat(retencionRate) : null,
        notes: notes.trim() || null,
        items: parsedItems,
      })
      if (result.error) {
        setError(result.error)
      } else {
        onSuccess()
      }
    })
  }

  const inputCls = `${inputCompactClass} w-full bg-white`

  return (
    <div className="space-y-4 px-4 py-3">
      {/* Locked fields */}
      <div className="grid grid-cols-4 gap-4">
        <div>
          <span className="block text-[11px] font-medium text-zinc-400 mb-1">Direction <LockIcon /></span>
          <StatusBadge label={invoice.direction === 'receivable' ? 'Receivable' : 'Payable'} variant={invoice.direction === 'receivable' ? 'green' : 'blue'} />
        </div>
        <div>
          <span className="block text-[11px] font-medium text-zinc-400 mb-1">Partner <LockIcon /></span>
          <span className="text-sm text-zinc-500">{row.partner_company_id ? '—' : '--'}</span>
        </div>
        <div>
          <span className="block text-[11px] font-medium text-zinc-400 mb-1">Currency <LockIcon /></span>
          <span className="text-sm text-zinc-500">{currency}</span>
        </div>
        <div>
          <span className="block text-[11px] font-medium text-zinc-400 mb-1">Project <LockIcon /></span>
          <span className="text-sm text-zinc-500">{row.project_code ?? '--'}</span>
        </div>
      </div>

      {hasPayments && (
        <div className="rounded border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800">
          This invoice has <strong>{detail.payments.length} payment{detail.payments.length !== 1 ? 's' : ''}</strong> totaling <strong className="font-mono">{formatCurrency(amountPaid, currency)}</strong>. The new total cannot be less than the amount paid.
        </div>
      )}

      {/* Editable header fields */}
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="block text-[11px] font-medium text-zinc-500 mb-1">Title</label>
          <input type="text" value={title} onChange={e => setTitle(e.target.value)} className={inputCls} />
        </div>
        <div>
          <label className="block text-[11px] font-medium text-zinc-500 mb-1">Invoice #</label>
          <input type="text" value={invoiceNumber} onChange={e => setInvoiceNumber(e.target.value)} className={inputCls} />
        </div>
      </div>

      <div className="grid grid-cols-4 gap-3">
        <div>
          <label className="block text-[11px] font-medium text-zinc-500 mb-1">Invoice Date</label>
          <input type="date" value={invoiceDate} onChange={e => setInvoiceDate(e.target.value)} className={inputCls} />
        </div>
        <div>
          <label className="block text-[11px] font-medium text-zinc-500 mb-1">Due Date</label>
          <input type="date" value={dueDate} onChange={e => setDueDate(e.target.value)} className={inputCls} />
        </div>
        <div>
          <label className="block text-[11px] font-medium text-zinc-500 mb-1">Comprobante</label>
          <select value={comprobanteType} onChange={e => setComprobanteType(e.target.value)} className={inputCls}>
            <option value="">None</option>
            <option value="factura">Factura</option>
            <option value="boleta">Boleta</option>
            <option value="recibo_por_honorarios">Recibo por Honorarios</option>
            <option value="liquidacion_de_compra">Liquidacion de Compra</option>
            <option value="planilla_jornales">Planilla de Jornales</option>
          </select>
        </div>
        <div>
          <label className="block text-[11px] font-medium text-zinc-500 mb-1">Payment Method</label>
          <select value={paymentMethod} onChange={e => setPaymentMethod(e.target.value)} className={inputCls}>
            <option value="">--</option>
            <option value="bank_transfer">Transferencia</option>
            <option value="cash">Efectivo</option>
            <option value="check">Cheque</option>
          </select>
        </div>
      </div>

      <div className="grid grid-cols-4 gap-3">
        <div>
          <label className="block text-[11px] font-medium text-zinc-500 mb-1">Document Ref</label>
          <input type="text" value={documentRef} onChange={e => setDocumentRef(e.target.value)} className={inputCls} />
        </div>
        <div>
          <label className="block text-[11px] font-medium text-zinc-500 mb-1">Exchange Rate</label>
          <input type="number" step="0.001" min="0" value={exchangeRate} onChange={e => setExchangeRate(e.target.value)} className={`${inputCls} font-mono text-right`} />
          <span className="text-[10px] text-zinc-400 mt-0.5 block">Auto-fetched on date change</span>
        </div>
        <div>
          <label className="block text-[11px] font-medium text-zinc-500 mb-1">Detraccion %</label>
          <input type="number" step="0.01" min="0" max="100" value={detraccionRate} onChange={e => setDetraccionRate(e.target.value)} className={`${inputCls} font-mono text-right`} />
        </div>
        {isReceivable && (
          <div>
            <label className="block text-[11px] font-medium text-zinc-500 mb-1">Retencion %</label>
            <input type="number" step="0.01" min="0" max="100" value={retencionRate} onChange={e => setRetencionRate(e.target.value)} className={`${inputCls} font-mono text-right`} />
          </div>
        )}
      </div>

      <div>
        <label className="block text-[11px] font-medium text-zinc-500 mb-1">Notes</label>
        <textarea rows={2} value={notes} onChange={e => setNotes(e.target.value)} className={`${inputCls} resize-none`} placeholder="Optional notes..." />
      </div>

      {/* Editable line items */}
      <div>
        <div className="flex items-center justify-between mb-2">
          <span className="text-sm font-semibold text-zinc-700">Line Items</span>
          <button onClick={addItem} className="rounded border border-zinc-300 px-2 py-0.5 text-[11px] font-medium text-zinc-600 hover:bg-zinc-100">+ Add item</button>
        </div>
        <div className="overflow-x-auto rounded border border-zinc-200">
          <table className="w-full text-left text-xs">
            <thead className="bg-zinc-50 text-zinc-500">
              <tr>
                <th className="px-2 py-2">Title</th>
                <th className="px-2 py-2">Category</th>
                <th className="px-2 py-2 text-right w-16">Qty</th>
                <th className="px-2 py-2 w-16">Unit</th>
                <th className="px-2 py-2 text-right w-20">Unit Price</th>
                <th className="px-2 py-2 text-right w-24">Subtotal</th>
                <th className="px-2 py-2 w-8"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-100">
              {items.map(item => (
                <tr key={item.key}>
                  <td className="px-2 py-1.5">
                    <input type="text" value={item.title} onChange={e => updateItem(item.key, 'title', e.target.value)}
                      className="w-full rounded border border-zinc-200 px-1.5 py-1 text-xs focus:border-blue-400 focus:outline-none" />
                  </td>
                  <td className="px-2 py-1.5">
                    <select value={item.category} onChange={e => updateItem(item.key, 'category', e.target.value)}
                      className="w-full rounded border border-zinc-200 px-1.5 py-1 text-xs focus:border-blue-400 focus:outline-none">
                      <option value="">--</option>
                      {categories.map(c => <option key={c.name} value={c.name}>{c.name}</option>)}
                    </select>
                  </td>
                  <td className="px-2 py-1.5">
                    <input type="number" value={item.quantity} onChange={e => updateItem(item.key, 'quantity', e.target.value)}
                      className="w-full rounded border border-zinc-200 px-1.5 py-1 text-xs text-right font-mono focus:border-blue-400 focus:outline-none" />
                  </td>
                  <td className="px-2 py-1.5">
                    <input type="text" value={item.unit_of_measure} onChange={e => updateItem(item.key, 'unit_of_measure', e.target.value)}
                      className="w-full rounded border border-zinc-200 px-1.5 py-1 text-xs focus:border-blue-400 focus:outline-none" />
                  </td>
                  <td className="px-2 py-1.5">
                    <input type="number" step="0.01" value={item.unit_price} onChange={e => updateItem(item.key, 'unit_price', e.target.value)}
                      className="w-full rounded border border-zinc-200 px-1.5 py-1 text-xs text-right font-mono focus:border-blue-400 focus:outline-none" />
                  </td>
                  <td className="px-2 py-1.5">
                    <input type="number" step="0.01" value={item.subtotal} onChange={e => updateItem(item.key, 'subtotal', e.target.value)}
                      className="w-full rounded border border-zinc-200 px-1.5 py-1 text-xs text-right font-mono font-semibold focus:border-blue-400 focus:outline-none" />
                  </td>
                  <td className="px-2 py-1.5 text-center">
                    {items.length > 1 && (
                      <button onClick={() => removeItem(item.key)} className="rounded border border-red-200 p-0.5 text-red-400 hover:bg-red-50 hover:text-red-600">
                        <svg width="14" height="14" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d={trashPath} clipRule="evenodd" /></svg>
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Computed totals (read-only) */}
      <div className="rounded border border-zinc-200 bg-zinc-50 px-4 py-3">
        <div className="grid grid-cols-2 gap-x-8 gap-y-1 text-sm">
          <div className="space-y-1">
            <div className="flex justify-between">
              <span className="text-zinc-500">Subtotal</span>
              <span className="font-mono text-zinc-700">{formatCurrency(computedSubtotal, currency)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-zinc-500">IGV ({igvRate}%)</span>
              <span className="font-mono text-zinc-700">{formatCurrency(computedIgv, currency)}</span>
            </div>
            <div className="flex justify-between">
              <span className="font-medium text-zinc-700">Total</span>
              <span className="font-mono font-semibold text-zinc-900">{formatCurrency(computedTotal, currency)}</span>
            </div>
          </div>
          <div className="space-y-1">
            {computedDetraccion > 0 && (
              <div className="flex justify-between">
                <span className="text-zinc-500">Detraccion ({parsedDetraccion}%)</span>
                <span className="font-mono text-zinc-700">{formatCurrency(computedDetraccion, currency)}</span>
              </div>
            )}
            {hasPayments && (
              <>
                <div className="flex justify-between">
                  <span className="font-medium text-zinc-500">Paid</span>
                  <span className="font-mono text-zinc-700">{formatCurrency(amountPaid, currency)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="font-medium text-zinc-500">Outstanding</span>
                  <span className="font-mono font-semibold text-red-600">{formatCurrency(Math.max(0, computedTotal - amountPaid), currency)}</span>
                </div>
              </>
            )}
          </div>
        </div>
        <div className="text-[10px] text-zinc-400 mt-1.5">Totals auto-calculated from line items.</div>
      </div>

      {error && <p className="text-xs font-medium text-red-600">{error}</p>}

      {/* Footer */}
      <div className="flex items-center justify-between border-t border-zinc-200 pt-3">
        <button onClick={onCancel} disabled={isPending}
          className="rounded-md border border-zinc-300 px-4 py-1.5 text-sm font-medium text-zinc-600 transition-colors hover:bg-zinc-100">
          Cancel
        </button>
        <button onClick={handleSubmit} disabled={isPending}
          className="rounded-md bg-blue-600 px-4 py-1.5 text-sm font-medium text-white transition-colors hover:bg-blue-700 disabled:opacity-50">
          {isPending ? 'Saving...' : 'Save Changes'}
        </button>
      </div>
    </div>
  )
}

// --- Delete Confirmation ---
function DeleteContent({ detail, onCancel, onSuccess }: {
  detail: InvoiceDetailData
  onCancel: () => void
  onSuccess: () => void
}) {
  const invoice = detail.invoice!
  const [isPending, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)
  const currency = invoice.currency ?? 'PEN'
  const paymentCount = detail.payments.length
  const paymentTotal = detail.payments.reduce((sum, p) => sum + p.amount, 0)

  function handleConfirm() {
    setError(null)
    startTransition(async () => {
      const result = await deactivateInvoice(invoice.invoice_id!)
      if (result.error) {
        setError(result.error)
      } else {
        onSuccess()
      }
    })
  }

  return (
    <div className="space-y-4 px-4 py-3">
      {/* Dimmed invoice info */}
      <div className="opacity-40 pointer-events-none">
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
          <DetailField label="Direction" value={invoice.direction === 'receivable' ? 'Receivable' : 'Payable'} />
          <DetailField label="Entity" value={invoice.entity_id ? '—' : 'Informal'} />
          <DetailField label="Invoice #" value={invoice.invoice_number ?? '--'} />
          <DetailField label="Total" value={formatCurrency(invoice.total ?? 0, currency)} />
        </div>
      </div>

      {/* Red confirmation box */}
      <div className="rounded-lg border-2 border-red-200 bg-red-50 px-5 py-4">
        <div className="flex items-start gap-3">
          <div className="mt-0.5 flex-shrink-0 rounded-full bg-red-100 p-1.5">
            <svg width="16" height="16" viewBox="0 0 20 20" fill="currentColor" className="text-red-500">
              <path fillRule="evenodd" d="M8.485 2.495c.673-1.167 2.357-1.167 3.03 0l6.28 10.875c.673 1.167-.17 2.625-1.516 2.625H3.72c-1.347 0-2.189-1.458-1.515-2.625L8.485 2.495zM10 5a.75.75 0 01.75.75v3.5a.75.75 0 01-1.5 0v-3.5A.75.75 0 0110 5zm0 9a1 1 0 100-2 1 1 0 000 2z" clipRule="evenodd" />
            </svg>
          </div>
          <div className="flex-1">
            <h4 className="text-sm font-semibold text-red-800">Deactivate this invoice?</h4>
            <p className="text-sm text-red-700 mt-1">
              {paymentCount > 0 ? (
                <>This will also deactivate <strong>{paymentCount} related payment{paymentCount !== 1 ? 's' : ''}</strong> totaling <strong className="font-mono">{formatCurrency(paymentTotal, currency)}</strong>. The entity&apos;s balance will be adjusted.</>
              ) : (
                <>This invoice has no payments. It will be removed from all views and calculations.</>
              )}
            </p>
            <p className="text-xs text-red-500 mt-2">This action can be reversed by an administrator.</p>

            {error && <p className="text-xs font-medium text-red-800 mt-2">{error}</p>}

            <div className="flex items-center justify-end gap-3 mt-4">
              <button onClick={onCancel} disabled={isPending}
                className="rounded-md border border-zinc-300 bg-white px-3.5 py-1.5 text-sm font-medium text-zinc-600 transition-colors hover:bg-zinc-50">
                Cancel
              </button>
              <button onClick={handleConfirm} disabled={isPending}
                className="rounded-md bg-red-600 px-3.5 py-1.5 text-sm font-medium text-white transition-colors hover:bg-red-700 disabled:opacity-50">
                {isPending ? 'Deactivating...' : 'Yes, deactivate'}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

// --- Main Component ---
export function InvoiceExpandContent({ detail, row, mode, onSetMode, onMutationSuccess, onPaymentSuccess, categories }: Props) {
  if (!detail.invoice) return <p className="py-2 text-sm text-zinc-400">No detail available.</p>

  if (mode === 'edit') {
    return (
      <EditContent
        detail={detail}
        row={row}
        categories={categories}
        onCancel={() => onSetMode('view')}
        onSuccess={onMutationSuccess}
      />
    )
  }

  if (mode === 'delete') {
    return (
      <DeleteContent
        detail={detail}
        onCancel={() => onSetMode('view')}
        onSuccess={onMutationSuccess}
      />
    )
  }

  return (
    <ViewContent
      detail={detail}
      onSetMode={onSetMode}
      onPaymentSuccess={onPaymentSuccess}
    />
  )
}
