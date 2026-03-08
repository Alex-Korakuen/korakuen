type Props = {
  onClick: () => void
}

export function MobileBackButton({ onClick }: Props) {
  return (
    <button
      onClick={onClick}
      className="mb-4 flex items-center gap-1 text-sm text-zinc-500 hover:text-zinc-700 md:hidden"
    >
      <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 19.5L8.25 12l7.5-7.5" />
      </svg>
      Back
    </button>
  )
}
