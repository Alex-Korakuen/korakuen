export function getNetColorClass(net: number): string {
  if (net < 0) return 'text-red-600 font-medium'
  if (net > 0) return 'text-green-700'
  return 'text-zinc-500'
}

export function getCumulativeColorClass(cumulative: number, isForecast: boolean): string {
  if (cumulative < 0 && isForecast) return 'text-red-600 font-semibold'
  if (cumulative < 0) return 'text-red-600 font-medium'
  return 'text-zinc-700'
}
