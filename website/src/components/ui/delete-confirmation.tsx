import type { ReactNode } from 'react'

type Props = {
  title: string
  message: ReactNode
  isPending: boolean
  error: string | null
  onCancel: () => void
  onConfirm: () => void
}

export function DeleteConfirmation({ title, message, isPending, error, onCancel, onConfirm }: Props) {
  return (
    <div className="rounded-lg border-2 border-red-200 bg-red-50 px-5 py-4">
      <div className="flex items-start gap-3">
        <div className="mt-0.5 flex-shrink-0 rounded-full bg-red-100 p-1.5">
          <svg width="16" height="16" viewBox="0 0 20 20" fill="currentColor" className="text-red-500">
            <path fillRule="evenodd" d="M8.485 2.495c.673-1.167 2.357-1.167 3.03 0l6.28 10.875c.673 1.167-.17 2.625-1.516 2.625H3.72c-1.347 0-2.189-1.458-1.515-2.625L8.485 2.495zM10 5a.75.75 0 01.75.75v3.5a.75.75 0 01-1.5 0v-3.5A.75.75 0 0110 5zm0 9a1 1 0 100-2 1 1 0 000 2z" clipRule="evenodd" />
          </svg>
        </div>
        <div className="flex-1">
          <h4 className="text-sm font-semibold text-red-800">{title}</h4>
          <p className="text-sm text-red-700 mt-1">{message}</p>
          <p className="text-xs text-red-500 mt-2">This action can be reversed by an administrator.</p>

          {error && <p className="text-xs font-medium text-red-800 mt-2">{error}</p>}

          <div className="flex items-center justify-end gap-3 mt-4">
            <button onClick={onCancel} disabled={isPending}
              className="rounded-md border border-zinc-300 bg-white px-3.5 py-1.5 text-sm font-medium text-zinc-600 transition-colors hover:bg-zinc-50">
              Cancel
            </button>
            <button onClick={onConfirm} disabled={isPending}
              className="rounded-md bg-red-600 px-3.5 py-1.5 text-sm font-medium text-white transition-colors hover:bg-red-700 disabled:opacity-50">
              {isPending ? 'Deactivating...' : 'Yes, deactivate'}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
