'use client'

import { useState, useRef, useEffect, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { inputCompactClass, iconCheck, iconX } from '@/lib/styles'
import { LockIcon } from './lock-icon'

type BaseProps = {
  /** Current raw value */
  value: string | number | null
  /** Formatted display string (e.g. "S/ 1,234.00"). Falls back to value. */
  displayValue?: string | null
  /** Label shown above the field */
  label?: string
  /** Shown when value is null/empty */
  placeholder?: string
  /** Save callback — returns error string on failure. Optional for locked fields. */
  onSave?: (value: string | number | null) => Promise<{ error?: string }>
  /** Called after a successful save (e.g. to refresh coupled fields) */
  onAfterSave?: () => void
  /** If true, shows LockIcon and disables editing */
  locked?: boolean
  /** Right-align value (for numbers/money) */
  align?: 'left' | 'right'
  /** Use monospace font */
  mono?: boolean
  /** Additional wrapper className */
  className?: string
}

type TextProps = BaseProps & { inputType: 'text' }
type NumberProps = BaseProps & { inputType: 'number'; step?: string; min?: string; max?: string }
type DateProps = BaseProps & { inputType: 'date' }
type TextareaProps = BaseProps & { inputType: 'textarea' }
type SelectProps = BaseProps & { inputType: 'select'; options: { value: string; label: string }[] }

export type InlineEditProps = TextProps | NumberProps | DateProps | TextareaProps | SelectProps

function ConfirmButton({ onClick, disabled }: { onClick: () => void; disabled?: boolean }) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className="rounded p-0.5 text-positive transition-colors hover:bg-positive-bg disabled:opacity-40"
      title="Save"
    >
      <svg width="14" height="14" viewBox="0 0 20 20" fill="currentColor">
        <path fillRule="evenodd" d={iconCheck} clipRule="evenodd" />
      </svg>
    </button>
  )
}

function CancelButton({ onClick, disabled }: { onClick: () => void; disabled?: boolean }) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className="rounded p-0.5 text-faint transition-colors hover:bg-negative-bg hover:text-negative disabled:opacity-40"
      title="Cancel"
    >
      <svg width="14" height="14" viewBox="0 0 20 20" fill="currentColor">
        <path d={iconX} />
      </svg>
    </button>
  )
}

export function InlineEdit(props: InlineEditProps) {
  const {
    value,
    displayValue,
    label,
    placeholder = '--',
    onSave,
    onAfterSave,
    locked = false,
    align = 'left',
    mono = false,
    className = '',
    inputType,
  } = props

  const router = useRouter()
  const [editing, setEditing] = useState(false)
  const [saving, setSaving] = useState(false)
  const [draft, setDraft] = useState('')
  const [error, setError] = useState<string | null>(null)
  const inputRef = useRef<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>(null)

  // When entering edit mode, seed the draft from current value
  function startEdit() {
    if (locked || saving || !onSave) return
    setDraft(value?.toString() ?? '')
    setError(null)
    setEditing(true)
  }

  // Auto-focus when editing starts
  useEffect(() => {
    if (editing && inputRef.current) {
      inputRef.current.focus()
      // Select text for text/number inputs
      if (inputType === 'text' || inputType === 'number') {
        (inputRef.current as HTMLInputElement).select()
      }
    }
  }, [editing, inputType])

  function cancel() {
    setEditing(false)
    setError(null)
  }

  const save = useCallback(async () => {
    if (!onSave) return
    setSaving(true)
    setError(null)

    // Parse the draft value based on input type
    let parsed: string | number | null
    if (inputType === 'number') {
      const num = parseFloat(draft)
      parsed = isNaN(num) ? null : num
    } else {
      parsed = draft.trim() || null
    }

    // Skip save if value unchanged
    const currentStr = value?.toString() ?? ''
    const draftStr = parsed?.toString() ?? ''
    if (currentStr === draftStr) {
      setEditing(false)
      setSaving(false)
      return
    }

    const result = await onSave(parsed)
    setSaving(false)

    if (result.error) {
      setError(result.error)
    } else {
      setEditing(false)
      router.refresh()
      onAfterSave?.()
    }
  }, [draft, inputType, value, onSave, onAfterSave, router])

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === 'Escape') {
      e.preventDefault()
      cancel()
    }
    if (e.key === 'Enter') {
      // Textarea: require Cmd/Ctrl+Enter
      if (inputType === 'textarea' && !e.metaKey && !e.ctrlKey) return
      e.preventDefault()
      save()
    }
  }

  // Display text
  const showValue = displayValue || value?.toString() || ''
  const isEmpty = !showValue
  const displayText = isEmpty ? placeholder : showValue

  const alignCls = align === 'right' ? 'text-right' : 'text-left'
  const monoCls = mono ? 'font-mono' : ''

  // --- Locked field ---
  if (locked) {
    return (
      <div className={className}>
        {label && (
          <span className="mb-1 block text-[11px] font-medium text-faint">
            {label} <LockIcon />
          </span>
        )}
        <span className={`text-sm text-muted ${monoCls} ${alignCls}`}>
          {displayText}
        </span>
      </div>
    )
  }

  // --- Edit mode ---
  if (editing) {
    const inputCls = `${inputCompactClass} w-full bg-white ${monoCls} ${alignCls}`

    let inputEl: React.ReactNode
    if (inputType === 'select') {
      inputEl = (
        <select
          ref={inputRef as React.RefObject<HTMLSelectElement>}
          value={draft}
          onChange={e => setDraft(e.target.value)}
          onKeyDown={handleKeyDown}
          disabled={saving}
          className={inputCls}
        >
          <option value="">--</option>
          {(props as SelectProps).options.map(opt => (
            <option key={opt.value} value={opt.value}>{opt.label}</option>
          ))}
        </select>
      )
    } else if (inputType === 'textarea') {
      inputEl = (
        <textarea
          ref={inputRef as React.RefObject<HTMLTextAreaElement>}
          rows={2}
          value={draft}
          onChange={e => setDraft(e.target.value)}
          onKeyDown={handleKeyDown}
          disabled={saving}
          className={`${inputCls} resize-none`}
          placeholder={placeholder}
        />
      )
    } else {
      inputEl = (
        <input
          ref={inputRef as React.RefObject<HTMLInputElement>}
          type={inputType}
          value={draft}
          onChange={e => setDraft(e.target.value)}
          onKeyDown={handleKeyDown}
          disabled={saving}
          className={inputCls}
          placeholder={placeholder}
          {...(inputType === 'number' ? {
            step: (props as NumberProps).step ?? 'any',
            min: (props as NumberProps).min,
            max: (props as NumberProps).max,
          } : {})}
        />
      )
    }

    return (
      <div className={className}>
        {label && (
          <span className="mb-1 block text-[11px] font-medium text-muted">{label}</span>
        )}
        <div className="flex items-start gap-1">
          <div className="min-w-0 flex-1">{inputEl}</div>
          <div className="flex shrink-0 items-center gap-0.5 pt-1">
            <ConfirmButton onClick={save} disabled={saving} />
            <CancelButton onClick={cancel} disabled={saving} />
          </div>
        </div>
        {error && (
          <p className="mt-1 text-xs text-negative">{error}</p>
        )}
      </div>
    )
  }

  // --- Display mode ---
  return (
    <div className={className}>
      {label && (
        <span className="mb-1 block text-[11px] font-medium text-faint">{label}</span>
      )}
      <span
        onClick={onSave ? startEdit : undefined}
        className={`inline-block rounded px-1 py-0.5 text-sm transition-colors ${onSave ? 'cursor-pointer hover:bg-accent-bg' : ''} ${alignCls} ${monoCls} ${isEmpty ? 'text-faint italic' : 'text-ink'}`}
        role={onSave ? 'button' : undefined}
        tabIndex={onSave ? 0 : undefined}
        onKeyDown={onSave ? (e => { if (e.key === 'Enter') startEdit() }) : undefined}
      >
        {displayText}
      </span>
    </div>
  )
}
