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
  DePrizeState,
  MarketStage,
  ODDS_HISTORY_MAX,
  ODDS_POLL_MS,
  ODDS_SAMPLE_MIN_MS,
  resolvePayoutVector,
  shouldSurfaceResolution,
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
  /**
   * True when DePrizeMint.marketOf(id) returned this LMSR. False when the UI is
   * only showing a config-fallback market for odds (bets via the mint router
   * will revert until setMarket is called).
   */
  mintBound: boolean
  marketConfigured: boolean
  stage: number | undefined
  feePct: number | undefined
  conditionId: string | undefined
  positionIds: bigint[]
  outcomes: Outcome[]
  payoutDen: bigint | undefined
  payoutNums: bigint[]
  marketFeesWei: bigint | undefined
  /**
   * False until this market's payout read has finished. An unreported prize
   * settles at 0n; forecasts stay locked while this is false so a reported
   * prize cannot be voted before that denominator is known.
   */
  payoutSettled: boolean
  resolved: boolean
  winningIndex: number
  isRefundVector: boolean
  /** LMSR market open time (ms), when available — anchors the odds chart domain. */
  marketStartMs: number | undefined
  /** LMSR `funding()` in ETH — the liquidity parameter behind marginal prices. */
  fundingEth: number | undefined
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
  /** Registry lifecycle — gates the resolved-odds chart snap with the page. */
  registryState?: DePrizeState
}): UseDePrizeMarketResult {
  const { deprizeId, conditionId, numOutcomes, chain, userAddress, registryState } = params
  const chainSlug = getChainSlug(chain)
  const readChain = useMemo(() => deprizeReadChain(chain.id), [chain.id])
  // Position-id resolution reads this. A late registry condition must not wipe
  // a mint binding; the config fallback below still re-checks when it arrives.
  const conditionIdRef = useRef(conditionId)
  conditionIdRef.current = conditionId
  const mintBoundRef = useRef(false)
  // Identity of the last market-address attempt. Lets a late condition retry
  // the config LMSR without clearing a binding that already succeeded.
  const appliedMarketIdentityRef = useRef<string | null>(null)
  // Newest marginal prices. The post-position outcomes write reads this so a
  // poll that landed during those reads is not replaced by load()'s snapshot.
  const latestProbRef = useRef<number[] | null>(null)

  const mintAddress = DEPRIZE_MINT_ADDRESSES[chainSlug] ?? ''
  const fallbackLmsr = LMSR_WITH_TWAP_ADDRESSES[chainSlug] ?? ''
  const ctfAddress = CONDITIONAL_TOKEN_ADDRESSES[chainSlug] ?? ''
  const wethAddress = COLLATERAL_TOKEN_ADDRESSES[chainSlug] ?? ''

  const [marketAddress, setMarketAddress] = useState<string | undefined>()
  const [mintBound, setMintBound] = useState(false)
  const [stage, setStage] = useState<number | undefined>()
  const [feePct, setFeePct] = useState<number | undefined>()
  const [positionIds, setPositionIds] = useState<bigint[]>([])
  const [outcomes, setOutcomes] = useState<Outcome[]>(() => emptyOutcomes(numOutcomes))
  const [payoutDen, setPayoutDen] = useState<bigint | undefined>()
  const [payoutNums, setPayoutNums] = useState<bigint[]>([])
  const [marketFeesWei, setMarketFeesWei] = useState<bigint | undefined>()
  const [payoutSettled, setPayoutSettled] = useState(false)
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
    const identity = `${mintAddress}|${String(deprizeId ?? '')}|${fallbackLmsr}|${readChain.id}`
    const sameIdentity = appliedMarketIdentityRef.current === identity
    // Mint already bound this prize. A registry condition that arrives later
    // must not clear it or restart the price read.
    if (sameIdentity && mintBoundRef.current) return

    if (!sameIdentity) {
      appliedMarketIdentityRef.current = null
      mintBoundRef.current = false
      latestProbRef.current = null
      // Invalidate in-flight loads now. The render-time gen bump only sees the
      // address clear on the next pass, which is too late for a finally{} that
      // resolves in between.
      loadGenRef.current += 1
      // Drop the prior market immediately on id change so quotes, charts, and
      // direct LMSR trades never target the previous DePrize while the new
      // binding resolves asynchronously.
      setMarketAddress(undefined)
      setMintBound(false)
      setStage(undefined)
      setFeePct(undefined)
      setPositionIds([])
      setOutcomes(emptyOutcomes(numOutcomes))
      setPayoutDen(undefined)
      setPayoutNums([])
      setPayoutSettled(false)
      setMarketFeesWei(undefined)
      setMarketStartMs(undefined)
      setOddsHistory([])
      setError(undefined)
      setLoading(false)
    }

    const publish = (address: string | undefined, bound: boolean) => {
      if (cancelled || mintBoundRef.current) return
      appliedMarketIdentityRef.current = identity
      mintBoundRef.current = bound
      startTransition(() => {
        if (cancelled) return
        setMarketAddress(address)
        setMintBound(bound)
      })
    }

    ;(async () => {
      if (mint && deprizeId !== undefined && /^\d+$/.test(String(deprizeId))) {
        try {
          const bound = await rpcRead<string>({
            contract: mint,
            method: 'marketOf' as string,
            params: [BigInt(deprizeId as any)],
          })
          if (cancelled) return
          if (bound && !/^0x0+$/.test(bound)) {
            mintBoundRef.current = true
            appliedMarketIdentityRef.current = identity
            startTransition(() => {
              if (cancelled) return
              setMarketAddress(bound)
              setMintBound(true)
            })
            return
          }
        } catch {
          /* fall through to config fallback */
        }
      }
      if (cancelled) return
      if (!fallbackLmsr) {
        publish(undefined, false)
        return
      }
      // Closure value, not the ref: this run must observe the condition that
      // triggered it. A later condition starts its own run.
      const knownCondition = conditionId
      if (knownCondition && !/^0x0+$/.test(knownCondition)) {
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
          if (cancelled) return
          const matched = marketCond.toLowerCase() === knownCondition.toLowerCase()
          publish(matched ? fallbackLmsr : undefined, false)
          return
        } catch {
          /* RPC hiccup — treat as unvalidated below */
        }
      }
      // Registry condition unknown (still loading / DRAFT): don't guess.
      // Mark the attempt so the next condition can retry the fallback without
      // looking like a new prize and wiping state.
      publish(undefined, false)
    })()
    return () => {
      cancelled = true
    }
  }, [mint, deprizeId, fallbackLmsr, readChain, conditionId, mintAddress])

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
  // v2: prior v1 keys could race-hydrate and pin a stale equal-odds (33/33/33)
  // sample over live prices.
  const oddsStorageKey = useMemo(
    () => (marketAddress ? `deprize:oddsHistory:v2:${marketAddress}` : null),
    [marketAddress],
  )
  useEffect(() => {
    if (!oddsStorageKey || typeof window === 'undefined') return
    try {
      const raw = window.localStorage.getItem(oddsStorageKey)
      const stored = raw ? (JSON.parse(raw) as OddsSample[]) : []
      // Merge — never clobber in-memory samples that are newer than storage
      // (load()/poll can record before this effect's setState flushes).
      setOddsHistory((prev) => {
        if (prev.length === 0) return stored
        if (stored.length === 0) return prev
        const prevLast = prev[prev.length - 1]?.t ?? 0
        const storedLast = stored[stored.length - 1]?.t ?? 0
        return prevLast >= storedLast ? prev : stored
      })
    } catch {
      setOddsHistory([])
    }
  }, [oddsStorageKey])

  const recordOddsSample = useCallback(
    (probs: number[]) => {
      if (!probs.length || probs.some((p) => !Number.isFinite(p))) return
      const isFlatEqual = probs.length > 1 && probs.every((p) => Math.abs(p - probs[0]) < 0.05)
      const isUniformPrior = isFlatEqual && Math.abs(probs[0] - 100 / probs.length) < 0.5

      setOddsHistory((prev) => {
        // Once we've observed a traded (non-uniform) market, never append a
        // stale 1/n sample from a racing load/poll — that was pinning the chart
        // at 33/33/33 while the legend showed live odds.
        const hasTradedSample = prev.some(
          (s) => s.p.length > 1 && s.p.some((p) => Math.abs(p - s.p[0]) > 0.5),
        )
        if (isUniformPrior && hasTradedSample) return prev

        const last = prev[prev.length - 1]
        const now = Date.now()
        const moved =
          !last ||
          last.p.length !== probs.length ||
          probs.some((p, i) => Math.abs(p - (last.p[i] ?? NaN)) > 0.05)
        if (last && now - last.t < ODDS_SAMPLE_MIN_MS && !moved) return prev

        // Drop a lone uniform seed when live prices have diverged.
        const lastIsUniform =
          !!last &&
          last.p.length > 1 &&
          last.p.every((p) => Math.abs(p - last.p[0]) < 0.05) &&
          Math.abs(last.p[0] - 100 / last.p.length) < 0.5
        const nextBase = lastIsUniform && moved && !isUniformPrior ? [] : prev
        const next = [...nextBase, { t: now, p: [...probs] }].slice(-ODDS_HISTORY_MAX)
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

  // Chart samples follow the legend's live outcome probs (single source of truth).
  useEffect(() => {
    const probs = outcomes.map((o) => o.probability)
    if (!probs.length || probs.some((p) => !Number.isFinite(p))) return
    recordOddsSample(probs)
  }, [outcomes, recordOddsSample])

  // Static-per-market values (condition id, position ids, fee, start) never change.
  const staticRef = useRef<{
    conditionId: string
    positionIds: bigint[]
    feePct?: number
    marketStartMs?: number
    fundingEth?: number
  } | null>(null)
  const [marketStartMs, setMarketStartMs] = useState<number | undefined>()
  const [fundingEth, setFundingEth] = useState<number | undefined>()
  // Bumped whenever the bound market changes so in-flight loads/polls from a
  // prior navigation cannot overwrite the current market's state.
  const loadGenRef = useRef(0)
  const prevMarketRef = useRef<string | undefined>(marketAddress)
  if (prevMarketRef.current !== marketAddress) {
    prevMarketRef.current = marketAddress
    staticRef.current = null
    latestProbRef.current = null
    loadGenRef.current += 1
  }

  const load = useCallback(async () => {
    // No market yet (or deps mid-reset): never leave a prior load()'s spinner
    // stuck on — that made index cards vanish while tab counts stayed "Live".
    if (!lmsr || !ctf || !weth || numOutcomes <= 0) {
      setLoading(false)
      return
    }
    const gen = ++loadGenRef.current
    setLoading(true)
    setError(undefined)
    // Set once the payout read is in the same transition as the forecast unlock.
    let released = false
    try {
      // Stage, prices, and the payout vector first. Position ids are a dozen
      // extra reads and used to block the card on "…", but the forecast lock
      // is payoutDen — it has to land in the same paint as the odds.
      const registryCond = conditionIdRef.current
      const [stg, prices, earlyPayout] = await Promise.all([
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
              .catch(() => NaN)
          )
        ),
        (async (): Promise<{ den?: bigint; nums?: bigint[] }> => {
          try {
            let cond = registryCond && !/^0x0+$/.test(registryCond) ? registryCond : undefined
            if (!cond) {
              cond = await rpcRead<string>({
                contract: lmsr,
                method: 'conditionIds' as string,
                params: [0n],
              })
            }
            if (!cond || /^0x0+$/.test(cond)) return {}
            const payoutCond = cond
            const [den, nums] = await Promise.all([
              rpcRead({
                contract: ctf,
                method: 'payoutDenominator' as string,
                params: [payoutCond],
              })
                .then((v) => v as bigint)
                .catch(() => undefined),
              Promise.all(
                Array.from({ length: numOutcomes }, (_, i) =>
                  rpcRead({
                    contract: ctf,
                    method: 'payoutNumerators' as string,
                    params: [payoutCond, BigInt(i)],
                  })
                    .then((v) => v as bigint)
                    .catch(() => 0n)
                )
              ),
            ])
            return { den, nums }
          } catch {
            return {}
          }
        })(),
      ])
      if (loadGenRef.current !== gen) return
      const pricesValid = stg !== MarketStage.Closed
      const livePrices = (prices as number[]).map((p) => (pricesValid ? p : NaN))
      latestProbRef.current = livePrices
      const payoutReady = earlyPayout.den !== undefined
      if (payoutReady) released = true
      startTransition(() => {
        if (loadGenRef.current !== gen) return
        setStage(stg)
        if (payoutReady) {
          setPayoutDen(earlyPayout.den)
          setPayoutNums(earlyPayout.nums ?? [])
          setPayoutSettled(true)
        }
        setOutcomes((prev) =>
          Array.from({ length: numOutcomes }, (_, i) => {
            const latest = latestProbRef.current?.[i]
            return {
              index: i,
              probability:
                pricesValid && Number.isFinite(latest) ? (latest as number) : livePrices[i] ?? NaN,
              balance: prev[i]?.balance ?? NaN,
              balanceWei: prev[i]?.balanceWei,
              positionId: prev[i]?.positionId ?? 0n,
            }
          })
        )
        // Leave loading set when the payout read failed so cards stay locked
        // until the position path retries it.
        if (payoutReady) setLoading(false)
      })

      // Balances and position ids can fail without hiding odds that already rendered.
      try {
        if (!staticRef.current) {
          // Prefer the registry's condition; fall back to the market's own.
          let cond = conditionIdRef.current
          if (!cond || /^0x0+$/.test(cond)) {
            cond = await rpcRead<string>({
              contract: lmsr,
              method: 'conditionIds' as string,
              params: [0n],
            })
          }
          if (loadGenRef.current !== gen) return
          const [ids, feeRaw, startSec, fundingRaw] = await Promise.all([
            Promise.all(
              Array.from({ length: numOutcomes }, async (_, i) => {
                const indexSet = 1n << BigInt(i)
                const collectionId = await rpcRead<string>({
                  contract: ctf,
                  method: 'getCollectionId' as string,
                  params: [ZERO_BYTES32, cond, indexSet],
                })
                return rpcRead<bigint>({
                  contract: ctf,
                  method: 'getPositionId' as string,
                  params: [wethAddress, collectionId],
                })
              })
            ),
            rpcRead<bigint>({
              contract: lmsr,
              method: 'fee' as string,
              params: [],
            }).catch(() => undefined),
            rpcRead<bigint>({
              contract: lmsr,
              method: 'startTime' as string,
              params: [],
            }).catch(() => 0n),
            rpcRead<bigint>({
              contract: lmsr,
              method: 'funding' as string,
              params: [],
            }).catch(() => undefined),
          ])
          if (loadGenRef.current !== gen) return
          const fee = feeRaw !== undefined ? (Number(feeRaw) / 1e18) * 100 : undefined
          const startNum = Number(startSec)
          const startMs = Number.isFinite(startNum) && startNum > 0 ? startNum * 1000 : undefined
          const funding = fundingRaw !== undefined ? Number(fundingRaw) / Number(UNIT) : undefined
          staticRef.current = {
            conditionId: cond as string,
            positionIds: ids,
            feePct: fee,
            marketStartMs: startMs,
            fundingEth: funding,
          }
          startTransition(() => {
            if (loadGenRef.current !== gen) return
            setPositionIds(ids)
            setFeePct(fee)
            setMarketStartMs(startMs)
            setFundingEth(funding)
          })
        }
        const settled = staticRef.current
        if (!settled) return
        const { conditionId: cond, positionIds: ids } = settled

        const [balances, den, nums, mktFees] = await Promise.all([
          userAddress
            ? Promise.all(
                ids.map((pid) =>
                  rpcRead({
                    contract: ctf,
                    method: 'balanceOf' as string,
                    params: [userAddress, pid],
                  })
                    .then((b) => b as bigint)
                    .catch(() => undefined)
                )
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
                .catch(() => 0n)
            )
          ),
          rpcRead({
            contract: weth,
            method: 'balanceOf' as string,
            params: [marketAddress],
          })
            .then((v) => v as bigint)
            .catch(() => undefined),
        ])

        // Drop stale responses from overlapping loads (Strict Mode / nav churn).
        if (loadGenRef.current !== gen) return
        // Odds history is recorded via the outcomes → recordOddsSample effect so
        // the chart cannot diverge from the legend.
        released = true
        startTransition(() => {
          if (loadGenRef.current !== gen) return
          // A failed retry must not clear a denominator the fast path already published.
          if (den !== undefined) {
            setPayoutDen(den)
            setPayoutNums(nums)
          }
          setPayoutSettled(true)
          setLoading(false)
          setMarketFeesWei(mktFees)
          setOutcomes((prev) =>
            ids.map((pid, i) => {
              const balWei = balances[i] as bigint | undefined
              const polled = latestProbRef.current?.[i]
              const previous = prev[i]?.probability
              const probability = !pricesValid
                ? NaN
                : Number.isFinite(polled)
                ? (polled as number)
                : Number.isFinite(previous)
                ? (previous as number)
                : livePrices[i] ?? NaN
              return {
                index: i,
                probability,
                balance: balWei !== undefined ? Number(balWei) / Number(UNIT) : NaN,
                balanceWei: balWei,
                positionId: pid,
              }
            })
          )
        })
      } catch (err: any) {
        if (loadGenRef.current !== gen) return
        console.error('[deprize] position load failed', err)
      }
    } catch (err: any) {
      if (loadGenRef.current !== gen) return
      console.error('[deprize] market load failed', err)
      startTransition(() => {
        if (loadGenRef.current !== gen) return
        setError(err?.shortMessage || err?.message || 'Failed to read the market.')
      })
    } finally {
      if (loadGenRef.current === gen) {
        startTransition(() => {
          if (loadGenRef.current !== gen) return
          setLoading(false)
          // The payout attempt never published. Unlock instead of leaving the
          // forecast lock stuck; `reported` stays false without a denominator.
          if (!released) setPayoutSettled(true)
        })
      }
    }
  }, [lmsr, ctf, weth, numOutcomes, userAddress, wethAddress, marketAddress])

  useEffect(() => {
    load()
  }, [load])

  // Live odds poll while Running (marginal prices only; no spinner).
  useEffect(() => {
    if (!lmsr || stage !== MarketStage.Running || numOutcomes <= 0) return
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
              .catch(() => NaN)
          )
        )
        if (stopped || loadGenRef.current !== gen) return
        const nextProbs = prices.map((p, i) =>
          Number.isFinite(p) ? (p as number) : latestProbRef.current?.[i] ?? NaN
        )
        latestProbRef.current = nextProbs
        // Update outcomes; the chart effect records from that single source.
        startTransition(() => {
          if (stopped || loadGenRef.current !== gen) return
          setOutcomes((prev) =>
            prev.map((o, i) => ({
              ...o,
              probability: Number.isFinite(nextProbs[i]) ? (nextProbs[i] as number) : o.probability,
            }))
          )
        })
      } catch {
        /* transient — next tick retries */
      }
    }
    void tick()
    const id = setInterval(tick, ODDS_POLL_MS)
    return () => {
      stopped = true
      clearInterval(id)
    }
  }, [lmsr, stage, numOutcomes])

  const { resolved, winningIndex, isRefundVector } = resolvePayoutVector(payoutNums, payoutDen)

  // Snap the chart to the payout vector only when resolution should surface —
  // a CTF-only report on a still-OPEN/paused market must not jump the chart
  // while team cards still treat the DePrize as live.
  const resolvedSnapRef = useRef(false)
  useEffect(() => {
    const surface =
      registryState !== undefined &&
      shouldSurfaceResolution({
        ctfResolved: resolved,
        registryState,
        marketClosed: stage === MarketStage.Closed,
      })
    if (!surface) {
      resolvedSnapRef.current = false
      return
    }
    if (resolvedSnapRef.current) return
    const den = payoutDen
    if (den === undefined || den <= 0n) return
    const finalOdds = Array.from({ length: numOutcomes }, (_, i) =>
      i < payoutNums.length ? (Number(payoutNums[i]) / Number(den)) * 100 : NaN,
    )
    recordOddsSample(finalOdds)
    resolvedSnapRef.current = true
  }, [resolved, registryState, stage, payoutNums, payoutDen, numOutcomes, recordOddsSample])

  return {
    marketAddress,
    mintBound,
    marketConfigured: !!marketAddress && !!ctfAddress && !!wethAddress,
    stage,
    feePct,
    conditionId: staticRef.current?.conditionId,
    positionIds,
    outcomes,
    payoutDen,
    payoutNums,
    marketFeesWei,
    payoutSettled,
    resolved,
    winningIndex,
    isRefundVector,
    marketStartMs: marketStartMs ?? staticRef.current?.marketStartMs,
    fundingEth: fundingEth ?? staticRef.current?.fundingEth,
    oddsHistory,
    loading,
    error,
    refresh: load,
  }
}
