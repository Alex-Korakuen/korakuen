import { btnPrimaryLg, btnSecondary } from '@/lib/styles'

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
        className={btnSecondary}
      >
        Cancel
      </button>
      <button
        type="button"
        onClick={onSubmit}
        disabled={disabled || isPending}
        className={`${btnPrimaryLg} disabled:opacity-50`}
      >
        {isPending ? pendingLabel : submitLabel}
      </button>
    </div>
  )
}
