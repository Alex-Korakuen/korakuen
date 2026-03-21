'use client'

import { useState, useRef, useTransition } from 'react'
import { Modal } from '@/components/ui/modal'
import { btnPrimaryLg } from '@/lib/styles'
import * as XLSX from 'xlsx'

export type ImportError = { row: number; column: string; message: string }
export type ImportResult = { success?: number; errors?: ImportError[]; error?: string }

type Props = {
  isOpen: boolean
  onClose: () => void
  title: string
  onImport: (rows: Record<string, unknown>[]) => Promise<ImportResult>
}

function parseExcelFile(file: File): Promise<Record<string, unknown>[]> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = (e) => {
      try {
        const data = new Uint8Array(e.target!.result as ArrayBuffer)
        const workbook = XLSX.read(data, { type: 'array', cellDates: true })
        const sheet = workbook.Sheets[workbook.SheetNames[0]]
        const allRows = XLSX.utils.sheet_to_json(sheet, { header: 1 }) as unknown[][]

        if (allRows.length < 5) {
          resolve([])
          return
        }

        // Row 0 = headers, rows 1-3 = example/description/enum (skip), rows 4+ = data
        const headers = (allRows[0] as (string | undefined)[]).map(h =>
          h ? String(h).trim() : ''
        )
        const dataRows = allRows.slice(4)

        const rows = dataRows
          .filter(row =>
            Array.isArray(row) && row.some(cell => cell !== undefined && cell !== null && cell !== '')
          )
          .map(row => {
            const obj: Record<string, unknown> = {}
            const cells = row as unknown[]
            headers.forEach((h, i) => {
              if (h) {
                const val = cells[i]
                if (val instanceof Date) {
                  obj[h] = val.toISOString().split('T')[0]
                } else {
                  obj[h] = val ?? null
                }
              }
            })
            return obj
          })

        resolve(rows)
      } catch (err) {
        reject(err)
      }
    }
    reader.onerror = reject
    reader.readAsArrayBuffer(file)
  })
}

export function ImportModal({ isOpen, onClose, title, onImport }: Props) {
  const [rows, setRows] = useState<Record<string, unknown>[] | null>(null)
  const [errors, setErrors] = useState<ImportError[] | null>(null)
  const [generalError, setGeneralError] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()
  const [dragOver, setDragOver] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

  function reset() {
    setRows(null)
    setErrors(null)
    setGeneralError(null)
  }

  function handleClose() {
    if (isPending) return
    reset()
    onClose()
  }

  async function handleFile(file: File) {
    if (!file.name.endsWith('.xlsx')) {
      setGeneralError('Only .xlsx files are accepted')
      return
    }
    if (file.size > 5 * 1024 * 1024) {
      setGeneralError('File too large (max 5MB)')
      return
    }
    reset()
    try {
      const parsed = await parseExcelFile(file)
      if (parsed.length === 0) {
        setGeneralError('No data rows found in file')
        return
      }
      setRows(parsed)
    } catch (err) {
      console.error('Error reading file:', err)
      setGeneralError('Error reading file')
    }
  }

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (file) handleFile(file)
    e.target.value = ''
  }

  function handleDrop(e: React.DragEvent) {
    e.preventDefault()
    setDragOver(false)
    const file = e.dataTransfer.files?.[0]
    if (file) handleFile(file)
  }

  function handleImport() {
    if (!rows) return
    startTransition(async () => {
      try {
        const result = await onImport(rows)
        if (result.errors && result.errors.length > 0) {
          setErrors(result.errors)
          setRows(null)
        } else if (result.error) {
          setGeneralError(result.error)
          setRows(null)
        } else {
          handleClose()
        }
      } catch (err) {
        console.error('Import failed:', err)
        setGeneralError(err instanceof Error ? err.message : 'Import failed')
        setRows(null)
      }
    })
  }

  const columns = rows && rows.length > 0 ? Object.keys(rows[0]) : []

  return (
    <Modal isOpen={isOpen} onClose={handleClose} title={title}>
      {/* General error */}
      {generalError && (
        <div className="mb-4 rounded bg-negative-bg px-4 py-3 text-sm text-negative">
          {generalError}
        </div>
      )}

      {/* Validation errors */}
      {errors && errors.length > 0 && (
        <div>
          <div className="mb-3 rounded bg-negative-bg px-4 py-3 text-sm text-negative">
            {errors.length} validation error{errors.length !== 1 ? 's' : ''} found
          </div>
          <div className="max-h-64 overflow-y-auto rounded border border-edge">
            <table className="w-full text-left text-sm">
              <thead className="sticky top-0 bg-panel text-xs font-medium text-muted">
                <tr>
                  <th className="px-3 py-2">Row</th>
                  <th className="px-3 py-2">Column</th>
                  <th className="px-3 py-2">Error</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-edge">
                {errors.map((err, i) => (
                  <tr key={i}>
                    <td className="px-3 py-2 font-mono text-muted">{err.row}</td>
                    <td className="px-3 py-2 text-muted">{err.column}</td>
                    <td className="px-3 py-2 text-negative">{err.message}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Drop zone — show when no rows and no errors */}
      {!rows && !errors && (
        <div
          onDragOver={(e) => { e.preventDefault(); setDragOver(true) }}
          onDragLeave={() => setDragOver(false)}
          onDrop={handleDrop}
          onClick={() => fileInputRef.current?.click()}
          className={`cursor-pointer rounded-[10px] border-2 border-dashed px-6 py-12 text-center transition-colors ${
            dragOver ? 'border-accent bg-accent-bg' : 'border-edge-strong hover:border-faint'
          }`}
        >
          <p className="text-sm text-muted">Drop .xlsx file here or click to browse</p>
          <input
            ref={fileInputRef}
            type="file"
            accept=".xlsx"
            onChange={handleFileChange}
            className="hidden"
          />
        </div>
      )}

      {/* Preview table */}
      {rows && rows.length > 0 && (
        <div>
          <p className="mb-3 text-sm text-muted">
            {rows.length} row{rows.length !== 1 ? 's' : ''} parsed
          </p>
          <div className="max-h-64 overflow-auto rounded border border-edge">
            <table className="w-full text-left text-xs">
              <thead className="sticky top-0 bg-panel text-xs font-medium text-muted">
                <tr>
                  {columns.map(col => (
                    <th key={col} className="whitespace-nowrap px-3 py-2">{col}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-edge">
                {rows.map((row, i) => (
                  <tr key={i}>
                    {columns.map(col => (
                      <td key={col} className="whitespace-nowrap px-3 py-1.5 text-ink">
                        {row[col] != null ? String(row[col]) : ''}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="mt-4 flex justify-end gap-2">
            <button
              type="button"
              onClick={handleClose}
              className="rounded px-4 py-2 text-sm text-muted transition-colors hover:bg-surface"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleImport}
              disabled={isPending}
              className={`${btnPrimaryLg} disabled:opacity-50`}
            >
              {isPending ? 'Importing...' : `Import ${rows.length} rows`}
            </button>
          </div>
        </div>
      )}
    </Modal>
  )
}
