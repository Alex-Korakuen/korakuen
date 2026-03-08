type Props = {
  onCancel: () => void
  onSubmit: () => void
  disabled: boolean
  isPending: boolean
  submitLabel?: string
  pendingLabel?: string
}

export function ModalActions({
  onCancel,
  onSubmit,
  disabled,
  isPending,
  submitLabel = 'Create',
  pendingLabel = 'Creating...',
}: Props) {
  return (
    <div className="flex justify-end gap-2 pt-2">
      <button
        type="button"
        onClick={onCancel}
        className="rounded px-4 py-2 text-sm text-zinc-600 transition-colors hover:bg-zinc-100"
      >
        Cancel
      </button>
      <button
        type="button"
        onClick={onSubmit}
        disabled={disabled || isPending}
        className="rounded bg-blue-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-blue-700 disabled:opacity-50"
      >
        {isPending ? pendingLabel : submitLabel}
      </button>
    </div>
  )
}
