type Props = {
  title: string
  children: React.ReactNode
  className?: string
}

export function SectionCard({ title, children, className }: Props) {
  return (
    <section className={`rounded-lg border border-zinc-200 bg-white ${className ?? ''}`}>
      <div className="border-b border-zinc-200 bg-zinc-50 px-6 py-3">
        <h2 className="text-sm font-semibold uppercase tracking-wider text-zinc-600">{title}</h2>
      </div>
      {children}
    </section>
  )
}
