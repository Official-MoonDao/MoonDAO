import Selector from './Selector'

export default function RangeSelector({
  range,
  setRange,
}: {
  range: any
  setRange: any
}) {
  const rangeOptions = [
    {
      label: `7 days`,
      value: 7,
    },
    {
      label: `30 days`,
      value: 30,
    },
    {
      label: `1 year`,
      value: 365,
    },
  ]

  return <Selector value={range} onChange={setRange} options={rangeOptions} />
}
