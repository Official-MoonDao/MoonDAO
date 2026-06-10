import ConditionalTokensABI from 'const/abis/ConditionalTokens.json'
import LMSRWithTWAP from 'const/abis/LMSRWithTWAP.json'
import WETHABI from 'const/abis/WETH.json'
import {
  LMSR_WITH_TWAP_ADDRESSES,
  CONDITIONAL_TOKEN_ADDRESSES,
  COLLATERAL_TOKEN_ADDRESSES,
  COLLATERAL_DECIMALS,
  MAX_OUTCOMES,
  ORACLE_ADDRESS,
  OPERATOR_ADDRESS,
  DEFAULT_CHAIN_V5,
} from 'const/config'
import { useLogin } from '@privy-io/react-auth'
import dynamic from 'next/dynamic'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import toast from 'react-hot-toast'
import {
  createThirdwebClient,
  defineChain,
  prepareContractCall,
  readContract,
  sendAndConfirmTransaction,
} from 'thirdweb'
import { useActiveAccount } from 'thirdweb/react'
import { eth_getBalance, getRpcClient } from 'thirdweb/rpc'
import toastStyle from '@/lib/marketplace/marketplace-utils/toastConfig'
import { getChainSlug } from '@/lib/thirdweb/chain'
import useContract from '@/lib/thirdweb/hooks/useContract'
import Container from '@/components/layout/Container'
import ContentLayout from '@/components/layout/ContentLayout'
import Head from '@/components/layout/Head'
import Modal from '@/components/layout/Modal'
import { NoticeFooter } from '@/components/layout/NoticeFooter'
import StandardButton from '@/components/layout/StandardButton'
import type { OddsSample } from '@/components/deprize/OddsHistoryChart'

// Charting lib touches window; load it client-side only to avoid SSR mismatch.
const OddsHistoryChart = dynamic(
  () => import('@/components/deprize/OddsHistoryChart'),
  { ssr: false }
)

// Per-outcome line colors (also used as accents elsewhere if needed).
const OUTCOME_COLORS = [
  '#22c55e',
  '#3b82f6',
  '#a855f7',
  '#f59e0b',
  '#ef4444',
  '#06b6d4',
]

// Don't record odds samples more often than this (live poll + post-trade
// refreshes would otherwise spam near-identical points).
const ODDS_SAMPLE_MIN_MS = 8000
const ODDS_HISTORY_MAX = 1000
const ODDS_POLL_MS = 30000

const ZERO_BYTES32 =
  '0x0000000000000000000000000000000000000000000000000000000000000000'
const UNIT = 10n ** BigInt(COLLATERAL_DECIMALS)
const MAX_UINT256 = (1n << 256n) - 1n

// Keep a little native ETH back for gas when auto-wrapping a bet (wrap + approve
// + trade is ~3 txs). Used both to gate the UI and guard the wrap in buy().
const GAS_RESERVE_WEI = 10n ** 15n // 0.001 ETH
const GAS_RESERVE_ETH = Number(GAS_RESERVE_WEI) / 1e18

// Dedicated read client with RPC batching DISABLED (maxBatchSize: 1). Batching is
// broken in this thirdweb/viem version: when several eth_call results come back
// in one JSON-RPC batch response, the decoder returns `undefined` for some of
// them ("Cannot read properties of undefined (reading 'buffer')"), which silently
// blanks the whole page. So each call goes on its own.
//
// The flip side of no batching is request volume, and the chain RPC is a single
// Infura endpoint shared with the rest of the app — so we additionally cap
// concurrency and retry on 429 (see rpcRead below) to stay under the rate limit.
const readClient = createThirdwebClient({
  clientId: process.env.NEXT_PUBLIC_THIRDWEB_CLIENT_ID as string,
  config: { rpc: { maxBatchSize: 1, fetch: { requestTimeoutMs: 15000 } } },
})

// Read through thirdweb's RPC edge (derived from the client id) rather than the
// app's hardcoded Infura endpoint. The whole app shares that one Infura key, so
// this page's reads kept tripping its 429 rate limit. defineChain(<id>) with no
// explicit rpc makes thirdweb use https://<id>.rpc.thirdweb.com/<clientId>,
// isolating these reads from the app's Infura traffic and its limit.
const READ_CHAIN = defineChain(DEFAULT_CHAIN_V5.id)

// ---- Concurrency-limited, 429-retrying read layer ----
// Never let more than a few reads hit Infura at once (the app makes its own
// requests too), and back off + retry the occasional "429 Too Many Requests".
const MAX_CONCURRENT_READS = 3
let activeReads = 0
const readQueue: Array<() => void> = []
const acquireRead = () =>
  new Promise<void>((resolve) => {
    if (activeReads < MAX_CONCURRENT_READS) {
      activeReads++
      resolve()
    } else {
      readQueue.push(resolve)
    }
  })
const releaseRead = () => {
  activeReads = Math.max(0, activeReads - 1)
  const next = readQueue.shift()
  if (next) {
    activeReads++
    next()
  }
}
async function rpcRead<T = any>(
  args: Parameters<typeof readContract>[0]
): Promise<T> {
  await acquireRead()
  try {
    for (let attempt = 0; ; attempt++) {
      try {
        return (await readContract(args)) as T
      } catch (e: any) {
        const msg = `${e?.message ?? ''} ${e?.shortMessage ?? ''}`.toLowerCase()
        const rateLimited =
          msg.includes('429') ||
          msg.includes('too many requests') ||
          msg.includes('-32005')
        if (rateLimited && attempt < 5) {
          await new Promise((r) => setTimeout(r, 350 * 2 ** attempt))
          continue
        }
        throw e
      }
    }
  } finally {
    releaseRead()
  }
}

// LMSRWithTWAP.stage()
enum MarketStage {
  Running = 0,
  Paused = 1,
  Closed = 2,
}

type Outcome = {
  index: number
  probability: number // %
  balance: number // outcome tokens (== ETH payout if this outcome wins, 1:1)
  positionId: bigint
}

const emptyOutcomes = (): Outcome[] =>
  Array.from({ length: MAX_OUTCOMES }, (_, i) => ({
    index: i,
    probability: NaN,
    balance: NaN,
    positionId: 0n,
  }))

const fmt = (n: number, d = 4) =>
  Number.isFinite(n) ? n.toLocaleString(undefined, { maximumFractionDigits: d }) : '—'

const toWei = (v: string): bigint => {
  if (!v || Number(v) <= 0) return 0n
  const [whole, frac = ''] = v.split('.')
  const fracPadded = (frac + '0'.repeat(COLLATERAL_DECIMALS)).slice(
    0,
    COLLATERAL_DECIMALS
  )
  try {
    return BigInt(whole || '0') * UNIT + BigInt(fracPadded || '0')
  } catch {
    return 0n
  }
}

/**
 * DePrize play harness.
 *
 * A throwaway, dev-facing page that talks DIRECTLY to the already-deployed
 * Gnosis Conditional Tokens + LMSRWithTWAP market (the same stack `DePrizeMint`
 * wraps). It exists to validate the market layer end-to-end with a real wallet
 * before we build the full DePrize bet/positions/claim UI on top.
 *
 * NOTE: a real DePrize bet additionally routes a 5% prize slice into the
 * mission's Juicebox project (minting $OVERVIEW) and refunds leftover ETH — that
 * wrapper is `DePrizeMint.bet`, exercised by the M3 fork test. This page is the
 * underlying market only.
 */
export default function DePrizePlay() {
  const chain = DEFAULT_CHAIN_V5
  const chainSlug = getChainSlug(chain)
  const account = useActiveAccount()
  const userAddress = account?.address
  const { login } = useLogin()

  const lmsrAddress = LMSR_WITH_TWAP_ADDRESSES[chainSlug]
  const ctfAddress = CONDITIONAL_TOKEN_ADDRESSES[chainSlug]
  const wethAddress = COLLATERAL_TOKEN_ADDRESSES[chainSlug]

  const [betAmount, setBetAmount] = useState('')
  const [depositAmount, setDepositAmount] = useState('0.01')
  const [outcomes, setOutcomes] = useState<Outcome[]>(emptyOutcomes)
  const [oddsHistory, setOddsHistory] = useState<OddsSample[]>([])
  const [sellQuotes, setSellQuotes] = useState<Map<number, number>>(new Map())
  const [costBasis, setCostBasis] = useState<Record<number, number>>({})
  const [conditionId, setConditionId] = useState<string | undefined>()
  const [stage, setStage] = useState<number | undefined>()
  const [feePct, setFeePct] = useState<number | undefined>()
  const [wethBalance, setWethBalance] = useState<number | undefined>()
  const [nativeBalance, setNativeBalance] = useState<number | undefined>()
  const [ctfApproved, setCtfApproved] = useState<boolean | undefined>()
  const [loadError, setLoadError] = useState<string | undefined>()
  const [loading, setLoading] = useState(false)
  const [busy, setBusy] = useState(false)

  // Modals
  const [addFundsOpen, setAddFundsOpen] = useState(false)
  const [betIndex, setBetIndex] = useState<number | null>(null)
  const [betQuote, setBetQuote] = useState<{ qty: number; exact: boolean } | null>(
    null
  )

  // Static-per-market values (conditionId, position ids, fee) never change, so
  // resolve them once and reuse — keeps every refresh to the dynamic reads.
  const staticRef = useRef<{
    conditionId: string
    positionIds: bigint[]
    feePct?: number
  } | null>(null)

  // Read contracts: no-batching client (avoids the viem batch-decode bug) on
  // thirdweb's RPC edge (avoids the shared Infura key's 429 rate limit).
  const lmsr = useContract({
    address: lmsrAddress,
    chain: READ_CHAIN,
    abi: LMSRWithTWAP.abi as any,
    forwardClient: readClient,
  })
  const ctf = useContract({
    address: ctfAddress,
    chain: READ_CHAIN,
    abi: ConditionalTokensABI as any,
    forwardClient: readClient,
  })
  const weth = useContract({
    address: wethAddress,
    chain: READ_CHAIN,
    abi: WETHABI as any,
    forwardClient: readClient,
  })
  // Write contracts: app's shared client, consistent with the connected account.
  const lmsrW = useContract({
    address: lmsrAddress,
    chain,
    abi: LMSRWithTWAP.abi as any,
  })
  const ctfW = useContract({
    address: ctfAddress,
    chain,
    abi: ConditionalTokensABI as any,
  })
  const wethW = useContract({
    address: wethAddress,
    chain,
    abi: WETHABI as any,
  })

  const isOracle =
    !!userAddress && userAddress.toLowerCase() === ORACLE_ADDRESS.toLowerCase()
  const isOperator =
    !!userAddress && userAddress.toLowerCase() === OPERATOR_ADDRESS.toLowerCase()

  const configured = !!lmsrAddress && !!ctfAddress && !!wethAddress

  const betAmountWei = useMemo(() => toWei(betAmount), [betAmount])
  const depositAmountWei = useMemo(() => toWei(depositAmount), [depositAmount])
  const betAmountNum = Number(betAmountWei) / Number(UNIT)

  // ---- Live odds history (Polymarket-style) ----
  // Persisted per-market in localStorage so the chart survives reloads and
  // accumulates over time even though there's no on-chain price series.
  const oddsStorageKey = useMemo(
    () => (lmsrAddress ? `deprize:oddsHistory:v1:${lmsrAddress}` : null),
    [lmsrAddress]
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
          // Too soon since the last point: skip unless the odds actually moved
          // (e.g. a fresh trade), so we capture real changes immediately
          // without piling up near-identical points from the live poll.
          const moved = probs.some((p, i) => Math.abs(p - last.p[i]) > 0.05)
          if (!moved) return prev
        }
        const next = [...prev, { t: now, p: probs }].slice(-ODDS_HISTORY_MAX)
        if (oddsStorageKey && typeof window !== 'undefined') {
          try {
            window.localStorage.setItem(oddsStorageKey, JSON.stringify(next))
          } catch {
            /* quota / private mode — chart just won't persist */
          }
        }
        return next
      })
    },
    [oddsStorageKey]
  )

  const loadMarket = useCallback(async () => {
    if (!lmsr || !ctf || !weth) return
    setLoading(true)
    setLoadError(undefined)
    try {
      // 1) Static data (only the first time): condition id, position ids, fee.
      if (!staticRef.current) {
        const cond = await rpcRead<string>({
          contract: lmsr,
          method: 'conditionIds' as string,
          params: [0n],
        })
        const positionIds: bigint[] = []
        for (let i = 0; i < MAX_OUTCOMES; i++) {
          const indexSet = BigInt(1 << i)
          const collectionId = await rpcRead<string>({
            contract: ctf,
            method: 'getCollectionId' as string,
            params: [ZERO_BYTES32, cond, indexSet],
          })
          const pid = await rpcRead<bigint>({
            contract: ctf,
            method: 'getPositionId' as string,
            params: [wethAddress, collectionId],
          })
          positionIds.push(pid)
        }
        const fee = await rpcRead<bigint>({
          contract: lmsr,
          method: 'fee' as string,
          params: [],
        })
          .then((v) => (Number(v) / 1e18) * 100)
          .catch(() => undefined)
        staticRef.current = { conditionId: cond, positionIds, feePct: fee }
        setConditionId(cond)
        setFeePct(fee)
      }
      const { conditionId: cond, positionIds } = staticRef.current

      // 2) Dynamic data, concurrency-limited under the hood (rpcRead).
      const [stg, prices, balances, wb, nb, approved] = await Promise.all([
        rpcRead({ contract: lmsr, method: 'stage' as string, params: [] })
          .then((v) => Number(v))
          .catch(() => undefined),
        Promise.all(
          Array.from({ length: MAX_OUTCOMES }, (_, i) =>
            rpcRead({
              contract: lmsr,
              method: 'calcMarginalPrice' as string,
              params: [i],
            })
              .then((p) => (Number(p as bigint) / 2 ** 64) * 100)
              .catch(() => NaN)
          )
        ),
        userAddress
          ? Promise.all(
              positionIds.map((pid) =>
                rpcRead({
                  contract: ctf,
                  method: 'balanceOf' as string,
                  params: [userAddress, pid],
                })
                  .then((b) => Number(b as bigint) / Number(UNIT))
                  .catch(() => NaN)
              )
            )
          : Promise.resolve(positionIds.map(() => NaN)),
        userAddress
          ? rpcRead({
              contract: weth,
              method: 'balanceOf' as string,
              params: [userAddress],
            })
              .then((b) => Number(b as bigint) / Number(UNIT))
              .catch(() => undefined)
          : Promise.resolve(undefined),
        userAddress
          ? eth_getBalance(getRpcClient({ client: readClient, chain: READ_CHAIN }), {
              address: userAddress,
            })
              .then((b) => Number(b) / Number(UNIT))
              .catch(() => undefined)
          : Promise.resolve(undefined),
        userAddress
          ? rpcRead({
              contract: ctf,
              method: 'isApprovedForAll' as string,
              params: [userAddress, lmsrAddress],
            })
              .then((a) => a as boolean)
              .catch(() => undefined)
          : Promise.resolve(undefined),
      ])

      setStage(stg)
      setWethBalance(wb)
      setNativeBalance(nb)
      setCtfApproved(approved)
      recordOddsSample(prices as number[])
      setOutcomes(
        positionIds.map((pid, i) => ({
          index: i,
          probability: prices[i],
          balance: balances[i],
          positionId: pid,
        }))
      )
    } catch (err: any) {
      console.error('[deprize-play] loadMarket failed', err)
      setLoadError(
        err?.shortMessage || err?.message || 'Failed to read the market.'
      )
    } finally {
      setLoading(false)
    }
  }, [lmsr, ctf, weth, userAddress, wethAddress, lmsrAddress, recordOddsSample])

  useEffect(() => {
    loadMarket()
  }, [loadMarket])

  // Live poll for the odds chart: a cheap read of just the marginal prices on a
  // timer (no spinner, no balance reads) so the chart keeps ticking while the
  // page is open. Pauses when the tab is hidden to avoid wasting RPC.
  useEffect(() => {
    if (!lmsr) return
    let stopped = false
    const tick = async () => {
      if (stopped || (typeof document !== 'undefined' && document.hidden)) return
      try {
        const prices = await Promise.all(
          Array.from({ length: MAX_OUTCOMES }, (_, i) =>
            rpcRead({
              contract: lmsr,
              method: 'calcMarginalPrice' as string,
              params: [i],
            })
              .then((p) => (Number(p as bigint) / 2 ** 64) * 100)
              .catch(() => NaN)
          )
        )
        recordOddsSample(prices)
      } catch {
        /* transient RPC error — next tick will retry */
      }
    }
    const id = setInterval(tick, ODDS_POLL_MS)
    return () => {
      stopped = true
      clearInterval(id)
    }
  }, [lmsr, recordOddsSample])

  // The just-mined block can lag the RPC briefly; refresh now and once more
  // shortly after so balances/odds reflect the tx without a manual refresh.
  const refreshSoon = useCallback(() => {
    loadMarket()
    setTimeout(() => loadMarket(), 2500)
  }, [loadMarket])

  // Cost basis (what the user has bet per outcome) — there's no on-chain record
  // of it, so we track it client-side to show profit. Per market + wallet.
  const costStorageKey = useMemo(
    () =>
      lmsrAddress && userAddress
        ? `deprize:costBasis:v1:${lmsrAddress}:${userAddress}`
        : null,
    [lmsrAddress, userAddress]
  )

  useEffect(() => {
    if (!costStorageKey || typeof window === 'undefined') {
      setCostBasis({})
      return
    }
    try {
      const raw = window.localStorage.getItem(costStorageKey)
      setCostBasis(raw ? (JSON.parse(raw) as Record<number, number>) : {})
    } catch {
      setCostBasis({})
    }
  }, [costStorageKey])

  const persistCostBasis = useCallback(
    (next: Record<number, number>) => {
      if (costStorageKey && typeof window !== 'undefined') {
        try {
          window.localStorage.setItem(costStorageKey, JSON.stringify(next))
        } catch {
          /* private mode / quota — profit just won't persist */
        }
      }
    },
    [costStorageKey]
  )

  const addCostBasis = useCallback(
    (index: number, deltaEth: number) => {
      setCostBasis((prev) => {
        const next = {
          ...prev,
          [index]: Math.max(0, (prev[index] ?? 0) + deltaEth),
        }
        persistCostBasis(next)
        return next
      })
    },
    [persistCostBasis]
  )

  const resetCostBasis = useCallback(
    (index: number) => {
      setCostBasis((prev) => {
        const next = { ...prev, [index]: 0 }
        persistCostBasis(next)
        return next
      })
    },
    [persistCostBasis]
  )

  const clearCostBasis = useCallback(() => {
    setCostBasis({})
    if (costStorageKey && typeof window !== 'undefined') {
      try {
        window.localStorage.removeItem(costStorageKey)
      } catch {
        /* ignore */
      }
    }
  }, [costStorageKey])

  // Sell-out quote: for each outcome the user holds, compute the ETH they'd
  // receive by selling their full position right now (calcNetCost with negative
  // amounts returns negative collateral, i.e. what the LMSR pays back).
  useEffect(() => {
    if (!lmsr) return
    const held = outcomes.filter(
      (o) => Number.isFinite(o.balance) && o.balance > 0
    )
    if (!held.length) {
      setSellQuotes(new Map())
      return
    }
    let cancelled = false
    ;(async () => {
      const entries = await Promise.all(
        held.map(async (o) => {
          try {
            const balWei = BigInt(Math.floor(o.balance * 1e18))
            const amounts = Array.from({ length: MAX_OUTCOMES }, (_, j) =>
              j === o.index ? -balWei : 0n
            )
            const net = await rpcRead<bigint>({
              contract: lmsr,
              method: 'calcNetCost' as string,
              params: [amounts],
            }) // negative — collateral returned
            return [o.index, Number(-net) / Number(UNIT)] as [number, number]
          } catch {
            return null
          }
        })
      )
      if (cancelled) return
      setSellQuotes(
        new Map(entries.filter((e): e is [number, number] => e !== null))
      )
    })()
    return () => {
      cancelled = true
    }
  }, [lmsr, outcomes])

  // Inverse of the LMSR cost curve: how many outcome tokens does `targetWei`
  // of collateral buy? calcNetCost is monotonic in quantity, so binary search.
  const lmsrNetCost = useCallback(
    async (index: number, qty: bigint) => {
      const amounts = Array.from({ length: MAX_OUTCOMES }, (_, j) =>
        j === index ? qty : 0n
      )
      return await rpcRead<bigint>({
        contract: lmsr!,
        method: 'calcNetCost' as string,
        params: [amounts],
      })
    },
    [lmsr]
  )

  // How many outcome tokens does `targetWei` of collateral actually buy, given
  // LMSR price impact? Net cost is monotonic in qty and always <= qty (marginal
  // price <= 1), so qty for a given cost is >= cost. We grow an upper bound from
  // targetWei (never from the 1/price estimate, which is wildly off in thin
  // markets and ruins the search precision), then binary search.
  const quoteQtyForCost = useCallback(
    async (index: number, targetWei: bigint) => {
      if (!lmsr || targetWei <= 0n) return 0n
      let lo = 0n
      let hi = targetWei
      for (let k = 0; k < 48; k++) {
        const c = await lmsrNetCost(index, hi)
        if (c >= targetWei) break
        lo = hi
        hi *= 2n
      }
      for (let k = 0; k < 24; k++) {
        const mid = (lo + hi) / 2n
        if (mid <= lo) break
        const c = await lmsrNetCost(index, mid)
        if (c <= targetWei) lo = mid
        else hi = mid
      }
      return lo
    },
    [lmsr, lmsrNetCost]
  )

  // Live payout for the open Bet modal: the REAL, price-impact-aware amount from
  // calcNetCost (each winning token redeems for 1 ETH, so payout == tokens). We
  // never show the naive 1/price estimate — in a thin market it's off by orders
  // of magnitude (it ignores that your own buy pushes the price up). Only ever
  // runs for the ONE selected outcome, so request volume stays small.
  const [betQuoting, setBetQuoting] = useState(false)
  useEffect(() => {
    if (betIndex === null || betAmountWei <= 0n) {
      setBetQuote(null)
      setBetQuoting(false)
      return
    }
    let cancelled = false
    setBetQuote(null)
    setBetQuoting(true)
    const t = setTimeout(async () => {
      try {
        const q = await quoteQtyForCost(betIndex, betAmountWei)
        if (!cancelled) {
          setBetQuote({ qty: Number(q) / Number(UNIT), exact: true })
        }
      } catch (err) {
        console.warn('[deprize-play] payout quote failed', err)
        if (!cancelled) setBetQuote(null)
      } finally {
        if (!cancelled) setBetQuoting(false)
      }
    }, 350)
    return () => {
      cancelled = true
      clearTimeout(t)
    }
  }, [betIndex, betAmountWei, quoteQtyForCost])

  // MetaMask occasionally hands back a stale nonce when a second tx is built
  // immediately after the first mined (NONCE_EXPIRED). Retry those a couple of
  // times after a short pause.
  const sendTx = useCallback(
    async (transaction: any) => {
      for (let attempt = 0; ; attempt++) {
        try {
          return await sendAndConfirmTransaction({
            account: account!,
            transaction,
          })
        } catch (e: any) {
          const msg = `${e?.message || ''} ${e?.shortMessage || ''}`.toLowerCase()
          const retryable =
            msg.includes('nonce') ||
            msg.includes('replacement transaction underpriced') ||
            msg.includes('retryable')
          if (retryable && attempt < 3) {
            await new Promise((r) => setTimeout(r, 2500))
            continue
          }
          throw e
        }
      }
    },
    [account]
  )

  const addWethToWallet = async () => {
    const eth = (window as any).ethereum
    if (!eth?.request) {
      toast.error('No injected wallet (MetaMask) detected.', { style: toastStyle })
      return
    }
    try {
      await eth.request({
        method: 'wallet_watchAsset',
        params: {
          type: 'ERC20',
          options: { address: wethAddress, symbol: 'WETH', decimals: 18 },
        },
      })
      toast.success('WETH added to your wallet.', { style: toastStyle })
    } catch (err: any) {
      console.error('[deprize-play] watchAsset failed', err)
      toast.error(err?.message || 'Could not add WETH.', { style: toastStyle })
    }
  }

  // Deposit (wrap ETH -> WETH) — the "add funds" action.
  const addFunds = async () => {
    if (!account || !weth) return
    if (depositAmountWei <= 0n) {
      toast.error('Enter an amount to add.', { style: toastStyle })
      return
    }
    setBusy(true)
    toast.loading('Adding funds…', { id: 'wrap', style: toastStyle })
    try {
      await sendTx(
        prepareContractCall({
          contract: wethW,
          method: 'deposit' as string,
          params: [],
          value: depositAmountWei,
        })
      )
      toast.dismiss('wrap')
      toast.success(
        `Added ${fmt(Number(depositAmountWei) / Number(UNIT))} ETH to your balance.`,
        { style: toastStyle }
      )
      setAddFundsOpen(false)
      refreshSoon()
    } catch (err: any) {
      toast.dismiss('wrap')
      console.error('[deprize-play] add funds failed', err)
      toast.error(err?.shortMessage || err?.message || 'Adding funds failed.', {
        style: toastStyle,
        duration: 8000,
      })
    } finally {
      setBusy(false)
    }
  }

  // ---- Trade ----
  const buy = async () => {
    if (betIndex === null) return
    const index = betIndex
    if (!account) {
      toast.error('Connect your wallet first.', { style: toastStyle })
      return
    }
    if (betAmountWei <= 0n) {
      toast.error('Enter an amount to bet.', { style: toastStyle })
      return
    }
    if (!lmsr || !weth) return
    setBusy(true)
    toast.loading('Quoting…', { id: 'quote', style: toastStyle })
    try {
      const qty = await quoteQtyForCost(index, betAmountWei)
      if (qty <= 0n) throw new Error('Bet too small for this market.')
      const amounts = Array.from({ length: MAX_OUTCOMES }, (_, i) =>
        i === index ? qty : 0n
      )
      const net = await rpcRead<bigint>({
        contract: lmsr,
        method: 'calcNetCost' as string,
        params: [amounts],
      })
      let fee = 0n
      try {
        fee = await rpcRead<bigint>({
          contract: lmsr,
          method: 'calcMarketFee' as string,
          params: [net],
        })
      } catch {}
      const cost = net + fee
      toast.dismiss('quote')

      // Bettors hold native ETH, not WETH. Cover the bet from any already-wrapped
      // WETH and auto-wrap just the shortfall (plus a little headroom for fee/
      // price drift) from native ETH as part of placing the bet.
      const buffered = (cost * 101n) / 100n
      let balWei = await rpcRead<bigint>({
        contract: weth,
        method: 'balanceOf' as string,
        params: [account.address],
      })
      if (balWei < buffered) {
        const toWrap = buffered - balWei
        const nativeWei = await eth_getBalance(
          getRpcClient({ client: readClient, chain: READ_CHAIN }),
          { address: account.address }
        )
        if (nativeWei < toWrap + GAS_RESERVE_WEI) {
          toast.error(
            'Not enough ETH for this bet (including gas). Try a smaller amount.',
            { style: toastStyle }
          )
          return
        }
        toast.loading('Wrapping ETH…', { id: 'wrap', style: toastStyle })
        await sendTx(
          prepareContractCall({
            contract: wethW,
            method: 'deposit' as string,
            params: [],
            value: toWrap,
          })
        )
        toast.dismiss('wrap')
        balWei += toWrap
      }
      // Cap the slippage limit at the available balance so it can't revert on
      // transfer if the bet is near the full balance.
      const limit = buffered > balWei ? balWei : buffered

      let allowance = 0n
      try {
        allowance = await rpcRead<bigint>({
          contract: weth,
          method: 'allowance' as string,
          params: [account.address, lmsrAddress],
        })
      } catch {}
      if (allowance < limit) {
        toast.loading('Approving…', { id: 'approve', style: toastStyle })
        await sendTx(
          prepareContractCall({
            contract: wethW,
            method: 'approve' as string,
            params: [lmsrAddress, MAX_UINT256],
          })
        )
        toast.dismiss('approve')
      }

      toast.loading('Placing bet…', { id: 'trade', style: toastStyle })
      await sendTx(
        prepareContractCall({
          contract: lmsrW,
          method: 'trade' as string,
          params: [amounts, limit],
        })
      )
      toast.dismiss('trade')
      const qtyNum = Number(qty) / Number(UNIT)
      addCostBasis(index, Number(cost) / Number(UNIT))
      toast.success(
        `Bet ${fmt(Number(cost) / Number(UNIT))} ETH on outcome #${
          index + 1
        }. To win ≈ ${fmt(qtyNum)} ETH if it happens.`,
        { style: toastStyle, duration: 8000 }
      )
      setBetIndex(null)
      refreshSoon()
    } catch (err: any) {
      toast.dismiss('quote')
      toast.dismiss('approve')
      toast.dismiss('trade')
      console.error('[deprize-play] buy failed', err)
      toast.error(err?.shortMessage || err?.message || 'Buy failed.', {
        style: toastStyle,
        duration: 8000,
      })
    } finally {
      setBusy(false)
    }
  }

  // Cash out the full position in an outcome.
  const sellAll = async (index: number) => {
    if (!account || !lmsr || !ctf) return
    const pid = outcomes[index]?.positionId
    if (!pid) return
    setBusy(true)
    try {
      const bal = await rpcRead<bigint>({
        contract: ctf,
        method: 'balanceOf' as string,
        params: [account.address, pid],
      })
      if (bal <= 0n) {
        toast.error('You have no position in this outcome.', { style: toastStyle })
        return
      }

      if (!ctfApproved) {
        toast.loading('Approving…', { id: 'approve', style: toastStyle })
        await sendTx(
          prepareContractCall({
            contract: ctfW,
            method: 'setApprovalForAll' as string,
            params: [lmsrAddress, true],
          })
        )
        toast.dismiss('approve')
      }

      const amounts = Array.from({ length: MAX_OUTCOMES }, (_, i) =>
        i === index ? -bal : 0n
      )
      const net = await rpcRead<bigint>({
        contract: lmsr,
        method: 'calcNetCost' as string,
        params: [amounts],
      }) // negative: collateral returned
      const limit = (net * 99n) / 100n // 1% slippage

      toast.loading('Cashing out…', { id: 'sell', style: toastStyle })
      await sendTx(
        prepareContractCall({
          contract: lmsrW,
          method: 'trade' as string,
          params: [amounts, limit],
        })
      )
      toast.dismiss('sell')
      resetCostBasis(index)
      toast.success(
        `Cashed out outcome #${index + 1} for ≈ ${fmt(
          Number(-net) / Number(UNIT)
        )} ETH.`,
        { style: toastStyle }
      )
      refreshSoon()
    } catch (err: any) {
      toast.dismiss('approve')
      toast.dismiss('sell')
      console.error('[deprize-play] sell failed', err)
      toast.error(err?.shortMessage || err?.message || 'Cash out failed.', {
        style: toastStyle,
        duration: 8000,
      })
    } finally {
      setBusy(false)
    }
  }

  const redeem = async () => {
    if (!account || !ctf || !conditionId) return
    setBusy(true)
    try {
      const indexSets = Array.from({ length: MAX_OUTCOMES }, (_, i) =>
        BigInt(1 << i)
      )
      await sendTx(
        prepareContractCall({
          contract: ctfW,
          method: 'redeemPositions' as string,
          params: [wethAddress, ZERO_BYTES32, conditionId, indexSets],
        })
      )
      clearCostBasis()
      toast.success('Winnings claimed.', { style: toastStyle })
      refreshSoon()
    } catch (err: any) {
      console.error('[deprize-play] redeem failed', err)
      toast.error(err?.shortMessage || err?.message || 'Claim failed.', {
        style: toastStyle,
        duration: 8000,
      })
    } finally {
      setBusy(false)
    }
  }

  const closeMarket = async () => {
    if (!account || !lmsr) return
    setBusy(true)
    try {
      await sendTx(
        prepareContractCall({
          contract: lmsrW,
          method: 'close' as string,
          params: [],
        })
      )
      toast.success('Market closed.', { style: toastStyle })
      refreshSoon()
    } catch (err: any) {
      toast.error(err?.shortMessage || err?.message || 'Close failed.', {
        style: toastStyle,
      })
    } finally {
      setBusy(false)
    }
  }

  const resolve = async (winningIndex: number) => {
    if (!account || !ctf) return
    setBusy(true)
    try {
      const payouts = Array.from({ length: MAX_OUTCOMES }, (_, i) =>
        i === winningIndex ? 1n : 0n
      )
      const questionId =
        '0x0000000000000000000000000000000000000000000000000000000000000001'
      await sendTx(
        prepareContractCall({
          contract: ctfW,
          method: 'reportPayouts' as string,
          params: [questionId, payouts],
        })
      )
      toast.success(`Reported outcome #${winningIndex + 1} as winner.`, {
        style: toastStyle,
      })
      refreshSoon()
    } catch (err: any) {
      toast.error(err?.shortMessage || err?.message || 'Resolve failed.', {
        style: toastStyle,
      })
    } finally {
      setBusy(false)
    }
  }

  const isClosed = stage === MarketStage.Closed
  // Spendable = already-wrapped WETH + native ETH (we auto-wrap at bet time),
  // holding a little native back for gas.
  const spendable =
    (wethBalance ?? 0) + Math.max(0, (nativeBalance ?? 0) - GAS_RESERVE_ETH)
  const balanceKnown = wethBalance !== undefined || nativeBalance !== undefined
  const insufficient =
    balanceKnown && betAmountNum > 0 && betAmountNum > spendable + 1e-12
  const betOutcome = betIndex !== null ? outcomes[betIndex] : undefined
  const betMult = betQuote && betAmountNum > 0 ? betQuote.qty / betAmountNum : undefined

  return (
    <div className="animate-fadeIn flex flex-col items-center">
      <Head
        title="DePrize Play (testnet)"
        description="Dev harness for the DePrize prediction market (CTF + LMSRWithTWAP)."
      />
      <Container>
        <ContentLayout
          header="DePrize Play"
          mainPadding
          mode="compact"
          popOverEffect={false}
          isProfile
          centerHeader
          centerHeaderWidth="760px"
          description="Bet ETH on an outcome, watch live odds and payouts, and claim after the market resolves."
          preFooter={<NoticeFooter />}
        >
          <div className="flex flex-col gap-6 w-full max-w-[760px] mx-auto">
            {!configured ? (
              <div className="p-5 rounded-2xl bg-red-500/10 border border-red-500/30 text-red-200 text-sm">
                No market is configured for the current chain (
                <span className="font-mono">{chainSlug}</span>). This harness
                targets the testnet deployments (sepolia / arbitrum-sepolia). Set{' '}
                <span className="font-mono">NEXT_PUBLIC_TEST_CHAIN</span> and
                reload.
              </div>
            ) : (
              <>
                {/* Status */}
                <div className="p-4 sm:p-5 rounded-2xl bg-gradient-to-br from-gray-900 via-blue-900/30 to-purple-900/20 border border-white/10">
                  <div className="flex items-center justify-between gap-3 flex-wrap">
                    <div>
                      <p className="text-gray-400 text-xs">Network</p>
                      <p className="text-white font-mono text-sm">{chainSlug}</p>
                    </div>
                    <div>
                      <p className="text-gray-400 text-xs">Stage</p>
                      <p className="text-white text-sm">
                        {stage !== undefined ? MarketStage[stage] : '—'}
                      </p>
                    </div>
                    <div>
                      <p className="text-gray-400 text-xs">Market fee</p>
                      <p className="text-white text-sm">
                        {feePct !== undefined ? `${fmt(feePct, 2)}%` : '—'}
                      </p>
                    </div>
                    <StandardButton
                      onClick={loadMarket}
                      disabled={loading || busy}
                      className="rounded-full"
                      backgroundColor="bg-white/10"
                    >
                      {loading ? 'Refreshing…' : 'Refresh'}
                    </StandardButton>
                  </div>
                  <p className="mt-3 text-gray-500 text-[11px] font-mono break-all">
                    LMSR {lmsrAddress}
                  </p>
                </div>

                {/* Connect gate */}
                {!userAddress ? (
                  <div className="p-4 sm:p-5 rounded-2xl bg-indigo-500/10 border border-indigo-500/30 flex items-center justify-between gap-3 flex-wrap">
                    <div>
                      <p className="text-indigo-100 text-sm font-medium">
                        Connect a wallet on Sepolia to bet
                      </p>
                      <p className="text-indigo-300/80 text-xs mt-1">
                        You can read live odds without connecting, but betting
                        needs a connected Sepolia wallet with a little test ETH.
                      </p>
                    </div>
                    <button
                      onClick={() => login()}
                      className="px-5 py-2.5 rounded-full bg-gradient-to-r from-blue-500 to-purple-600 hover:from-blue-600 hover:to-purple-700 text-white text-sm font-semibold transition-all"
                    >
                      Connect Wallet
                    </button>
                  </div>
                ) : (
                  /* Balance + add funds */
                  <div className="p-4 sm:p-5 rounded-2xl bg-gradient-to-br from-gray-900 to-blue-900/20 border border-white/10 flex items-center justify-between gap-3 flex-wrap">
                    <div>
                      <p className="text-gray-400 text-xs">Your balance</p>
                      <p className="text-white text-2xl font-bold leading-tight">
                        {balanceKnown ? fmt(spendable) : '—'}{' '}
                        <span className="text-base font-medium text-gray-400">
                          ETH
                        </span>
                      </p>
                      <p className="text-gray-500 text-[11px] mt-0.5">
                        Bet with ETH directly — we wrap it automatically.
                        {wethBalance !== undefined && wethBalance > 0
                          ? ` (${fmt(wethBalance)} already wrapped)`
                          : ''}
                      </p>
                      <button
                        onClick={addWethToWallet}
                        className="text-gray-500 hover:text-gray-300 text-[11px] underline mt-0.5"
                      >
                        Track WETH in MetaMask
                      </button>
                    </div>
                    <StandardButton
                      onClick={() => setAddFundsOpen(true)}
                      disabled={busy}
                      className="rounded-full"
                      backgroundColor="bg-moon-green"
                    >
                      Add funds
                    </StandardButton>
                  </div>
                )}

                {/* Load error (non-fatal) */}
                {loadError && (
                  <div className="p-3 rounded-xl bg-red-500/10 border border-red-500/30 text-red-200 text-xs break-words">
                    Couldn't fully load market data: {loadError}. You can still
                    try to trade, or hit Refresh.
                  </div>
                )}

                {/* Live odds over time */}
                <div className="p-4 sm:p-5 rounded-2xl bg-gradient-to-br from-gray-900 to-blue-900/20 border border-white/10">
                  <div className="flex items-center justify-between gap-3 flex-wrap mb-3">
                    <div>
                      <p className="text-white font-semibold">Live odds</p>
                      <p className="text-gray-500 text-xs">
                        Implied chance over time
                      </p>
                    </div>
                    <div className="flex items-center gap-3 flex-wrap">
                      {outcomes.map((o) => (
                        <div key={o.index} className="flex items-center gap-1.5">
                          <span
                            className="inline-block w-2.5 h-2.5 rounded-full"
                            style={{
                              background:
                                OUTCOME_COLORS[o.index % OUTCOME_COLORS.length],
                            }}
                          />
                          <span className="text-gray-300 text-xs">
                            #{o.index + 1}
                            {Number.isNaN(o.probability)
                              ? ''
                              : ` · ${fmt(o.probability, 0)}%`}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                  <OddsHistoryChart
                    history={oddsHistory}
                    labels={outcomes.map((o) => `Outcome #${o.index + 1}`)}
                    colors={OUTCOME_COLORS}
                  />
                </div>

                {/* Outcomes */}
                <div className="flex flex-col gap-3">
                  {outcomes.map((o) => {
                    const holding = Number.isFinite(o.balance) && o.balance > 0
                    const color = OUTCOME_COLORS[o.index % OUTCOME_COLORS.length]
                    const valueNow = sellQuotes.get(o.index)
                    const invested = costBasis[o.index] ?? 0
                    const pnl =
                      valueNow !== undefined && invested > 0
                        ? valueNow - invested
                        : undefined
                    return (
                      <div
                        key={o.index}
                        className="p-4 rounded-2xl bg-gradient-to-br from-gray-900 to-blue-900/20 border border-white/10"
                      >
                        {/* Top row: chance · name · actions */}
                        <div className="flex items-center gap-4 flex-wrap">
                          <div className="flex items-center gap-3 min-w-[110px]">
                            <span
                              className="inline-block w-2.5 h-8 rounded-full shrink-0"
                              style={{ background: color }}
                            />
                            <div>
                              <p className="text-2xl font-bold text-white leading-none">
                                {Number.isNaN(o.probability)
                                  ? loading
                                    ? '…'
                                    : '—'
                                  : `${fmt(o.probability, 0)}%`}
                              </p>
                              <p className="text-gray-500 text-[10px] mt-1">
                                chance
                              </p>
                            </div>
                          </div>

                          <div className="flex-1 min-w-[130px]">
                            <p className="text-white font-semibold">
                              Outcome #{o.index + 1}
                            </p>
                            <p className="text-gray-400 text-xs mt-0.5">
                              {holding
                                ? 'You have a position'
                                : 'Tap Bet to see your payout'}
                            </p>
                          </div>

                          <div className="flex items-center gap-2 flex-wrap">
                            <StandardButton
                              onClick={() => {
                                setBetAmount('')
                                setBetQuote(null)
                                setBetIndex(o.index)
                              }}
                              disabled={busy || isClosed || !userAddress}
                              className="rounded-full"
                              backgroundColor="bg-moon-green"
                            >
                              Bet
                            </StandardButton>
                            {holding && (
                              <StandardButton
                                onClick={() => sellAll(o.index)}
                                disabled={busy || isClosed || !userAddress}
                                className="rounded-full"
                                backgroundColor="bg-moon-orange"
                              >
                                {valueNow !== undefined
                                  ? `Cash out ≈ ${fmt(valueNow)} ETH`
                                  : 'Cash out'}
                              </StandardButton>
                            )}
                          </div>
                        </div>

                        {/* Position summary */}
                        {holding && (
                          <div className="mt-3 grid grid-cols-3 gap-2">
                            <div className="rounded-xl bg-black/30 border border-white/10 px-3 py-2">
                              <p className="text-[10px] text-gray-500">
                                Cash out now
                              </p>
                              <p className="text-sm font-semibold text-white">
                                {valueNow !== undefined
                                  ? `${fmt(valueNow)} ETH`
                                  : '…'}
                              </p>
                            </div>
                            <div className="rounded-xl bg-black/30 border border-white/10 px-3 py-2">
                              <p className="text-[10px] text-gray-500">
                                If this wins
                              </p>
                              <p className="text-sm font-semibold text-moon-green">
                                {fmt(o.balance)} ETH
                              </p>
                            </div>
                            <div className="rounded-xl bg-black/30 border border-white/10 px-3 py-2">
                              <p className="text-[10px] text-gray-500">
                                Profit so far
                              </p>
                              <p
                                className={`text-sm font-semibold ${
                                  pnl === undefined
                                    ? 'text-gray-400'
                                    : pnl >= 0
                                    ? 'text-moon-green'
                                    : 'text-red-400'
                                }`}
                              >
                                {pnl === undefined
                                  ? '—'
                                  : `${pnl >= 0 ? '+' : ''}${fmt(pnl)} ETH`}
                              </p>
                            </div>
                          </div>
                        )}
                      </div>
                    )
                  })}
                </div>

                {/* Redeem */}
                {isClosed && (
                  <div className="p-4 rounded-2xl bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-between gap-3 flex-wrap">
                    <p className="text-emerald-200 text-sm">
                      This market is resolved. Claim your winnings.
                    </p>
                    <StandardButton
                      onClick={redeem}
                      disabled={busy}
                      className="rounded-full"
                      backgroundColor="bg-moon-green"
                    >
                      Claim winnings
                    </StandardButton>
                  </div>
                )}

                {/* Privileged actions */}
                {(isOperator || isOracle) && (
                  <div className="p-4 rounded-2xl bg-yellow-500/5 border border-yellow-500/20">
                    <p className="text-yellow-300 text-xs mb-3 font-medium">
                      Privileged test actions ({isOracle ? 'oracle' : ''}
                      {isOracle && isOperator ? ' + ' : ''}
                      {isOperator ? 'operator' : ''})
                    </p>
                    <div className="flex items-center gap-2 flex-wrap">
                      {isOperator && (
                        <StandardButton
                          onClick={closeMarket}
                          disabled={busy || isClosed}
                          className="rounded-full"
                          backgroundColor="bg-white/10"
                        >
                          Close market
                        </StandardButton>
                      )}
                      {isOracle &&
                        outcomes.map((o) => (
                          <StandardButton
                            key={o.index}
                            onClick={() => resolve(o.index)}
                            disabled={busy}
                            className="rounded-full"
                            backgroundColor="bg-white/10"
                          >
                            Resolve #{o.index + 1} wins
                          </StandardButton>
                        ))}
                    </div>
                  </div>
                )}
              </>
            )}
          </div>
        </ContentLayout>
      </Container>

      {/* Add funds modal */}
      {addFundsOpen && (
        <Modal id="deprize-add-funds" setEnabled={setAddFundsOpen} title="Add funds">
          <div className="flex flex-col gap-4 w-full sm:w-[420px]">
            <p className="text-gray-300 text-sm">
              Add ETH to your betting balance. Your ETH is held on the market and
              you can cash out anytime.
            </p>
            <div className="flex items-center justify-between text-sm">
              <span className="text-gray-400">Current balance</span>
              <span className="text-white">
                {wethBalance !== undefined ? `${fmt(wethBalance)} ETH` : '—'}
              </span>
            </div>
            <div>
              <label className="text-xs text-gray-400">Amount (ETH)</label>
              <input
                type="number"
                min="0"
                step="any"
                value={depositAmount}
                onChange={(e) => setDepositAmount(e.target.value)}
                placeholder="0.01"
                className="mt-1 w-full px-4 py-3 bg-white/5 border border-white/20 rounded-xl text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
              <div className="flex gap-2 mt-2">
                {['0.01', '0.05', '0.1'].map((a) => (
                  <button
                    key={a}
                    onClick={() => setDepositAmount(a)}
                    className="px-3 py-1 rounded-full bg-white/5 hover:bg-white/10 text-gray-300 text-xs"
                  >
                    {a} ETH
                  </button>
                ))}
              </div>
            </div>
            <StandardButton
              onClick={addFunds}
              disabled={busy || !depositAmount}
              className="rounded-full w-full"
              backgroundColor="bg-moon-green"
            >
              {busy ? 'Adding…' : 'Add funds'}
            </StandardButton>
            <p className="text-gray-500 text-[11px]">
              On Sepolia? Grab free test ETH from a faucet (e.g.
              sepoliafaucet.com), then add it here.
            </p>
          </div>
        </Modal>
      )}

      {/* Bet modal */}
      {betIndex !== null && (
        <Modal
          id="deprize-bet"
          setEnabled={(v) => !v && setBetIndex(null)}
          title={`Bet on Outcome #${betIndex + 1}`}
        >
          <div className="flex flex-col gap-4 w-full sm:w-[420px]">
            <div className="flex items-center justify-between text-sm">
              <span className="text-gray-400">Chance to win</span>
              <span className="text-white font-semibold">
                {betOutcome && Number.isFinite(betOutcome.probability)
                  ? `${fmt(betOutcome.probability, 0)}%`
                  : '—'}
              </span>
            </div>
            <div>
              <label className="text-xs text-gray-400">
                How much do you want to bet? (ETH)
              </label>
              <input
                type="number"
                min="0"
                step="any"
                autoFocus
                value={betAmount}
                onChange={(e) => setBetAmount(e.target.value)}
                placeholder="e.g. 0.01"
                className="mt-1 w-full px-4 py-3 bg-white/5 border border-white/20 rounded-xl text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
              <div className="flex gap-2 mt-2 flex-wrap">
                {['0.01', '0.05', '0.1'].map((a) => (
                  <button
                    key={a}
                    onClick={() => setBetAmount(a)}
                    className="px-3 py-1 rounded-full bg-white/5 hover:bg-white/10 text-gray-300 text-xs"
                  >
                    {a} ETH
                  </button>
                ))}
                {spendable > 0 && (
                  <button
                    onClick={() =>
                      setBetAmount(String(Math.floor(spendable * 1e6) / 1e6))
                    }
                    className="px-3 py-1 rounded-full bg-white/5 hover:bg-white/10 text-gray-300 text-xs"
                  >
                    Max ({fmt(spendable)})
                  </button>
                )}
              </div>
            </div>

            {/* Payout */}
            {betAmountNum > 0 && (
              <div className="p-4 rounded-xl bg-black/30 border border-white/10">
                {betQuote ? (
                  <>
                    <div className="flex items-center justify-between">
                      <span className="text-gray-400 text-sm">
                        To win if it happens
                      </span>
                      <span className="text-moon-green text-lg font-bold">
                        ≈ {fmt(betQuote.qty)} ETH
                      </span>
                    </div>
                    <div className="flex items-center justify-between mt-1">
                      <span className="text-gray-500 text-xs">Payout multiple</span>
                      <span className="text-gray-300 text-xs">
                        {betMult ? `${fmt(betMult, 2)}x` : '—'}
                      </span>
                    </div>
                  </>
                ) : (
                  <p className="text-gray-400 text-sm">
                    {betQuoting ? 'Calculating payout…' : 'Enter an amount'}
                  </p>
                )}
              </div>
            )}

            {/* Insufficient funds */}
            {insufficient ? (
              <div className="flex flex-col gap-2">
                <p className="text-amber-300 text-sm">
                  You only have ≈ {fmt(spendable)} ETH available to bet (a little
                  is kept back for gas). Add more ETH or lower your bet.
                </p>
                <StandardButton
                  onClick={() => {
                    setBetIndex(null)
                    setAddFundsOpen(true)
                  }}
                  className="rounded-full w-full"
                  backgroundColor="bg-moon-green"
                >
                  Add funds
                </StandardButton>
              </div>
            ) : (
              <StandardButton
                onClick={buy}
                disabled={busy || betAmountWei <= 0n || isClosed}
                className="rounded-full w-full"
                backgroundColor="bg-moon-green"
              >
                {busy
                  ? 'Placing bet…'
                  : betAmountNum > 0
                  ? `Bet ${fmt(betAmountNum)} ETH`
                  : 'Enter an amount'}
              </StandardButton>
            )}
          </div>
        </Modal>
      )}
    </div>
  )
}
