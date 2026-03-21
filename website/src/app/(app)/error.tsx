'use client'

export default function AppError({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  return (
    <div className="flex flex-col items-center justify-center gap-4 py-20">
      <h2 className="text-lg font-semibold text-ink">Something went wrong</h2>
      <p className="max-w-md text-center text-sm text-muted">
        An unexpected error occurred while loading this page.
      </p>
      <button
        type="button"
        onClick={reset}
        className="rounded-md bg-ink px-4 py-2 text-sm font-medium text-white hover:bg-ink/90"
      >
        Try again
      </button>
    </div>
  )
}
