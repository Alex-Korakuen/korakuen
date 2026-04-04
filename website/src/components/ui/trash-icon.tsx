import { iconTrash } from '@/lib/styles'

type Size = 'xs' | 'sm' | 'md'

const SIZE_PX: Record<Size, number> = { xs: 12, sm: 14, md: 16 }
const SIZE_CLASS: Record<Size, string> = {
  xs: 'h-3 w-3',
  sm: 'h-3.5 w-3.5',
  md: 'h-4 w-4',
}

/** Trash icon for delete actions. Use `size` for presets, or `className` to override. */
export function TrashIcon({ size = 'sm', className }: { size?: Size; className?: string }) {
  const cls = className ?? SIZE_CLASS[size]
  const px = SIZE_PX[size]
  return (
    <svg width={px} height={px} viewBox="0 0 20 20" fill="currentColor" className={cls}>
      <path fillRule="evenodd" d={iconTrash} clipRule="evenodd" />
    </svg>
  )
}
