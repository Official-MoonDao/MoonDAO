import { useEffect, useMemo, useState } from 'react'
import useSWR from 'swr'
import fetcher from '@/lib/swr/fetcher'

type QuoteDirection = 'ETH_TO_USD' | 'USD_TO_ETH'

const LOCAL_STORAGE_KEY = 'moondao:eth-usd-price'
const LOCAL_STORAGE_TTL_MS = 1000 * 60 * 60 * 24 // 24h — only as a *last* resort

type CachedPrice = { price: number; ts: number }

function readCachedPrice(): CachedPrice | null {
  if (typeof window === 'undefined') return null
  try {
    const raw = window.localStorage.getItem(LOCAL_STORAGE_KEY)
    if (!raw) return null
    const parsed = JSON.parse(raw)
    const price = Number(parsed?.price)
    const ts = Number(parsed?.ts)
    if (!Number.isFinite(price) || price <= 0 || !Number.isFinite(ts)) {
      return null
    }
    if (Date.now() - ts > LOCAL_STORAGE_TTL_MS) return null
    return { price, ts }
  } catch {
    return null
  }
}

function writeCachedPrice(price: number) {
  if (typeof window === 'undefined') return
  try {
    window.localStorage.setItem(
      LOCAL_STORAGE_KEY,
      JSON.stringify({ price, ts: Date.now() })
    )
  } catch {
    // Quota / private mode — ignore, this is just a cache.
  }
}

/**
 * `useETHPrice` resolves the current ETH/USD price.
 *
 * Resilience matters here: the contribution UI (MissionPayRedeem,
 * MissionContributeModal) divides USD by this price to figure out the ETH
 * amount and the resulting token quote. If this hook ever returns a falsy
 * price, the user sees "You receive 0" with no explanation. To avoid that
 * we (a) hit a backend endpoint that already races multiple price sources
 * (etherscan / coingecko / cryptocompare), (b) keep the previous good
 * value when SWR transitions to an error state, and (c) fall back to a
 * localStorage-cached price (≤24h old) before giving up.
 */
export default function useETHPrice(
  amount: number,
  direction: QuoteDirection = 'ETH_TO_USD'
) {
  const {
    data: ethPriceData,
    isLoading: isLoadingPrice,
    error,
  } = useSWR('/api/etherscan/eth-price', fetcher, {
    refreshInterval: 60000,
    revalidateOnFocus: false,
    keepPreviousData: true,
    dedupingInterval: 30000,
    errorRetryCount: 3,
    errorRetryInterval: 2000,
    shouldRetryOnError: true,
  })

  const fetchedPrice = useMemo<number | null>(() => {
    const raw = ethPriceData?.result?.ethusd
    if (raw == null) return null
    const price = typeof raw === 'string' ? parseFloat(raw) : Number(raw)
    if (!Number.isFinite(price) || price <= 0) return null
    return price
  }, [ethPriceData])

  // Hold on to the last successfully-fetched price across renders so a
  // transient SWR error doesn't drop us back to null mid-typing.
  //
  // Initialized lazily from localStorage (≤24h old) so the very first
  // render on a slow network can already quote a contribution against the
  // cached value rather than briefly showing 0. The lazy initializer runs
  // exactly once per mount and keeps the render itself pure (no
  // localStorage reads or ref mutations during render — that pattern
  // misbehaves under React strict-mode double-invocation).
  const [lastGoodPrice, setLastGoodPrice] = useState<number | null>(() => {
    const cached = readCachedPrice()
    return cached ? cached.price : null
  })

  useEffect(() => {
    if (fetchedPrice != null && fetchedPrice !== lastGoodPrice) {
      setLastGoodPrice(fetchedPrice)
      writeCachedPrice(fetchedPrice)
    }
  }, [fetchedPrice, lastGoodPrice])

  const ethPrice = fetchedPrice ?? lastGoodPrice ?? null

  const convertedAmount = useMemo(() => {
    if (!ethPrice || !amount) return 0

    if (direction === 'ETH_TO_USD') {
      return amount * ethPrice
    } else {
      return amount / ethPrice
    }
  }, [ethPrice, amount, direction])

  // Only report "loading" if we have *no* price at all to work with.
  // Once we have any usable number (fresh or cached) the contribution UI
  // can quote against it, and SWR will silently revalidate in the
  // background.
  const isLoading = isLoadingPrice && ethPrice == null

  return { data: convertedAmount, isLoading, error, ethPrice }
}
