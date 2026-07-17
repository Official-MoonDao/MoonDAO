import ConditionalTokensABI from 'const/abis/ConditionalTokens.json'
import DePrizeMintABI from 'const/abis/DePrizeMint.json'
import LMSRWithTWAP from 'const/abis/LMSRWithTWAP.json'
import WETHABI from 'const/abis/WETH.json'
import {
  CONDITIONAL_TOKEN_ADDRESSES,
  COLLATERAL_TOKEN_ADDRESSES,
  DEPRIZE_MINT_ADDRESSES,
  LMSR_WITH_TWAP_ADDRESSES,
} from 'const/config'
import { startTransition, useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { getContract, type Chain } from 'thirdweb'
import {
  MarketStage,
  ODDS_HISTORY_MAX,
  ODDS_POLL_MS,
  ODDS_SAMPLE_MIN_MS,
  resolvePayoutVector,
  UNIT,
  ZERO_BYTES32,
} from './constants'
import { deprizeReadChain, deprizeReadClient, rpcRead } from './read'
import { getChainSlug } from '@/lib/thirdweb/chain'
import type { OddsSample } from '@/components/deprize/OddsHistoryChart'

export type Outcome = {
  index: number
  probability: number // %
  balance: number // outcome tokens (== ETH payout if this outcome wins, 1:1)
  balanceWei?: bigint
  positionId: bigint
}

export type UseDePrizeMarketResult = {
  marketAddress: string | undefined
  marketConfigured: boolean
  stage: number | undefined
  feePct: number | undefined
  conditionId: string | undefined
  positionIds: bigint[]
  outcomes: Outcome[]
  payoutDen: bigint | undefined
  payoutNums: bigint[]
  marketFeesWei: bigint | undefined
  resolved: boolean
  winningIndex: number
  isRefundVector: boolean
  oddsHistory: OddsSample[]
  loading: boolean
  error: string | undefined
  refresh: () => void
}

const emptyOutcomes = (n: number): Outcome[] =>
  Array.from({ length: n }, (_, i) => ({
    index: i,
    probability: NaN,
    balance: NaN,
    positionId: 0n,
  }))

/**
 * Reads the LMSR + CTF market for one DePrize: live odds, the connected wallet's
 * per-outcome balances, resolution state, and a persisted odds-history series
 * for the chart. The market address is resolved through `DePrizeMint.marketOf`
 * when the router is deployed, falling back to the configured LMSR address so
 * the UI still renders odds before the router ships.
 */
export function useDePrizeMarket(params: {
  deprizeId: number | string | undefined
  conditionId: string | undefined
  numOutcomes: number
  chain: Chain
  userAddress?: string
}): UseDePrizeMarketResult {
  const { deprizeId, conditionId, numOutcomes, chain, userAddress } = params
  const chainSlug = getChainSlug(chain)
  const readChain = useMemo(() => deprizeReadChain(chain.id), [chain.id])

  const mintAddress = DEPRIZE_MINT_ADDRESSES[chainSlug] ?? ''
  const fallbackLmsr = LMSR_WITH_TWAP_ADDRESSES[chainSlug] ?? ''
  const ctfAddress = CONDITIONAL_TOKEN_ADDRESSES[chainSlug] ?? ''
  const wethAddress = COLLATERAL_TOKEN_ADDRESSES[chainSlug] ?? ''

  const [marketAddress, setMarketAddress] = useState<string | undefined>()
  const [stage, setStage] = useState<number | undefined>()
  const [feePct, setFeePct] = useState<number | undefined>()
  const [positionIds, setPositionIds] = useState<bigint[]>([])
  const [outcomes, setOutcomes] = useState<Outcome[]>(() => emptyOutcomes(numOutcomes))
  const [payoutDen, setPayoutDen] = useState<bigint | undefined>()
  const [payoutNums, setPayoutNums] = useState<bigint[]>([])
  const [marketFeesWei, setMarketFeesWei] = useState<bigint | undefined>()
  const [oddsHistory, setOddsHistory] = useState<OddsSample[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | undefined>()

  const mint = useMemo(() => {
    if (!mintAddress) return undefined
    return getContract({
      client: deprizeReadClient,
      chain: readChain,
      address: mintAddress,
      abi: DePrizeMintABI as any,
    })
  }, [mintAddress, readChain])

  // Resolve the market address: prefer the router's binding (setMarket already
  // validated the wiring on-chain). The config fallback exists only so odds
  // render before the router ships — but the config LMSR is one specific
  // market, so it must ONLY be used for the DePrize whose registry condition
  // it actually settles; otherwise we'd show another DePrize's odds.
  useEffect(() => {
    let cancelled = false
    // Drop the prior market immediately on id/condition change so quotes,
    // charts, and direct LMSR trades never target the previous DePrize while
    // the new binding resolves asynchronously.
    setMarketAddress(undefined)
    setStage(undefined)
    setFeePct(undefined)
    setPositionIds([])
    setOutcomes(emptyOutcomes(numOutcomes))
    setPayoutDen(undefined)
    setPayoutNums([])
    setMarketFeesWei(undefined)
    setOddsHistory([])
    setError(undefined)
    ;(async () => {
      if (mint && deprizeId !== undefined && /^\d+$/.test(String(deprizeId))) {
        try {
          const bound = await rpcRead<string>({
            contract: mint,
            method: 'marketOf' as string,
            params: [BigInt(deprizeId as any)],
          })
          if (!cancelled && bound && !/^0x0+$/.test(bound)) {
            startTransition(() => setMarketAddress(bound))
            return
          }
        } catch {
          /* fall through to config fallback */
        }
      }
      if (!fallbackLmsr) {
        if (!cancelled) startTransition(() => setMarketAddress(undefined))
        return
      }
      if (conditionId && !/^0x0+$/.test(conditionId)) {
        try {
          const fallbackContract = getContract({
            client: deprizeReadClient,
            chain: readChain,
            address: fallbackLmsr,
            abi: LMSRWithTWAP.abi as any,
          })
          const marketCond = await rpcRead<string>({
            contract: fallbackContract,
            method: 'conditionIds' as string,
            params: [0n],
          })
          if (!cancelled) {
            startTransition(() =>
              setMarketAddress(
                marketCond.toLowerCase() === conditionId.toLowerCase() ? fallbackLmsr : undefined,
              ),
            )
          }
          return
        } catch {
          /* RPC hiccup — treat as unvalidated below */
        }
      }
      // Registry condition unknown (still loading / DRAFT): don't guess.
      if (!cancelled) startTransition(() => setMarketAddress(undefined))
    })()
    return () => {
      cancelled = true
    }
  }, [mint, deprizeId, fallbackLmsr, conditionId, readChain, numOutcomes])

  const lmsr = useMemo(() => {
    if (!marketAddress) return undefined
    return getContract({
      client: deprizeReadClient,
      chain: readChain,
      address: marketAddress,
      abi: LMSRWithTWAP.abi as any,
    })
  }, [marketAddress, readChain])
  const ctf = useMemo(() => {
    if (!ctfAddress) return undefined
    return getContract({
      client: deprizeReadClient,
      chain: readChain,
      address: ctfAddress,
      abi: ConditionalTokensABI as any,
    })
  }, [ctfAddress, readChain])
  const weth = useMemo(() => {
    if (!wethAddress) return undefined
    return getContract({
      client: deprizeReadClient,
      chain: readChain,
      address: wethAddress,
      abi: WETHABI as any,
    })
  }, [wethAddress, readChain])

  // Persist odds history per-market so the chart survives reloads.
  const oddsStorageKey = useMemo(
    () => (marketAddress ? `deprize:oddsHistory:v1:${marketAddress}` : null),
    [marketAddress],
  )
  useEffect(() => {
    if (!oddsStorageKey || typeof window === 'undefined') return
    try {
      const raw = window.localStorage.getItem(oddsStorageKey)
      setOddsHistory(raw ? (JSON.parse(raw) as OddsSample[]) : [])
    } catch {
      setOddsHistory([])
    }
  }, [oddsStorageKey])

  const recordOddsSample = useCallback(
    (probs: number[]) => {
      if (!probs.length || probs.some((p) => !Number.isFinite(p))) return
      setOddsHistory((prev) => {
        const last = prev[prev.length - 1]
        const now = Date.now()
        if (last && now - last.t < ODDS_SAMPLE_MIN_MS) {
          const moved = probs.some((p, i) => Math.abs(p - last.p[i]) > 0.05)
          if (!moved) return prev
        }
        const next = [...prev, { t: now, p: probs }].slice(-ODDS_HISTORY_MAX)
        if (oddsStorageKey && typeof window !== 'undefined') {
          try {
            window.localStorage.setItem(oddsStorageKey, JSON.stringify(next))
          } catch {
            /* quota / private mode */
          }
        }
        return next
      })
    },
    [oddsStorageKey],
  )

  // Static-per-market values (condition id, position ids, fee) never change.
  const staticRef = useRef<{
    conditionId: string
    positionIds: bigint[]
    feePct?: number
  } | null>(null)
  // Bumped whenever the bound market changes so in-flight loads/polls from a
  // prior navigation cannot overwrite the current market's state.
  const loadGenRef = useRef(0)
  const prevMarketRef = useRef<string | undefined>(marketAddress)
  if (prevMarketRef.current !== marketAddress) {
    prevMarketRef.current = marketAddress
    staticRef.current = null
    loadGenRef.current += 1
  }

  const load = useCallback(async () => {
    if (!lmsr || !ctf || !weth || numOutcomes <= 0) return
    const gen = ++loadGenRef.current
    setLoading(true)
    setError(undefined)
    try {
      if (!staticRef.current) {
        // Prefer the registry's condition; fall back to the market's own.
        let cond = conditionId
        if (!cond || /^0x0+$/.test(cond)) {
          cond = await rpcRead<string>({
            contract: lmsr,
            method: 'conditionIds' as string,
            params: [0n],
          })
        }
        if (loadGenRef.current !== gen) return
        const ids: bigint[] = []
        for (let i = 0; i < numOutcomes; i++) {
          const indexSet = 1n << BigInt(i)
          const collectionId = await rpcRead<string>({
            contract: ctf,
            method: 'getCollectionId' as string,
            params: [ZERO_BYTES32, cond, indexSet],
          })
          if (loadGenRef.current !== gen) return
          const pid = await rpcRead<bigint>({
            contract: ctf,
            method: 'getPositionId' as string,
            params: [wethAddress, collectionId],
          })
          ids.push(pid)
        }
        const fee = await rpcRead<bigint>({
          contract: lmsr,
          method: 'fee' as string,
          params: [],
        })
          .then((v) => (Number(v) / 1e18) * 100)
          .catch(() => undefined)
        if (loadGenRef.current !== gen) return
        staticRef.current = { conditionId: cond as string, positionIds: ids, feePct: fee }
        startTransition(() => {
          if (loadGenRef.current !== gen) return
          setPositionIds(ids)
          setFeePct(fee)
        })
      }
      const { conditionId: cond, positionIds: ids } = staticRef.current

      const [stg, prices, balances, den, nums, mktFees] = await Promise.all([
        rpcRead({ contract: lmsr, method: 'stage' as string, params: [] })
          .then((v) => Number(v))
          .catch(() => undefined),
        Promise.all(
          Array.from({ length: numOutcomes }, (_, i) =>
            rpcRead({
              contract: lmsr,
              method: 'calcMarginalPrice' as string,
              params: [i],
            })
              .then((p) => (Number(p as bigint) / 2 ** 64) * 100)
              .catch(() => NaN),
          ),
        ),
        userAddress
          ? Promise.all(
              ids.map((pid) =>
                rpcRead({
                  contract: ctf,
                  method: 'balanceOf' as string,
                  params: [userAddress, pid],
                })
                  .then((b) => b as bigint)
                  .catch(() => undefined),
              ),
            )
          : Promise.resolve(ids.map(() => undefined)),
        rpcRead({
          contract: ctf,
          method: 'payoutDenominator' as string,
          params: [cond],
        })
          .then((v) => v as bigint)
          .catch(() => undefined),
        Promise.all(
          Array.from({ length: numOutcomes }, (_, i) =>
            rpcRead({
              contract: ctf,
              method: 'payoutNumerators' as string,
              params: [cond, BigInt(i)],
            })
              .then((v) => v as bigint)
              .catch(() => 0n),
          ),
        ),
        rpcRead({
          contract: weth,
          method: 'balanceOf' as string,
          params: [marketAddress],
        })
          .then((v) => v as bigint)
          .catch(() => undefined),
      ])

      if (loadGenRef.current !== gen) return

      const pricesValid = stg !== MarketStage.Closed
      if (stg === MarketStage.Running) recordOddsSample(prices as number[])
      startTransition(() => {
        if (loadGenRef.current !== gen) return
        setStage(stg)
        setPayoutDen(den)
        setPayoutNums(nums)
        setMarketFeesWei(mktFees)
        setOutcomes(
          ids.map((pid, i) => {
            const balWei = balances[i] as bigint | undefined
            return {
              index: i,
              probability: pricesValid ? (prices[i] as number) : NaN,
              balance: balWei !== undefined ? Number(balWei) / Number(UNIT) : NaN,
              balanceWei: balWei,
              positionId: pid,
            }
          }),
        )
      })
    } catch (err: any) {
      if (loadGenRef.current !== gen) return
      console.error('[deprize] market load failed', err)
      startTransition(() => {
        if (loadGenRef.current !== gen) return
        setError(err?.shortMessage || err?.message || 'Failed to read the market.')
      })
    } finally {
      if (loadGenRef.current === gen) {
        startTransition(() => setLoading(false))
      }
    }
  }, [
    lmsr,
    ctf,
    weth,
    numOutcomes,
    conditionId,
    userAddress,
    wethAddress,
    marketAddress,
    recordOddsSample,
  ])

  useEffect(() => {
    load()
  }, [load])

  // Live odds poll while Running (marginal prices only; no spinner).
  useEffect(() => {
    if (!lmsr || stage !== MarketStage.Running) return
    let stopped = false
    const tick = async () => {
      if (stopped || (typeof document !== 'undefined' && document.hidden)) return
      const gen = loadGenRef.current
      try {
        const prices = await Promise.all(
          Array.from({ length: numOutcomes }, (_, i) =>
            rpcRead({
              contract: lmsr,
              method: 'calcMarginalPrice' as string,
              params: [i],
            })
              .then((p) => (Number(p as bigint) / 2 ** 64) * 100)
              .catch(() => NaN),
          ),
        )
        if (stopped || loadGenRef.current !== gen) return
        recordOddsSample(prices)
        // Keep team cards / index list in sync with the chart — both are labeled
        // "live odds" and must reflect the latest marginal prices.
        startTransition(() => {
          if (stopped || loadGenRef.current !== gen) return
          setOutcomes((prev) =>
            prev.map((o, i) => ({
              ...o,
              probability: Number.isFinite(prices[i]) ? (prices[i] as number) : o.probability,
            })),
          )
        })
      } catch {
        /* transient — next tick retries */
      }
    }
    const id = setInterval(tick, ODDS_POLL_MS)
    return () => {
      stopped = true
      clearInterval(id)
    }
  }, [lmsr, stage, numOutcomes, recordOddsSample])

  // Snap the chart to the payout vector once resolved.
  const resolvedSnapRef = useRef(false)
  useEffect(() => {
    const den = payoutDen
    if (den === undefined || den <= 0n) {
      resolvedSnapRef.current = false
      return
    }
    if (resolvedSnapRef.current) return
    const finalOdds = Array.from({ length: numOutcomes }, (_, i) =>
      i < payoutNums.length ? (Number(payoutNums[i]) / Number(den)) * 100 : NaN,
    )
    recordOddsSample(finalOdds)
    resolvedSnapRef.current = true
  }, [payoutNums, payoutDen, numOutcomes, recordOddsSample])

  const { resolved, winningIndex, isRefundVector } = resolvePayoutVector(payoutNums, payoutDen)

  return {
    marketAddress,
    marketConfigured: !!marketAddress && !!ctfAddress && !!wethAddress,
    stage,
    feePct,
    conditionId: staticRef.current?.conditionId,
    positionIds,
    outcomes,
    payoutDen,
    payoutNums,
    marketFeesWei,
    resolved,
    winningIndex,
    isRefundVector,
    oddsHistory,
    loading,
    error,
    refresh: load,
  }
}
