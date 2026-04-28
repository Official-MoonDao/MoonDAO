//Watch a token balance of the selected wallet
import { useEffect } from 'react'
import { useActiveAccount, useWalletBalance } from 'thirdweb/react'
import client from '@/lib/thirdweb/client'

export default function useWatchTokenBalance(
  selectedChain: any,
  tokenAddress: any
) {
  const account = useActiveAccount()
  const address = account?.address

  const { data: tokenBalance, refetch } = useWalletBalance({
    client,
    address,
    chain: selectedChain,
    tokenAddress,
  })

  useEffect(() => {
    const interval = setInterval(() => {
      refetch()
    }, 10000)
    return () => clearInterval(interval)
  }, [address])

  // Return `null` (rather than `NaN`) when the balance hasn't loaded yet or
  // can't be parsed. Returning `NaN` historically caused subtle bugs in
  // callers that did `Math.floor(balance)` or stuffed the number into a
  // transaction payload — `Math.floor(NaN)` is `NaN`, which then propagated
  // into ethers v5's `BigNumber.from(NaN)` and surfaced as the cryptic
  // "invalid BigNumber string (value=\"NaN\")" toast on the Overview vote
  // page. Callers already null-check / `Number.isFinite`-check this value
  // (e.g. `!userBalance || userBalance <= 0`), so swapping NaN→null is a
  // no-op for the happy path but eliminates the NaN footgun.
  const raw = tokenBalance?.displayValue
  if (raw == null) return null
  const n = Number(raw)
  return Number.isFinite(n) ? n : null
}
