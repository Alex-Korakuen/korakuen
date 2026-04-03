import { cardRadius } from '@/lib/styles'

type Props = {
  title?: string
  children: React.ReactNode
  className?: string
}

export function SectionCard({ title, children, className }: Props) {
  return (
    <section className={`${cardRadius} border border-edge bg-white ${className ?? ''}`}>
      {title && (
        <div className="border-b border-edge bg-panel px-4 py-3">
          <h2 className="text-[10px] font-semibold uppercase tracking-[0.08em] text-muted">{title}</h2>
        </div>
      )}
      {children}
    </section>
  )
}
