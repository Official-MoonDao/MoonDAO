import JBV5TerminalStore from 'const/abis/JBV5TerminalStore.json'
import {
  JB_NATIVE_TOKEN_ADDRESS,
  JBV5_TERMINAL_ADDRESS,
  JBV5_TERMINAL_STORE_ADDRESS,
} from 'const/config'
import { useEffect, useState } from 'react'
import { getContract } from 'thirdweb'
import { deprizeReadChain, deprizeReadClient, rpcRead } from '@/lib/deprize/read'

/**
 * ETH currently held for a prize's Juicebox project.
 *
 * The shared `useTotalFunding` hook reads through the batched thirdweb client.
 * Batched eth_calls in this app decode as undefined, and that undefined is
 * shown as 0. DePrize reads go out one at a time so a real balance is not
 * reported as an empty pool.
 */
export function useDePrizePrizePool(projectId: number | undefined, chainId: number) {
  const [balanceWei, setBalanceWei] = useState<bigint | null>(null)
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if (projectId == null || !Number.isFinite(projectId) || projectId <= 0) {
      setBalanceWei(null)
      setLoading(false)
      return
    }
    let cancelled = false
    setLoading(true)
    const store = getContract({
      client: deprizeReadClient,
      chain: deprizeReadChain(chainId),
      address: JBV5_TERMINAL_STORE_ADDRESS,
      abi: (JBV5TerminalStore as { abi: any }).abi,
    })
    rpcRead<bigint>({
      contract: store,
      method: 'balanceOf' as string,
      params: [JBV5_TERMINAL_ADDRESS, BigInt(projectId), JB_NATIVE_TOKEN_ADDRESS],
    })
      .then((balance) => {
        if (!cancelled) setBalanceWei(balance)
      })
      .catch(() => {
        if (!cancelled) setBalanceWei(null)
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [projectId, chainId])

  return { balanceWei, loading }
}
