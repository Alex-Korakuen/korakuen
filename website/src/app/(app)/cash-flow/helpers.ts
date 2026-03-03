export function getNetColorClass(net: number): string {
  if (net < 0) return 'text-red-600 font-medium'
  if (net > 0) return 'text-green-700'
  return 'text-zinc-500'
}
