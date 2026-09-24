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
 * Juicebox terminal balance for a prize pool. The shared `useTotalFunding`
 * reader batches calls and treats a missing result as 0, so the pool showed
 * "0 ETH" before the balance arrived. This read stays unset until the
 * unbatched call returns a bigint.
 */
export function useDePrizePrizePool(projectId: number | undefined, chainId: number | undefined) {
  const [balanceWei, setBalanceWei] = useState<bigint | null>(null)
  const [loading, setLoading] = useState(projectId != null && chainId != null)

  useEffect(() => {
    if (projectId == null || chainId == null) {
      setBalanceWei(null)
      setLoading(false)
      return
    }
    let cancelled = false
    setLoading(true)
    setBalanceWei(null)
    const store = getContract({
      client: deprizeReadClient,
      chain: deprizeReadChain(chainId),
      address: JBV5_TERMINAL_STORE_ADDRESS,
      abi: ((JBV5TerminalStore as { abi?: unknown }).abi ?? JBV5TerminalStore) as any,
    })
    rpcRead<bigint>({
      contract: store,
      method: 'balanceOf' as string,
      params: [JBV5_TERMINAL_ADDRESS, projectId, JB_NATIVE_TOKEN_ADDRESS],
    })
      .then((value) => {
        if (cancelled) return
        setBalanceWei(typeof value === 'bigint' ? value : null)
        setLoading(false)
      })
      .catch(() => {
        if (cancelled) return
        setBalanceWei(null)
        setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [projectId, chainId])

  return { balanceWei, loading }
}
