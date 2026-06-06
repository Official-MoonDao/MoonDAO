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
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import toast from 'react-hot-toast'
import {
  createThirdwebClient,
  prepareContractCall,
  readContract,
  sendAndConfirmTransaction,
} from 'thirdweb'
import { useActiveAccount } from 'thirdweb/react'
import toastStyle from '@/lib/marketplace/marketplace-utils/toastConfig'
import { getChainSlug } from '@/lib/thirdweb/chain'
import useContract from '@/lib/thirdweb/hooks/useContract'
import Container from '@/components/layout/Container'
import ContentLayout from '@/components/layout/ContentLayout'
import Head from '@/components/layout/Head'
import { NoticeFooter } from '@/components/layout/NoticeFooter'
import StandardButton from '@/components/layout/StandardButton'

const ZERO_BYTES32 =
  '0x0000000000000000000000000000000000000000000000000000000000000000'
const UNIT = 10n ** BigInt(COLLATERAL_DECIMALS)
const MAX_UINT256 = (1n << 256n) - 1n

// Dedicated read client with RPC batching DISABLED (maxBatchSize: 1). This page
// fires many concurrent calcNetCost reads (live odds + per-outcome payout binary
// searches + the buy quote). When those get batched into one JSON-RPC request,
// this thirdweb/viem version returns `undefined` for some responses and crashes
// decoding them ("Cannot read properties of undefined (reading 'buffer')").
// Sending each call on its own avoids the bug and is also lower-latency (no
// batch-window wait). Writes still use the app's shared client so transactions
// stay consistent with the connected account.
const readClient = createThirdwebClient({
  clientId: process.env.NEXT_PUBLIC_THIRDWEB_CLIENT_ID as string,
  config: { rpc: { maxBatchSize: 1, fetch: { requestTimeoutMs: 15000 } } },
})

// LMSRWithTWAP.stage()
enum MarketStage {
  Running = 0,
  Paused = 1,
  Closed = 2,
}

type Outcome = {
  index: number
  probability: number // %
  balance: number // outcome tokens
  positionId: bigint
}

type Preview = { qty: number; exact: boolean }

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

  const [ethBet, setEthBet] = useState('')
  const [wrapAmount, setWrapAmount] = useState('0.01')
  const [outcomes, setOutcomes] = useState<Outcome[]>(emptyOutcomes)
  const [previews, setPreviews] = useState<(Preview | undefined)[]>([])
  const [conditionId, setConditionId] = useState<string | undefined>()
  const [stage, setStage] = useState<number | undefined>()
  const [feePct, setFeePct] = useState<number | undefined>()
  const [wethBalance, setWethBalance] = useState<number | undefined>()
  const [wethAllowance, setWethAllowance] = useState<bigint | undefined>()
  const [ctfApproved, setCtfApproved] = useState<boolean | undefined>()
  const [loadError, setLoadError] = useState<string | undefined>()
  const [loading, setLoading] = useState(false)
  const [busy, setBusy] = useState(false)

  // Static-per-market values (conditionId + ERC-1155 position ids) never change,
  // so resolve them once and reuse — keeps every refresh to the dynamic reads.
  const staticRef = useRef<{ conditionId: string; positionIds: bigint[] } | null>(
    null
  )

  // Read contracts: no-batching client (avoids the viem batch-decode bug).
  const lmsr = useContract({
    address: lmsrAddress,
    chain,
    abi: LMSRWithTWAP.abi as any,
    forwardClient: readClient,
  })
  const ctf = useContract({
    address: ctfAddress,
    chain,
    abi: ConditionalTokensABI as any,
    forwardClient: readClient,
  })
  const weth = useContract({
    address: wethAddress,
    chain,
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

  const ethBetWei = useMemo(() => toWei(ethBet), [ethBet])
  const wrapAmountWei = useMemo(() => toWei(wrapAmount), [wrapAmount])

  const loadMarket = useCallback(async () => {
    if (!lmsr || !ctf || !weth) return
    setLoading(true)
    setLoadError(undefined)
    try {
      // 1) Static data (only the first time).
      if (!staticRef.current) {
        const cond = (await readContract({
          contract: lmsr,
          method: 'conditionIds' as string,
          params: [0n],
        })) as string
        const positionIds = await Promise.all(
          Array.from({ length: MAX_OUTCOMES }, async (_, i) => {
            const indexSet = BigInt(1 << i)
            const collectionId = (await readContract({
              contract: ctf,
              method: 'getCollectionId' as string,
              params: [ZERO_BYTES32, cond, indexSet],
            })) as string
            return (await readContract({
              contract: ctf,
              method: 'getPositionId' as string,
              params: [wethAddress, collectionId],
            })) as bigint
          })
        )
        staticRef.current = { conditionId: cond, positionIds }
        setConditionId(cond)
      }
      const { conditionId: cond, positionIds } = staticRef.current

      // 2) Dynamic data, all in parallel.
      const [stg, fee, prices, balances, wb, allow, approved] =
        await Promise.all([
          readContract({ contract: lmsr, method: 'stage' as string, params: [] })
            .then((v) => Number(v))
            .catch(() => undefined),
          readContract({ contract: lmsr, method: 'fee' as string, params: [] })
            .then((v) => (Number(v) / 1e18) * 100)
            .catch(() => undefined),
          Promise.all(
            Array.from({ length: MAX_OUTCOMES }, (_, i) =>
              readContract({
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
                  readContract({
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
            ? readContract({
                contract: weth,
                method: 'balanceOf' as string,
                params: [userAddress],
              })
                .then((b) => Number(b as bigint) / Number(UNIT))
                .catch(() => undefined)
            : Promise.resolve(undefined),
          userAddress
            ? readContract({
                contract: weth,
                method: 'allowance' as string,
                params: [userAddress, lmsrAddress],
              })
                .then((a) => a as bigint)
                .catch(() => undefined)
            : Promise.resolve(undefined),
          userAddress
            ? readContract({
                contract: ctf,
                method: 'isApprovedForAll' as string,
                params: [userAddress, lmsrAddress],
              })
                .then((a) => a as boolean)
                .catch(() => undefined)
            : Promise.resolve(undefined),
        ])

      setStage(stg)
      setFeePct(fee)
      setWethBalance(wb)
      setWethAllowance(allow)
      setCtfApproved(approved)
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
  }, [lmsr, ctf, weth, userAddress, wethAddress, lmsrAddress])

  useEffect(() => {
    loadMarket()
  }, [loadMarket])

  // The just-mined block can lag the RPC briefly; refresh now and once more
  // shortly after so balances/odds reflect the tx without a manual refresh.
  const refreshSoon = useCallback(() => {
    loadMarket()
    setTimeout(() => loadMarket(), 2500)
  }, [loadMarket])

  // Inverse of the LMSR cost curve: how many outcome tokens does `targetWei`
  // of collateral buy? calcNetCost is monotonic in quantity, so binary search.
  const lmsrNetCost = useCallback(
    async (index: number, qty: bigint) => {
      const amounts = Array.from({ length: MAX_OUTCOMES }, (_, j) =>
        j === index ? qty : 0n
      )
      return (await readContract({
        contract: lmsr!,
        method: 'calcNetCost' as string,
        params: [amounts],
      })) as bigint
    },
    [lmsr]
  )

  const quoteQtyForCost = useCallback(
    async (index: number, targetWei: bigint, hintWei?: bigint) => {
      if (!lmsr || targetWei <= 0n) return 0n
      // Seed the upper bound from a marginal-price hint when available so the
      // grow loop almost never runs; cap iterations to keep this snappy.
      let hi = hintWei && hintWei > 0n ? hintWei * 2n : targetWei
      for (let k = 0; k < 48; k++) {
        const c = await lmsrNetCost(index, hi)
        if (c >= targetWei) break
        hi *= 2n
      }
      let lo = 0n
      for (let k = 0; k < 18; k++) {
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

  // Instant estimate from the marginal price (ignores price impact), so the
  // payout figures appear immediately as you type.
  useEffect(() => {
    if (ethBetWei <= 0n) {
      setPreviews([])
      return
    }
    const ethNum = Number(ethBetWei) / Number(UNIT)
    setPreviews(
      outcomes.map((o) =>
        Number.isFinite(o.probability) && o.probability > 0
          ? { qty: (ethNum * 100) / o.probability, exact: false }
          : undefined
      )
    )
  }, [ethBetWei, outcomes])

  // Then refine to the exact (price-impact-aware) quantity in the background.
  // Refine each outcome independently and MERGE into the estimate — a slow or
  // failed exact quote must never blank a row (that's what showed "Calculating…"
  // forever).
  useEffect(() => {
    if (!lmsr || ethBetWei <= 0n) return
    let cancelled = false
    const ethNum = Number(ethBetWei) / Number(UNIT)
    const t = setTimeout(() => {
      outcomes.forEach((o, i) => {
        if (!Number.isFinite(o.probability) || o.probability <= 0) return
        const hint = toWei(String((ethNum * 100) / o.probability))
        quoteQtyForCost(i, ethBetWei, hint)
          .then((q) => {
            if (cancelled || q <= 0n) return
            const qty = Number(q) / Number(UNIT)
            setPreviews((prev) => {
              const next = [...prev]
              next[i] = { qty, exact: true }
              return next
            })
          })
          .catch((err) => {
            console.warn('[deprize-play] exact quote failed', i, err)
          })
      })
    }, 600)
    return () => {
      cancelled = true
      clearTimeout(t)
    }
  }, [lmsr, ethBetWei, outcomes, quoteQtyForCost])

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

  const copy = async (label: string, value: string) => {
    try {
      await navigator.clipboard.writeText(value)
      toast.success(`Copied ${label}.`, { style: toastStyle })
    } catch {
      toast.error('Copy failed.', { style: toastStyle })
    }
  }

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

  // ---- One-time setup (one tx per click; avoids the nonce race) ----
  const wrapWeth = async () => {
    if (!account || !weth) return
    if (wrapAmountWei <= 0n) {
      toast.error('Enter an ETH amount to wrap.', { style: toastStyle })
      return
    }
    setBusy(true)
    toast.loading('Wrapping ETH → WETH…', { id: 'wrap', style: toastStyle })
    try {
      await sendTx(
        prepareContractCall({
          contract: wethW,
          method: 'deposit' as string,
          params: [],
          value: wrapAmountWei,
        })
      )
      toast.dismiss('wrap')
      toast.success(`Wrapped ${fmt(Number(wrapAmountWei) / Number(UNIT))} ETH.`, {
        style: toastStyle,
      })
      refreshSoon()
    } catch (err: any) {
      toast.dismiss('wrap')
      console.error('[deprize-play] wrap failed', err)
      toast.error(err?.shortMessage || err?.message || 'Wrap failed.', {
        style: toastStyle,
        duration: 8000,
      })
    } finally {
      setBusy(false)
    }
  }

  const approveWeth = async () => {
    if (!account || !weth) return
    setBusy(true)
    toast.loading('Approving WETH…', { id: 'approve', style: toastStyle })
    try {
      await sendTx(
        prepareContractCall({
          contract: wethW,
          method: 'approve' as string,
          params: [lmsrAddress, MAX_UINT256],
        })
      )
      toast.dismiss('approve')
      toast.success('WETH approved for the market.', { style: toastStyle })
      refreshSoon()
    } catch (err: any) {
      toast.dismiss('approve')
      console.error('[deprize-play] approve WETH failed', err)
      toast.error(err?.shortMessage || err?.message || 'Approve failed.', {
        style: toastStyle,
        duration: 8000,
      })
    } finally {
      setBusy(false)
    }
  }

  const approveOutcomeTokens = async () => {
    if (!account || !ctf) return
    setBusy(true)
    toast.loading('Approving outcome tokens…', {
      id: 'ctfapprove',
      style: toastStyle,
    })
    try {
      await sendTx(
        prepareContractCall({
          contract: ctfW,
          method: 'setApprovalForAll' as string,
          params: [lmsrAddress, true],
        })
      )
      toast.dismiss('ctfapprove')
      toast.success('Outcome tokens approved (needed to sell).', {
        style: toastStyle,
      })
      refreshSoon()
    } catch (err: any) {
      toast.dismiss('ctfapprove')
      console.error('[deprize-play] approve CTF failed', err)
      toast.error(err?.shortMessage || err?.message || 'Approve failed.', {
        style: toastStyle,
        duration: 8000,
      })
    } finally {
      setBusy(false)
    }
  }

  // ---- Trade ----
  const buy = async (index: number) => {
    if (!account) {
      toast.error('Connect your wallet first.', { style: toastStyle })
      return
    }
    if (ethBetWei <= 0n) {
      toast.error('Enter an ETH amount to bet.', { style: toastStyle })
      return
    }
    if (!lmsr || !weth) return
    setBusy(true)
    toast.loading('Quoting…', { id: 'quote', style: toastStyle })
    try {
      const qty = await quoteQtyForCost(index, ethBetWei)
      if (qty <= 0n) throw new Error('Bet too small for this market.')
      const amounts = Array.from({ length: MAX_OUTCOMES }, (_, i) =>
        i === index ? qty : 0n
      )
      const net = (await readContract({
        contract: lmsr,
        method: 'calcNetCost' as string,
        params: [amounts],
      })) as bigint
      let fee = 0n
      try {
        fee = (await readContract({
          contract: lmsr,
          method: 'calcMarketFee' as string,
          params: [net],
        })) as bigint
      } catch {}
      const cost = net + fee
      const limit = (cost * 101n) / 100n // 1% slippage buffer
      toast.dismiss('quote')

      const wethBal = (await readContract({
        contract: weth,
        method: 'balanceOf' as string,
        params: [account.address],
      })) as bigint
      if (wethBal < limit) {
        toast.loading('Wrapping ETH → WETH…', { id: 'wrap', style: toastStyle })
        await sendTx(
          prepareContractCall({
            contract: wethW,
            method: 'deposit' as string,
            params: [],
            value: limit - wethBal,
          })
        )
        toast.dismiss('wrap')
      }

      let allowance = 0n
      try {
        allowance = (await readContract({
          contract: weth,
          method: 'allowance' as string,
          params: [account.address, lmsrAddress],
        })) as bigint
      } catch {}
      if (allowance < limit) {
        toast.loading('Approving WETH…', { id: 'approve', style: toastStyle })
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
      toast.success(
        `Bet ${fmt(Number(cost) / Number(UNIT))} WETH on #${index + 1} → ${fmt(
          qtyNum
        )} tokens. Payout if it wins ≈ ${fmt(qtyNum)} WETH.`,
        { style: toastStyle, duration: 8000 }
      )
      refreshSoon()
    } catch (err: any) {
      toast.dismiss('quote')
      toast.dismiss('wrap')
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
      const bal = (await readContract({
        contract: ctf,
        method: 'balanceOf' as string,
        params: [account.address, pid],
      })) as bigint
      if (bal <= 0n) {
        toast.error('You have no tokens for this outcome.', { style: toastStyle })
        return
      }

      if (!ctfApproved) {
        toast.loading('Approving outcome tokens…', {
          id: 'approve',
          style: toastStyle,
        })
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
      const net = (await readContract({
        contract: lmsr,
        method: 'calcNetCost' as string,
        params: [amounts],
      })) as bigint // negative: collateral returned
      const limit = (net * 99n) / 100n // 1% slippage

      toast.loading('Selling…', { id: 'sell', style: toastStyle })
      await sendTx(
        prepareContractCall({
          contract: lmsrW,
          method: 'trade' as string,
          params: [amounts, limit],
        })
      )
      toast.dismiss('sell')
      toast.success(
        `Sold ${fmt(Number(bal) / Number(UNIT))} of #${index + 1} for ~${fmt(
          Number(-net) / Number(UNIT)
        )} WETH.`,
        { style: toastStyle }
      )
      refreshSoon()
    } catch (err: any) {
      toast.dismiss('approve')
      toast.dismiss('sell')
      console.error('[deprize-play] sell failed', err)
      toast.error(err?.shortMessage || err?.message || 'Sell failed.', {
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
      toast.success('Redeemed winning positions.', { style: toastStyle })
      refreshSoon()
    } catch (err: any) {
      console.error('[deprize-play] redeem failed', err)
      toast.error(err?.shortMessage || err?.message || 'Redeem failed.', {
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
  const ethBetNum = Number(ethBetWei) / Number(UNIT)

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
          description="Throwaway testnet harness that talks directly to the deployed CTF + LMSRWithTWAP market that DePrizeMint wraps. Bet ETH on an outcome, watch live odds and payouts, and redeem after resolution."
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
                    <div>
                      <p className="text-gray-400 text-xs">Your WETH</p>
                      <p className="text-white text-sm">
                        {wethBalance !== undefined ? fmt(wethBalance) : '—'}
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      <StandardButton
                        onClick={addWethToWallet}
                        className="rounded-full"
                        backgroundColor="bg-white/10"
                      >
                        Add WETH
                      </StandardButton>
                      <StandardButton
                        onClick={loadMarket}
                        disabled={loading || busy}
                        className="rounded-full"
                        backgroundColor="bg-white/10"
                      >
                        {loading ? 'Refreshing…' : 'Refresh'}
                      </StandardButton>
                    </div>
                  </div>
                  <p className="mt-3 text-gray-500 text-[11px] font-mono break-all">
                    LMSR {lmsrAddress}
                  </p>
                </div>

                {/* Connect gate */}
                {!userAddress && (
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
                )}

                {/* One-time setup */}
                {userAddress && (
                  <div className="p-4 sm:p-5 rounded-2xl bg-black/20 border border-white/10">
                    <p className="text-sm font-medium text-white">
                      One-time setup
                    </p>
                    <p className="text-gray-400 text-xs mb-3">
                      Do these once. Each is a single transaction, so MetaMask
                      won't trip on a stale nonce. After this, a bet is a single
                      transaction.
                    </p>
                    <div className="flex items-end gap-2 flex-wrap mb-3">
                      <div className="flex-1 min-w-[160px]">
                        <label className="text-xs text-gray-300">
                          1. Wrap ETH → WETH (collateral)
                        </label>
                        <input
                          type="number"
                          min="0"
                          step="any"
                          value={wrapAmount}
                          onChange={(e) => setWrapAmount(e.target.value)}
                          placeholder="0.01"
                          className="mt-1 w-full px-3 py-2 bg-white/5 border border-white/20 rounded-xl text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500"
                        />
                      </div>
                      <StandardButton
                        onClick={wrapWeth}
                        disabled={busy || !wrapAmount}
                        className="rounded-full"
                        backgroundColor="bg-white/10"
                      >
                        {busy ? '…' : 'Wrap'}
                      </StandardButton>
                    </div>
                    <div className="flex items-center gap-2 flex-wrap">
                      <StandardButton
                        onClick={approveWeth}
                        disabled={busy}
                        className="rounded-full"
                        backgroundColor="bg-white/10"
                      >
                        {(wethAllowance ?? 0n) > 0n
                          ? '2. WETH approved ✓ (re-approve)'
                          : '2. Approve WETH (to bet)'}
                      </StandardButton>
                      <StandardButton
                        onClick={approveOutcomeTokens}
                        disabled={busy || ctfApproved === true}
                        className="rounded-full"
                        backgroundColor="bg-white/10"
                      >
                        {ctfApproved
                          ? '3. Outcome tokens approved ✓'
                          : '3. Approve outcome tokens (to sell)'}
                      </StandardButton>
                    </div>
                  </div>
                )}

                {/* Bet amount */}
                <div className="p-4 sm:p-5 rounded-2xl bg-black/20 border border-white/10">
                  <label className="text-sm font-medium text-white">
                    How much ETH do you want to bet?
                  </label>
                  <p className="text-gray-400 text-xs mb-2">
                    Pick an outcome below — each row shows how many tokens your bet
                    buys and the payout if that outcome wins (each winning token
                    redeems for ~1 WETH).
                  </p>
                  <input
                    type="number"
                    min="0"
                    step="any"
                    value={ethBet}
                    onChange={(e) => setEthBet(e.target.value)}
                    placeholder="e.g. 0.01"
                    className="w-full px-4 py-3 bg-white/5 border border-white/20 rounded-xl text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>

                {/* Load error (non-fatal) */}
                {loadError && (
                  <div className="p-3 rounded-xl bg-red-500/10 border border-red-500/30 text-red-200 text-xs break-words">
                    Couldn't fully load market data: {loadError}. You can still
                    try to trade, or hit Refresh.
                  </div>
                )}

                {/* Outcomes */}
                <div className="flex flex-col gap-3">
                  {outcomes.map((o) => {
                    const p = previews[o.index]
                    const mult =
                      p && ethBetNum > 0 ? p.qty / ethBetNum : undefined
                    return (
                      <div
                        key={o.index}
                        className="p-4 rounded-2xl bg-gradient-to-br from-gray-900 to-blue-900/20 border border-white/10 flex items-center gap-3 flex-wrap"
                      >
                        <div className="flex-1 min-w-[180px]">
                          <p className="text-white font-medium">
                            Outcome #{o.index + 1}
                          </p>
                          <p className="text-gray-400 text-xs">
                            Implied odds{' '}
                            {Number.isNaN(o.probability)
                              ? loading
                                ? '…'
                                : '—'
                              : `${fmt(o.probability, 1)}%`}{' '}
                            · your tokens{' '}
                            {Number.isNaN(o.balance)
                              ? userAddress
                                ? '…'
                                : '—'
                              : fmt(o.balance)}
                          </p>
                          {ethBet && (
                            <p className="text-moon-green text-xs mt-1">
                              {p ? (
                                <>
                                  Get {p.exact ? '' : '≈'}
                                  {fmt(p.qty)} tokens · payout if this wins{' '}
                                  {p.exact ? '' : '≈'}
                                  {fmt(p.qty)} WETH
                                  {mult ? ` (${fmt(mult, 2)}x)` : ''}
                                  {!p.exact ? ' …' : ''}
                                </>
                              ) : (
                                'Calculating…'
                              )}
                            </p>
                          )}
                          {o.positionId > 0n && (
                            <button
                              onClick={() =>
                                copy(
                                  `outcome #${o.index + 1} token id`,
                                  o.positionId.toString()
                                )
                              }
                              className="text-gray-500 hover:text-gray-300 text-[10px] mt-1 underline"
                            >
                              Copy token id
                            </button>
                          )}
                        </div>
                        <StandardButton
                          onClick={() => buy(o.index)}
                          disabled={busy || isClosed || !ethBet || !userAddress}
                          className="rounded-full"
                          backgroundColor="bg-moon-green"
                        >
                          {busy ? '…' : 'Bet'}
                        </StandardButton>
                        <StandardButton
                          onClick={() => sellAll(o.index)}
                          disabled={
                            busy ||
                            isClosed ||
                            !userAddress ||
                            !(o.balance > 0)
                          }
                          className="rounded-full"
                          backgroundColor="bg-moon-orange"
                        >
                          Sell all
                        </StandardButton>
                      </div>
                    )
                  })}
                </div>
                {!ethBet && (
                  <p className="text-gray-400 text-xs text-center -mt-1">
                    Enter an ETH amount above to see payouts and enable betting.
                  </p>
                )}

                {/* Outcome-token note */}
                <p className="text-gray-500 text-[11px]">
                  Outcome tokens are ERC-1155 positions in the Conditional Tokens
                  contract (
                  <button
                    onClick={() => copy('CTF address', ctfAddress)}
                    className="underline hover:text-gray-300"
                  >
                    {ctfAddress.slice(0, 6)}…{ctfAddress.slice(-4)}
                  </button>
                  ). MetaMask can't track them as a fungible balance — use “Copy
                  token id” above to import/track a position in wallets that
                  support ERC-1155.
                </p>

                {/* Redeem */}
                {isClosed && (
                  <div className="p-4 rounded-2xl bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-between gap-3 flex-wrap">
                    <p className="text-emerald-200 text-sm">
                      Market is resolved. Redeem your winning outcome tokens for
                      WETH.
                    </p>
                    <StandardButton
                      onClick={redeem}
                      disabled={busy}
                      className="rounded-full"
                      backgroundColor="bg-moon-green"
                    >
                      Redeem
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
    </div>
  )
}
