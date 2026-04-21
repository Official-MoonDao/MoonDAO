import { useEffect, useMemo, useRef } from 'react'
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

  // Hold on to the last successfully-fetched price across renders so a
  // transient SWR error doesn't drop us back to null mid-typing.
  const lastGoodPriceRef = useRef<number | null>(null)

  const fetchedPrice = useMemo<number | null>(() => {
    const raw = ethPriceData?.result?.ethusd
    if (raw == null) return null
    const price = typeof raw === 'string' ? parseFloat(raw) : Number(raw)
    if (!Number.isFinite(price) || price <= 0) return null
    return price
  }, [ethPriceData])

  // On first mount, hydrate the ref from localStorage so contributions are
  // computable immediately on a slow network. (Initialized lazily here
  // rather than via useState so we don't ship a stale price as the source
  // of truth — `fetchedPrice` always wins once SWR resolves.)
  if (lastGoodPriceRef.current == null && fetchedPrice == null) {
    const cached = readCachedPrice()
    if (cached) lastGoodPriceRef.current = cached.price
  }

  useEffect(() => {
    if (fetchedPrice != null) {
      lastGoodPriceRef.current = fetchedPrice
      writeCachedPrice(fetchedPrice)
    }
  }, [fetchedPrice])

  const ethPrice = fetchedPrice ?? lastGoodPriceRef.current ?? null

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
