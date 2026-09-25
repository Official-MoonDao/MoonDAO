import useETHPrice from '@/lib/etherscan/useETHPrice'
import { fmtUsdFromEth } from '@/lib/deprize/format'

/**
 * Dollar-led prize figure. Whole dollars once the pool is at least $1, so a
 * testnet pool of a few thousandths of an ETH reads as "$13" instead of
 * "0.0049 ETH".
 */
export default function PrizeAvailable({
  eth,
  loading,
  size = 'card',
}: {
  eth: number | undefined | null
  loading?: boolean
  size?: 'card' | 'hero' | 'footer'
}) {
  const { ethPrice } = useETHPrice(1, 'ETH_TO_USD')
  if (loading) return <span className="text-gray-500">…</span>

  const usd = fmtUsdFromEth(eth ?? undefined, ethPrice)
  const dollars = eth != null && ethPrice != null && ethPrice > 0 ? eth * ethPrice : null
  const rounded =
    dollars != null && dollars >= 1 ? `$${Math.round(dollars).toLocaleString('en-US')}` : usd

  const figure =
    size === 'hero'
      ? 'text-2xl sm:text-3xl'
      : size === 'footer'
        ? 'text-sm'
        : 'text-lg sm:text-xl'

  return (
    <span className="inline-flex flex-col items-start">
      <span className={`${figure} font-bold tabular-nums leading-none text-emerald-300`}>
        {rounded ?? '—'}
      </span>
      <span className="mt-1 text-[11px] font-semibold uppercase tracking-wide text-emerald-200/80">
        Prize available
      </span>
    </span>
  )
}
