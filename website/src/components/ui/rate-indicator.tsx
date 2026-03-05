type RateIndicatorProps = {
  rate: number
  date: string
} | null

export function RateIndicator(props: { data: RateIndicatorProps }) {
  if (!props.data) return null

  const { rate, date } = props.data

  return (
    <p className="mt-3 text-xs text-zinc-500">
      Exchange rate: USD/PEN {rate.toFixed(4)} (as of {date})
    </p>
  )
}
