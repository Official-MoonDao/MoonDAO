import useETHPrice from '@/lib/etherscan/useETHPrice'
import { fmt, fmtPrizeEth, fmtUsdFromEth } from '@/lib/deprize/format'

type EthUsdProps = {
  eth?: number | null
  approx?: boolean
  prize?: boolean
  signed?: boolean
  unit?: string
  decimals?: number
  /** `inline` (default) keeps ETH and USD on one line; `below` stacks USD under ETH. */
  layout?: 'inline' | 'below'
  className?: string
  usdClassName?: string
  empty?: string
}

/**
 * ETH amount with a live USD equivalent, using the same `useETHPrice` quote
 * as missions / the weekly reward pool. USD is omitted (ETH only) until a
 * price is available so a missing quote never blanks the primary figure.
 */
export default function EthUsd({
  eth,
  approx = false,
  prize = false,
  signed = false,
  unit = 'ETH',
  decimals,
  layout = 'inline',
  className,
  usdClassName = 'text-white/55 font-normal',
  empty = '—',
}: EthUsdProps) {
  const { ethPrice } = useETHPrice(1, 'ETH_TO_USD')

  if (eth == null || !Number.isFinite(eth)) {
    return <span className={className}>{empty}</span>
  }

  const ethStr = prize ? fmtPrizeEth(Math.abs(eth)) : fmt(Math.abs(eth), decimals)
  const sign = signed ? (eth > 0 ? '+' : eth < 0 ? '-' : '') : eth < 0 ? '-' : ''
  const usd = fmtUsdFromEth(eth, ethPrice, { signed })
  const ethLabel = `${approx ? '≈ ' : ''}${sign}${ethStr} ${unit}`

  if (layout === 'below') {
    return (
      <span className={`inline-flex flex-col items-end ${className ?? ''}`}>
        <span>{ethLabel}</span>
        {usd != null && <span className={usdClassName}>~{usd}</span>}
      </span>
    )
  }

  return (
    <span className={className}>
      {ethLabel}
      {usd != null && <span className={usdClassName}> (~{usd})</span>}
    </span>
  )
}
