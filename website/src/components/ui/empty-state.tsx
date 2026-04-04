type Padding = 'sm' | 'md'

const PADDING_CLASS: Record<Padding, string> = {
  sm: 'px-4 py-8',
  md: 'px-6 py-8',
}

/** Centered "No X found" / "Loading…" message shown when a table or list is empty. */
export function EmptyState({ message, padding = 'sm' }: { message: string; padding?: Padding }) {
  return (
    <div className={`${PADDING_CLASS[padding]} text-center text-sm text-faint`}>
      {message}
    </div>
  )
}
