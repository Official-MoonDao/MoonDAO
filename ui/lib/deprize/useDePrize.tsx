import DePrizeRegistryABI from 'const/abis/DePrizeRegistry.json'
import { DEPRIZE_REGISTRY_ADDRESSES } from 'const/config'
import { startTransition, useCallback, useEffect, useMemo, useState } from 'react'
import { getContract, type Chain } from 'thirdweb'
import { DePrizeState, deriveDePrizeFlags, ZERO_BYTES32 } from './constants'
import { deprizeReadChain, deprizeReadClient, rpcRead } from './read'
import { getChainSlug } from '@/lib/thirdweb/chain'

export type DePrizeRecord = {
  deprizeId: number
  jbProjectId: bigint
  conditionId: string
  sunset: bigint
  winningTeamId: bigint
  cancellationNoticeAt: bigint
  state: DePrizeState
  teamIds: bigint[]
  // Derived from state + cancellationNoticeAt (exactly the registry's logic).
  bettingOpen: boolean
  isRefundable: boolean
  isTerminal: boolean
  cancellationPending: boolean
}

export type UseDePrizeResult = {
  deprize: DePrizeRecord | undefined
  loading: boolean
  error: string | undefined
  registryConfigured: boolean
  refresh: () => void
}

// Poll interval for the registry lifecycle (state changes are infrequent).
const REGISTRY_POLL_MS = 30000

export function useDePrizeRegistryContract(chain: Chain) {
  const chainSlug = getChainSlug(chain)
  const address = DEPRIZE_REGISTRY_ADDRESSES[chainSlug] ?? ''
  return useMemo(() => {
    if (!address) return undefined
    return getContract({
      client: deprizeReadClient,
      chain: deprizeReadChain(chain.id),
      address,
      abi: DePrizeRegistryABI as any,
    })
  }, [address, chain.id])
}

/**
 * Reads a single DePrize's lifecycle record from the DePrizeRegistry. The
 * boolean helpers (bettingOpen / isRefundable / isTerminal / cancellationPending)
 * are derived client-side from `state` + `cancellationNoticeAt` — exactly the
 * registry's own logic — to keep this to a single RPC read per poll.
 */
export function useDePrize(deprizeId: number | string | undefined, chain: Chain): UseDePrizeResult {
  const registry = useDePrizeRegistryContract(chain)
  const [deprize, setDePrize] = useState<DePrizeRecord | undefined>()
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | undefined>()

  const idValid =
    deprizeId !== undefined && /^\d+$/.test(String(deprizeId)) && Number(deprizeId) > 0

  const load = useCallback(async () => {
    if (!registry || !idValid) return
    const requestedId = Number(deprizeId)
    setLoading(true)
    setError(undefined)
    // Drop a prior DePrize immediately on id change so consumers never render
    // the old lifecycle/teams/odds against the new route id mid-fetch.
    setDePrize((prev) => (prev?.deprizeId === requestedId ? prev : undefined))
    try {
      // `getDePrize` REVERTS with UnknownDePrize for unregistered ids, so probe
      // the non-reverting `state()` first and surface NONE as a real record
      // (the page renders "does not exist") instead of a generic RPC error.
      const probedState = Number(
        await rpcRead<bigint | number>({
          contract: registry,
          method: 'state' as string,
          params: [BigInt(requestedId)],
        }),
      ) as DePrizeState
      if (probedState === DePrizeState.NONE) {
        startTransition(() => {
          setDePrize({
            deprizeId: requestedId,
            jbProjectId: 0n,
            conditionId: ZERO_BYTES32,
            sunset: 0n,
            winningTeamId: 0n,
            cancellationNoticeAt: 0n,
            state: DePrizeState.NONE,
            teamIds: [],
            bettingOpen: false,
            isRefundable: false,
            isTerminal: false,
            cancellationPending: false,
          })
        })
        return
      }
      const dp = await rpcRead<any>({
        contract: registry,
        method: 'getDePrize' as string,
        params: [BigInt(requestedId)],
      })
      const state = Number(dp.state) as DePrizeState
      const cancellationNoticeAt = BigInt(dp.cancellationNoticeAt ?? 0)
      startTransition(() => {
        setDePrize({
          deprizeId: requestedId,
          jbProjectId: BigInt(dp.jbProjectId ?? 0),
          conditionId: dp.ctfConditionId ?? ZERO_BYTES32,
          sunset: BigInt(dp.sunset ?? 0),
          winningTeamId: BigInt(dp.winningTeamId ?? 0),
          cancellationNoticeAt,
          state,
          teamIds: (dp.teamIds ?? []).map((t: any) => BigInt(t)),
          ...deriveDePrizeFlags(state, cancellationNoticeAt),
        })
      })
    } catch (err: any) {
      console.error('[deprize] getDePrize failed', err)
      startTransition(() => {
        setError(err?.shortMessage || err?.message || 'Failed to load DePrize.')
      })
    } finally {
      startTransition(() => setLoading(false))
    }
  }, [registry, idValid, deprizeId])

  useEffect(() => {
    load()
  }, [load])

  useEffect(() => {
    if (!registry || !idValid) return
    const t = setInterval(() => {
      if (typeof document !== 'undefined' && document.hidden) return
      load()
    }, REGISTRY_POLL_MS)
    return () => clearInterval(t)
  }, [registry, idValid, load])

  return {
    deprize,
    loading,
    error,
    registryConfigured: !!registry,
    refresh: load,
  }
}

/** Total number of registered DePrizes (for the index/list page). */
export function useDePrizeCount(chain: Chain): {
  count: number | undefined
  loading: boolean
  registryConfigured: boolean
} {
  const registry = useDePrizeRegistryContract(chain)
  const [count, setCount] = useState<number | undefined>()
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if (!registry) return
    let cancelled = false
    setLoading(true)
    ;(async () => {
      try {
        const c = await rpcRead<bigint>({
          contract: registry,
          method: 'count' as string,
          params: [],
        })
        if (!cancelled) {
          startTransition(() => setCount(Number(c)))
        }
      } catch (err) {
        console.error('[deprize] count failed', err)
      } finally {
        if (!cancelled) {
          startTransition(() => setLoading(false))
        }
      }
    })()
    return () => {
      cancelled = true
    }
  }, [registry])

  return { count, loading, registryConfigured: !!registry }
}
