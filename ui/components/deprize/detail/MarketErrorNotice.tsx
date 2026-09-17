import { Notice } from './primitives'

export default function MarketErrorNotice({ error }: { error?: unknown }) {
  if (!error) return null
  return <Notice tone="red">Couldn&apos;t load market data — reload.</Notice>
}
