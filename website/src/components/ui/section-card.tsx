type Props = {
  title: string
  children: React.ReactNode
  className?: string
}

export function SectionCard({ title, children, className }: Props) {
  return (
    <div className={`rounded-lg border border-zinc-200 ${className ?? ''}`}>
      <div className="border-b border-zinc-200 bg-zinc-50 px-4 py-3">
        <h3 className="text-sm font-medium text-zinc-700">{title}</h3>
      </div>
      {children}
    </div>
  )
}
