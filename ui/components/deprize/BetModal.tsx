import { getAccessToken } from '@privy-io/react-auth'
import DePrizeMintABI from 'const/abis/DePrizeMint.json'
import LMSRWithTWAP from 'const/abis/LMSRWithTWAP.json'
import { useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react'
import toast from 'react-hot-toast'
import { getContract, prepareContractCall, type Chain } from 'thirdweb'
import { betPresetEthAmounts, formatBetPresetEth } from '@/lib/deprize/betPresets'
import { fireDePrizeConfetti } from '@/lib/deprize/confetti'
import {
  DEPRIZE_PRIVACY_URL,
  DEPRIZE_RISK_DISCLOSURES_URL,
  DEPRIZE_TERMS_URL,
  DEPRIZE_TERMS_VERSION,
  UNIT,
} from '@/lib/deprize/constants'
import {
  areAttestationsAccepted,
  canSubmitDePrizeBet,
  EMPTY_ATTESTATIONS,
  type AcceptanceSubmitState,
  type DePrizeAttestations,
} from '@/lib/deprize/attestations'
import {
  eligibilityMessage,
  shouldMockSepoliaEligibility,
  type EligibilityReason,
} from '@/lib/deprize/eligibility'
import {
  DEPRIZE_ONRAMP_JWT_KEY,
  ELIGIBILITY_TIMEOUT_MS,
  ONRAMP_SUGGESTED_PURCHASE_ETH,
  getFundingStrategy,
} from '@/lib/deprize/fundingStrategy'
import {
  buildOnrampReturnUrl,
  jwtSnapshotId,
  writeOnrampSnapshot,
} from '@/lib/deprize/onrampReturn'
import { trackOnrampEvent } from '@/lib/deprize/onrampTelemetryClient'
import { arbitrumMintUsesLegacyBet, LEGACY_MINT_BET_ABI } from '@/lib/deprize/mintBet'
import { betExceedsCap, DEPRIZE_MAX_BET_WEI } from '@/lib/deprize/positionCap'
import {
  fmt,
  fmtEthWithUsd,
  fmtUsdFromEth,
  formatPrizeTokenLabel,
  toEth,
  toWei,
} from '@/lib/deprize/format'
import {
  payloadCopy,
  payloadCopyMode,
} from '@/lib/deprize/payloadPurse'
import { betBudget, betSlice, isQuoteCancelled, quoteQtyForBudget } from '@/lib/deprize/quote'
import { deprizeReadChain, deprizeReadClient } from '@/lib/deprize/read'
import { sendDePrizeTx } from '@/lib/deprize/tx'
import { useDePrizeChainGuard } from '@/lib/deprize/useDePrizeChainGuard'
import { useDePrizeLaunchpadToken } from '@/lib/deprize/useDePrizeLaunchpad'
import useOnrampJWT from '@/lib/coinbase/useOnrampJWT'
import useETHPrice from '@/lib/etherscan/useETHPrice'
import toastStyle from '@/lib/marketplace/marketplace-utils/toastConfig'
import { getChainSlug } from '@/lib/thirdweb/chain'
import client from '@/lib/thirdweb/client'
import { BetPrimaryActionContext } from '@/components/deprize/betPrimaryAction'
import EthUsd from '@/components/deprize/EthUsd'
import { TOUCH } from '@/components/deprize/detail/primitives'
import Modal from '@/components/layout/Modal'
import StandardButton from '@/components/layout/StandardButton'
import { FundOnramp } from '@/components/onramp/FundOnramp'

type BetModalProps = {
  deprizeId: number
  outcomeIndex: number
  teamName: string
  probability: number
  numOutcomes: number
  mintAddress: string
  marketAddress: string
  /** Juicebox project id this DePrize tops up — drives the prize-token label. */
  jbProjectId?: number | bigint
  chain: Chain
  account: any
  spendableEth: number
  initialAmountEth?: string
  fundsArrived?: boolean
  /**
   * Render the bet form inside another modal. The prediction window uses this
   * so a bet is optional and does not open a second dialog.
   */
  embedded?: boolean
  onClose: () => void
  onDone: (index: number, costEth: number, qtyEth: number) => void
  /** After the stake lands, record the same pick as a prediction. */
  onPlaced?: () => Promise<boolean>
}

// Quote against 99% of the budget so a little price drift doesn't revert the
// bet; the router still caps the actual spend at the full 95% budget.
const QUOTE_HEADROOM_NUM = 99n
const QUOTE_HEADROOM_DEN = 100n
// The payout line and the bet button share one quote. Reuse it briefly so
// confirming doesn't start a second LMSR waterfall.
const QUOTE_REUSE_MS = 15_000

async function readApiJson(res: Response): Promise<any> {
  const text = await res.text()
  try {
    return text ? JSON.parse(text) : {}
  } catch {
    throw new Error('The bet service returned a page instead of a result. Try again.')
  }
}

export default function BetModal({
  deprizeId,
  outcomeIndex,
  teamName,
  numOutcomes,
  mintAddress,
  marketAddress,
  jbProjectId,
  chain,
  account,
  spendableEth,
  initialAmountEth,
  fundsArrived,
  embedded = false,
  onClose,
  onDone,
  onPlaced,
}: BetModalProps) {
  const betActionApi = useContext(BetPrimaryActionContext)
  const [betAmount, setBetAmount] = useState(initialAmountEth ?? '')
  const [showFunding, setShowFunding] = useState(false)
  const ctaShown = useRef(false)
  const headingRef = useRef<HTMLHeadingElement | null>(null)
  const { generateJWT, clearJWT, getStoredJWT } = useOnrampJWT(DEPRIZE_ONRAMP_JWT_KEY)
  const fundingStrategy = getFundingStrategy(chain.id)
  const [quote, setQuote] = useState<{ qty: number } | null>(null)
  const [quoting, setQuoting] = useState(false)
  const [quoteFailed, setQuoteFailed] = useState(false)
  const [busy, setBusy] = useState(false)
  // Click-wrap: the Terms are only enforceable with an affirmative act, so the
  // box starts unchecked on every open and gates the Bet button.
  const [termsAccepted, setTermsAccepted] = useState(false)
  const [attestations, setAttestations] = useState<DePrizeAttestations>(EMPTY_ATTESTATIONS)
  const [acceptanceState, setAcceptanceState] = useState<AcceptanceSubmitState>('idle')
  const [acceptanceError, setAcceptanceError] = useState<string | undefined>()
  const mockSepoliaEligibility = shouldMockSepoliaEligibility(chain.id)
  const [eligibility, setEligibility] = useState<{
    status: 'loading' | 'ready' | 'error'
    allowed: boolean
    reason?: EligibilityReason
    message?: string
  }>(() =>
    mockSepoliaEligibility
      ? {
          status: 'ready',
          allowed: true,
          reason: 'dev-bypass',
          message: eligibilityMessage('dev-bypass'),
        }
      : { status: 'loading', allowed: false }
  )
  const [eligibilityRetry, setEligibilityRetry] = useState(0)
  const { wrongNetwork, chainLabel, switching, switchToChain, blockedByNetwork } =
    useDePrizeChainGuard(chain)
  const { ethPrice } = useETHPrice(1, 'ETH_TO_USD')

  const launchpad = useDePrizeLaunchpadToken(jbProjectId, chain)
  const prizeToken = formatPrizeTokenLabel(launchpad.symbol)

  const betAmountWei = useMemo(() => toWei(betAmount), [betAmount])
  const betAmountNum = Number(betAmountWei) / Number(UNIT)
  const sliceEth = toEth(betSlice(betAmountWei)) ?? 0

  const canBet = /^0x[0-9a-fA-F]{40}$/.test(mintAddress)
  const insufficient = betAmountNum > 0 && betAmountNum > spendableEth + 1e-12
  const overCap = betExceedsCap(betAmountWei)
  const maxBetEth = Number(DEPRIZE_MAX_BET_WEI) / Number(UNIT)

  // Quote reads go through the batching-disabled read client on the thirdweb
  // RPC edge (RPC batching silently breaks decodes in this thirdweb version).
  const lmsr = useMemo(
    () =>
      getContract({
        client: deprizeReadClient,
        chain: deprizeReadChain(chain.id),
        address: marketAddress,
        abi: LMSRWithTWAP.abi as any,
      }),
    [chain.id, marketAddress]
  )
  const legacyBet = arbitrumMintUsesLegacyBet(chain.id)
  const mint = useMemo(
    () =>
      canBet
        ? getContract({
            client,
            chain,
            address: mintAddress,
            abi: (legacyBet ? LEGACY_MINT_BET_ABI : DePrizeMintABI) as any,
          })
        : undefined,
    [canBet, chain, legacyBet, mintAddress]
  )

  const quoteCacheRef = useRef<{
    key: string
    at: number
    promise: Promise<bigint>
    qty?: bigint
  } | null>(null)
  const loadQuote = useCallback(
    (target: bigint, cancelled?: () => boolean) => {
      const key = `${chain.id}:${marketAddress}:${outcomeIndex}:${target}`
      const cached = quoteCacheRef.current
      if (cached && cached.key === key && Date.now() - cached.at < QUOTE_REUSE_MS) {
        return cached.promise
      }
      const entry: { key: string; at: number; promise: Promise<bigint>; qty?: bigint } = {
        key,
        at: Date.now(),
        promise: undefined as unknown as Promise<bigint>,
      }
      const promise = quoteQtyForBudget(lmsr, outcomeIndex, target, numOutcomes, {
        cancelled,
      }).then(
        (qty) => {
          if (quoteCacheRef.current === entry) entry.qty = qty
          return qty
        },
        (err) => {
          if (quoteCacheRef.current === entry) quoteCacheRef.current = null
          throw err
        }
      )
      entry.promise = promise
      quoteCacheRef.current = entry
      return promise
    },
    [chain.id, lmsr, marketAddress, numOutcomes, outcomeIndex]
  )

  // Live payout quote: the real, price-impact-aware token amount the 95% budget
  // buys (each winning token redeems 1:1 for ETH, so qty == potential payout).
  // A replaced amount stops the previous quote from issuing more RPC calls, and
  // a single failure is retried before the line gives up.
  useEffect(() => {
    if (betAmountWei <= 0n) {
      setQuote(null)
      setQuoting(false)
      setQuoteFailed(false)
      return
    }
    let cancelled = false
    setQuote(null)
    setQuoting(true)
    setQuoteFailed(false)
    const quoteOnce = async () => {
      const budget = betBudget(betAmountWei)
      const target = (budget * QUOTE_HEADROOM_NUM) / QUOTE_HEADROOM_DEN
      const qty = await loadQuote(target, () => cancelled)
      return Number(qty) / Number(UNIT)
    }
    const t = setTimeout(async () => {
      try {
        const qty = await quoteOnce()
        if (!cancelled) setQuote({ qty })
      } catch (err) {
        if (cancelled || isQuoteCancelled(err)) return
        try {
          const qty = await quoteOnce()
          if (!cancelled) setQuote({ qty })
        } catch (err2) {
          if (cancelled || isQuoteCancelled(err2)) return
          console.warn('[deprize] payout quote failed', err2)
          if (!cancelled) {
            setQuote(null)
            setQuoteFailed(true)
          }
        }
      } finally {
        if (!cancelled) setQuoting(false)
      }
    }, 250)
    return () => {
      cancelled = true
      clearTimeout(t)
    }
  }, [betAmountWei, loadQuote])

  const wallet = typeof account?.address === 'string' ? account.address : ''
  const needsFunding =
    eligibility.allowed && (insufficient || spendableEth === 0)
  async function persistOnrampSession(): Promise<boolean> {
    if (!wallet || fundingStrategy.kind !== 'onramp') return false
    const jwt = await generateJWT({
      address: wallet,
      chainSlug: fundingStrategy.chainSlug,
      context: 'deprize',
    })
    if (!jwt) {
      trackOnrampEvent('jwt_generate_error')
      toast.error('Could not start add-funds. Try again.', { style: toastStyle })
      return false
    }
    writeOnrampSnapshot(jwtSnapshotId(jwt), {
      spendableEthAtReturn: spendableEth,
      consumed: false,
    })
    return true
  }

  useEffect(() => {
    if (fundsArrived) headingRef.current?.focus()
  }, [fundsArrived])

  useEffect(() => {
    if (!needsFunding || ctaShown.current) return
    if (fundingStrategy.kind === 'none') return
    ctaShown.current = true
    trackOnrampEvent('cta_shown')
  }, [needsFunding, fundingStrategy.kind])

  useEffect(() => {
    if (mockSepoliaEligibility) {
      setEligibility({
        status: 'ready',
        allowed: true,
        reason: 'dev-bypass',
        message: eligibilityMessage('dev-bypass'),
      })
      return
    }
    if (!wallet) {
      setEligibility({
        status: 'ready',
        allowed: false,
        reason: 'invalid-wallet',
        message: eligibilityMessage('invalid-wallet'),
      })
      return
    }
    let cancelled = false
    setEligibility({ status: 'loading', allowed: false })
    const timeout = setTimeout(() => {
      if (cancelled) return
      setEligibility({
        status: 'error',
        allowed: false,
        reason: 'screening-unavailable',
        message: eligibilityMessage('screening-unavailable'),
      })
    }, ELIGIBILITY_TIMEOUT_MS)
    ;(async () => {
      const accessToken = await getAccessToken().catch(() => null)
      const res = await fetch(
        `/api/deprize/eligibility?wallet=${encodeURIComponent(wallet)}&chainId=${chain.id}`,
        {
          headers: accessToken ? { Authorization: `Bearer ${accessToken}` } : {},
        }
      )
      const data = await readApiJson(res)
      if (cancelled) return
      clearTimeout(timeout)
      setEligibility({
        status: 'ready',
        allowed: Boolean(data.allowed),
        reason: data.reason,
        message: data.message || eligibilityMessage(data.reason || 'screening-unavailable'),
      })
    })().catch(() => {
      if (cancelled) return
      clearTimeout(timeout)
      setEligibility({
        status: 'error',
        allowed: false,
        reason: 'screening-unavailable',
        message: eligibilityMessage('screening-unavailable'),
      })
    })
    return () => {
      cancelled = true
      clearTimeout(timeout)
    }
  }, [wallet, eligibilityRetry, mockSepoliaEligibility, chain.id])

  const allAttested = areAttestationsAccepted(attestations)
  const acceptanceFlight = useRef<Promise<boolean> | null>(null)
  const acceptanceErrorRef = useRef<string | undefined>(undefined)
  const acceptanceGen = useRef(0)
  // Accept-terms is stored per wallet and chain. This modal stays open across
  // account switches, so a resolved write for the previous account must not count.
  const acceptanceFlightFor = useRef('')
  const acceptanceSavedFor = useRef('')

  const recordAcceptance = useCallback(async (): Promise<boolean> => {
    if (!wallet || !termsAccepted || !areAttestationsAccepted(attestations)) return false
    const identity = `${chain.id}:${wallet}`
    if (acceptanceFlight.current && acceptanceFlightFor.current === identity) {
      return acceptanceFlight.current
    }
    acceptanceGen.current += 1
    acceptanceFlight.current = null
    acceptanceSavedFor.current = ''
    acceptanceFlightFor.current = identity
    const gen = acceptanceGen.current
    const flight = (async () => {
      setAcceptanceState('saving')
      setAcceptanceError(undefined)
      acceptanceErrorRef.current = undefined
      const accessToken = await getAccessToken().catch(() => null)
      const res = await fetch('/api/deprize/accept-terms', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {}),
        },
        body: JSON.stringify({
          wallet,
          chainId: chain.id,
          accepted: true,
          termsVersion: DEPRIZE_TERMS_VERSION,
          attestations,
        }),
      })
      if (acceptanceGen.current !== gen) return false
      if (!res.ok) {
        const data = await res.json().catch(() => null)
        if (acceptanceGen.current !== gen) return false
        const message =
          typeof data?.message === 'string'
            ? data.message
            : 'Could not record your acceptance. Try again.'
        acceptanceErrorRef.current = message
        setAcceptanceError(message)
        setAcceptanceState('error')
        return false
      }
      acceptanceSavedFor.current = identity
      setAcceptanceState('saved')
      return true
    })().catch((err) => {
      console.warn('[deprize] accept-terms failed', err)
      if (acceptanceGen.current !== gen) return false
      const message = 'Could not record your acceptance. Try again.'
      acceptanceErrorRef.current = message
      setAcceptanceError(message)
      setAcceptanceState('error')
      return false
    })
    acceptanceFlight.current = flight
    void flight.then((ok) => {
      if (!ok && acceptanceFlight.current === flight) acceptanceFlight.current = null
    })
    return flight
  }, [attestations, chain.id, termsAccepted, wallet])

  useEffect(() => {
    if (!wallet || !termsAccepted || !allAttested) {
      acceptanceGen.current += 1
      acceptanceFlight.current = null
      acceptanceFlightFor.current = ''
      acceptanceSavedFor.current = ''
      setAcceptanceState('idle')
      setAcceptanceError(undefined)
      acceptanceErrorRef.current = undefined
      return
    }
    void recordAcceptance()
  }, [wallet, chain.id, termsAccepted, allAttested, recordAcceptance])

  const placeBet = async (): Promise<boolean> => {
    if (!account || !mint) return false
    if (betAmountWei <= 0n) {
      toast.error('Enter an ETH amount.', { style: toastStyle })
      return false
    }
    if (overCap) {
      toast.error(eligibilityMessage('over-cap'), { style: toastStyle })
      return false
    }
    if (!termsAccepted || !areAttestationsAccepted(attestations)) {
      toast.error('Please accept the DePrize Terms and attestations to continue.', {
        style: toastStyle,
      })
      return false
    }
    // The boxes can be checked before the acceptance write finishes. Wait for
    // that write instead of telling the person to check boxes they already did.
    // A save for another wallet or chain does not satisfy this account.
    const acceptanceOk =
      (acceptanceState === 'saved' && acceptanceSavedFor.current === `${chain.id}:${wallet}`) ||
      (await recordAcceptance())
    if (!acceptanceOk) {
      toast.error(
        acceptanceErrorRef.current ||
          acceptanceError ||
          'Could not record your acceptance. Try again.',
        { style: toastStyle }
      )
      return false
    }
    if (eligibility.status !== 'ready' || !eligibility.allowed) {
      toast.error(
        eligibility.message ||
          (eligibility.status === 'loading'
            ? 'Still checking whether you can add ETH. Try again in a moment.'
            : eligibilityMessage('screening-unavailable')),
        { style: toastStyle }
      )
      return false
    }
    if (!canSubmitDePrizeBet({
      termsAccepted,
      attestations,
      eligibilityAllowed: eligibility.allowed,
      eligibilityReady: eligibility.status === 'ready',
      acceptanceState: 'saved',
    })) {
      toast.error('Please accept the DePrize Terms and attestations to continue.', {
        style: toastStyle,
      })
      return false
    }
    if (!eligibility.allowed) {
      toast.error(eligibility.message || eligibilityMessage('screening-unavailable'), {
        style: toastStyle,
      })
      return false
    }
    // Re-checked here as well as in the button: the wallet can be switched
    // while this modal is open.
    if (blockedByNetwork()) return false
    setBusy(true)
    const budget = betBudget(betAmountWei)
    const target = (budget * QUOTE_HEADROOM_NUM) / QUOTE_HEADROOM_DEN
    const quoteKey = `${chain.id}:${marketAddress}:${outcomeIndex}:${target}`
    const cached = quoteCacheRef.current
    const readyQty =
      cached &&
      cached.key === quoteKey &&
      Date.now() - cached.at < QUOTE_REUSE_MS &&
      cached.qty != null &&
      cached.qty > 0n
        ? cached.qty
        : null
    if (readyQty == null) toast.loading('Quoting…', { id: 'quote', style: toastStyle })
    try {
      const qty = readyQty ?? (await loadQuote(target))
      if (qty <= 0n) throw new Error('Bet too small for this market.')
      toast.dismiss('quote')
      toast.loading('Preparing your stake…', {
        id: 'permit',
        style: toastStyle,
      })
      const accessToken = await getAccessToken().catch(() => null)
      const permitRes = await fetch('/api/deprize/permit', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {}),
        },
        body: JSON.stringify({
          wallet,
          deprizeId,
          chainId: chain.id,
          accepted: true,
          termsVersion: DEPRIZE_TERMS_VERSION,
          attestations,
        }),
      })
      const permit = await readApiJson(permitRes)
      if (!permitRes.ok || !permit.signature || !permit.deadline) {
        throw new Error(permit.message || eligibilityMessage(permit.reason || 'permit-unavailable'))
      }
      toast.dismiss('permit')
      toast.loading('Placing bet…', { id: 'bet', style: toastStyle })
      // The router splits msg.value (5% slice -> this DePrize's Juicebox project
      // / project token, 95% -> market) and caps the trade cost at the 95%
      // budget (maxCost), refunding any unspent ETH. Sepolia's mint also checks
      // the server-issued CompliancePermit. Arbitrum One's deployed mint does
      // not take that signature; the permit request above is still the
      // eligibility gate before this transaction is sent.
      const params = legacyBet
        ? [BigInt(deprizeId), BigInt(outcomeIndex), qty, budget]
        : [
            BigInt(deprizeId),
            BigInt(outcomeIndex),
            qty,
            budget,
            BigInt(permit.deadline),
            permit.signature,
          ]
      await sendDePrizeTx(
        account,
        prepareContractCall({
          contract: mint,
          method: 'bet' as string,
          params,
          value: betAmountWei,
        })
      )
      toast.dismiss('bet')
      const qtyNum = Number(qty) / Number(UNIT)
      const onrampToken = getStoredJWT()
      const withinOnrampSession = Boolean(fundsArrived || initialAmountEth || onrampToken)
      clearJWT()
      if (withinOnrampSession) trackOnrampEvent('bet_placed_within_session')
      const predicted = onPlaced ? await onPlaced() : false
      fireDePrizeConfetti()
      const backed = `backed it with ${fmtEthWithUsd(betAmountNum, ethPrice)}. To win ${fmtEthWithUsd(
        qtyNum,
        ethPrice
      )} if it wins.`
      toast.success(
        predicted ? `Predicted ${teamName} and ${backed}` : `Backed ${teamName} with ${fmtEthWithUsd(betAmountNum, ethPrice)}. To win ${fmtEthWithUsd(qtyNum, ethPrice)} if it wins.`,
        { style: toastStyle, duration: 8000 }
      )
      onDone(outcomeIndex, betAmountNum, qtyNum)
      onClose()
      return true
    } catch (err: any) {
      toast.dismiss('quote')
      toast.dismiss('permit')
      toast.dismiss('bet')
      console.error('[deprize] bet failed', err)
      toast.error(err?.shortMessage || err?.message || 'Bet failed.', {
        style: toastStyle,
        duration: 8000,
      })
      return false
    } finally {
      setBusy(false)
    }
  }

  const placeBetRef = useRef(placeBet)
  placeBetRef.current = placeBet
  const drivenByPredict = embedded && betActionApi != null
  const betActionKey = [
    betAmountNum,
    needsFunding,
    fundingStrategy.kind,
    eligibility.status,
    eligibility.allowed,
    overCap,
    wrongNetwork,
    canBet,
    busy,
    termsAccepted,
    allAttested,
    acceptanceState,
    betAmountWei > 0n,
    ethPrice ?? '',
  ].join('|')

  useEffect(() => {
    if (!embedded || !betActionApi) return
    return () => betActionApi.report(null)
  }, [embedded, betActionApi])

  useEffect(() => {
    if (!embedded || !betActionApi) return
    betActionApi.setRun(() => {
      void placeBetRef.current()
    })
    if (!(betAmountNum > 0)) {
      betActionApi.report(null)
      return
    }
    if (needsFunding && fundingStrategy.kind !== 'none') {
      betActionApi.setRun(() => {
        setShowFunding(true)
        trackOnrampEvent('cta_clicked')
        if (fundingStrategy.kind === 'faucet') trackOnrampEvent('provider_selected:faucet')
      })
      betActionApi.report({
        kind: 'fund',
        label: 'Add funds to your wallet',
        disabled: false,
      })
      return
    }
    if (needsFunding) {
      betActionApi.report({
        kind: 'place',
        label: 'Lower your bet or add funds.',
        disabled: true,
      })
      return
    }
    const placeDisabled =
      busy ||
      betAmountWei <= 0n ||
      overCap ||
      wrongNetwork ||
      !canBet ||
      eligibility.status !== 'ready' ||
      !eligibility.allowed ||
      !canSubmitDePrizeBet({
        termsAccepted,
        attestations,
        eligibilityAllowed: eligibility.allowed,
        eligibilityReady: eligibility.status === 'ready',
        acceptanceState,
      })
    const placeLabel = busy
      ? 'Placing bet…'
      : !termsAccepted || !allAttested
      ? 'Accept the Terms to bet'
      : acceptanceState === 'saving'
      ? 'Recording acceptance…'
      : acceptanceState === 'error'
      ? 'Acceptance failed — retry'
      : eligibility.status === 'loading'
      ? 'Checking eligibility…'
      : `Bet ${fmtEthWithUsd(betAmountNum, ethPrice)}`
    betActionApi.setRun(() => {
      void placeBetRef.current()
    })
    betActionApi.report({
      kind: 'place',
      label: placeLabel,
      disabled: placeDisabled,
    })
    // betActionKey covers the inputs that change the label or whether it can run.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [embedded, betActionApi, betActionKey])

  const betMult = quote && betAmountNum > 0 ? quote.qty / betAmountNum : undefined
  const stakeUnlocked = eligibility.status === 'ready' && eligibility.allowed

  const body = (
      <div className="flex flex-col gap-4 w-full">
        <h2
          ref={headingRef}
          tabIndex={-1}
          id="deprize-bet-heading"
          className="sr-only"
        >
          Back {teamName}
        </h2>
        {fundsArrived && (
          <p role="status" className="text-moon-green text-sm">
            Funds arrived. You can place your bet.
          </p>
        )}

        {eligibility.status === 'loading' && (
          <p className="text-gray-300 text-sm">Checking eligibility…</p>
        )}
        {(eligibility.status === 'error' ||
          (eligibility.status === 'ready' && !eligibility.allowed)) && (
          <div className="space-y-2">
            <p className="text-amber-300 text-sm">
              {eligibility.message || 'Adding ETH is unavailable.'}
            </p>
            {eligibility.status === 'error' && (
              <button
                type="button"
                className={`inline-flex items-center text-sm text-indigo-300 underline ${TOUCH}`}
                onClick={() => setEligibilityRetry((n) => n + 1)}
              >
                Retry eligibility check
              </button>
            )}
          </div>
        )}
        {stakeUnlocked && (
        <>
        <div>
          <label className="text-xs text-gray-400">How much do you want to bet? (ETH)</label>
          <input
            type="number"
            inputMode="decimal"
            min="0"
            step="any"
            autoFocus={!embedded && !fundsArrived}
            value={betAmount}
            onChange={(e) => setBetAmount(e.target.value)}
            placeholder="e.g. 0.01"
            className="mt-1 w-full px-4 py-3 text-base bg-white/5 border border-white/20 rounded-xl text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
          {betAmountNum > 0 && fmtUsdFromEth(betAmountNum, ethPrice) && (
            <p className="text-white/55 text-xs mt-1 tabular-nums">
              {fmtUsdFromEth(betAmountNum, ethPrice)}
            </p>
          )}
          <div className="flex gap-2 mt-2 flex-wrap">
            {betPresetEthAmounts(ethPrice, maxBetEth).map((eth) => {
              const amount = formatBetPresetEth(eth)
              const usd = fmtUsdFromEth(eth, ethPrice)
              return (
                <button
                  key={amount}
                  onClick={() => setBetAmount(amount)}
                  className={`px-3.5 py-1.5 rounded-full bg-white/5 hover:bg-white/10 text-gray-300 text-xs ${TOUCH}`}
                >
                  {amount} ETH{usd ? ` (${usd})` : ''}
                </button>
              )
            })}
          </div>
        </div>

        {/* Payout + fee/slice breakdown */}
        {betAmountNum > 0 && (
          <div className="p-4 rounded-xl bg-black/30 border border-white/10 flex flex-col gap-1">
            {quote ? (
              <>
                <div className="flex items-center justify-between">
                  <span className="text-gray-400 text-sm">To win if it wins</span>
                  <span className="text-moon-green text-lg font-bold">
                    <EthUsd eth={quote.qty} usdClassName="text-moon-green/70 font-normal text-sm" />
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-gray-500 text-xs">Payout multiple</span>
                  <span className="text-gray-300 text-xs">
                    {betMult ? `${fmt(betMult, 2)}x` : '—'}
                  </span>
                </div>
              </>
            ) : (
              <p className="text-gray-400 text-sm">
                {quoting
                  ? 'Calculating payout…'
                  : quoteFailed
                  ? 'Couldn’t calculate the payout. Edit the amount to try again.'
                  : 'Enter an amount'}
              </p>
            )}
            <div className="flex items-center justify-between mt-1">
              <span className="text-gray-500 text-xs">Prize contribution (5% → {prizeToken})</span>
              <span className="text-gray-300 text-xs">
                <EthUsd eth={sliceEth} prize usdClassName="text-gray-400 font-normal" />
              </span>
            </div>
          </div>
        )}

        {/* Point-of-bet disclosure. Shown only once an amount is entered, since
            a prediction with no stake does not need these acknowledgements.
            Mirrors the non-custodial prediction-market approach (read the rules;
            total-loss risk; equal-payout on void/cancel; final resolution). */}
        {betAmountNum > 0 && (
        <>
        <div className="text-amber-300/90 text-xs sm:text-[11px] leading-snug space-y-1.5">
          <p>
            You are buying outcome tokens for this competitor. If this competitor wins, they redeem
            for their full share; if it loses, they are{' '}
            <span className="font-semibold">worth $0</span>. Only bet what you can afford to lose.
            Read this DePrize&apos;s rules before betting — resolution is final and cannot be
            reversed.
          </p>
          <p>
            {payloadCopy('fivePercentLine', payloadCopyMode(DEPRIZE_TERMS_VERSION))}
            {launchpad.name ? ` (${launchpad.name})` : ''} — you receive {prizeToken} for that
            slice. If the DePrize is cancelled or ends with no winner, it resolves on an
            equal-payout basis — <span className="font-semibold">every token redeems for 1/N</span>,
            not your original stake — so a bet placed at odds above the average (1/N) may redeem for
            less than you put in.
          </p>
          <p>
            MoonDAO funds the market maker, receives the market fee, reports the result and sponsors
            the prize. DePrize is{' '}
            <span className="font-semibold">not available to U.S. persons</span> or in restricted
            jurisdictions. See the{' '}
            <a
              href={DEPRIZE_RISK_DISCLOSURES_URL}
              target="_blank"
              rel="noopener noreferrer"
              className="underline hover:text-amber-200"
            >
              Risk Disclosures
            </a>
            .
          </p>
        </div>

        <div className="flex flex-col gap-2">
          <label className="flex items-start gap-2.5 text-xs sm:text-[11px] leading-snug text-gray-300 cursor-pointer">
            <input
              type="checkbox"
              checked={termsAccepted}
              onChange={(e) => setTermsAccepted(e.target.checked)}
              className="mt-0.5 h-5 w-5 shrink-0 rounded border-white/30 bg-white/5 accent-moon-green"
            />
            <span>
              I have read and agree to the{' '}
              <a
                href={DEPRIZE_TERMS_URL}
                target="_blank"
                rel="noopener noreferrer"
                className="underline hover:text-white"
              >
                DePrize Terms &amp; Conditions
              </a>{' '}
              (v{DEPRIZE_TERMS_VERSION}),{' '}
              <a
                href={DEPRIZE_PRIVACY_URL}
                target="_blank"
                rel="noopener noreferrer"
                className="underline hover:text-white"
              >
                Privacy Notice
              </a>{' '}
              and{' '}
              <a
                href={DEPRIZE_RISK_DISCLOSURES_URL}
                target="_blank"
                rel="noopener noreferrer"
                className="underline hover:text-white"
              >
                Risk Disclosures
              </a>
              .
            </span>
          </label>
          <label className="flex items-start gap-2.5 text-xs sm:text-[11px] leading-snug text-gray-300 cursor-pointer">
            <input
              type="checkbox"
              checked={attestations.notUsResident}
              onChange={(e) =>
                setAttestations((prev) => ({ ...prev, notUsResident: e.target.checked }))
              }
              className="mt-0.5 h-5 w-5 shrink-0 rounded border-white/30 bg-white/5 accent-moon-green"
            />
            <span>
              I am not a resident of the United States, and I am not currently located in the
              United States or any of its territories.
            </span>
          </label>
          <label className="flex items-start gap-2.5 text-xs sm:text-[11px] leading-snug text-gray-300 cursor-pointer">
            <input
              type="checkbox"
              checked={attestations.notUsEntityOrRepresentative}
              onChange={(e) =>
                setAttestations((prev) => ({
                  ...prev,
                  notUsEntityOrRepresentative: e.target.checked,
                }))
              }
              className="mt-0.5 h-5 w-5 shrink-0 rounded border-white/30 bg-white/5 accent-moon-green"
            />
            <span>
              I am not acting for or on behalf of an entity organized in, or with its principal
              place of business in, the United States.
            </span>
          </label>
          <label className="flex items-start gap-2.5 text-xs sm:text-[11px] leading-snug text-gray-300 cursor-pointer">
            <input
              type="checkbox"
              checked={attestations.notInsiderOrProxy}
              onChange={(e) =>
                setAttestations((prev) => ({ ...prev, notInsiderOrProxy: e.target.checked }))
              }
              className="mt-0.5 h-5 w-5 shrink-0 rounded border-white/30 bg-white/5 accent-moon-green"
            />
            <span>
              I am not an insider for this DePrize, and I am not placing this bet on behalf of
              anyone else.
            </span>
          </label>
          {acceptanceState === 'error' && (
            <p className="text-amber-300 text-xs sm:text-[11px]">
              {acceptanceError ||
                'We could not record your acceptance. Recheck the boxes to try again.'}
            </p>
          )}
        </div>
        </>
        )}

        {eligibility.status === 'loading' ? (
          <p className="text-gray-300 text-sm">Checking eligibility…</p>
        ) : eligibility.status === 'error' || !eligibility.allowed ? (
          <div className="space-y-2">
            <p className="text-amber-300 text-sm">
              {eligibility.message || 'Betting unavailable'}
            </p>
            {eligibility.status === 'error' && (
              <button
                type="button"
                className={`inline-flex items-center text-sm text-indigo-300 underline ${TOUCH}`}
                onClick={() => setEligibilityRetry((n) => n + 1)}
              >
                Retry eligibility check
              </button>
            )}
          </div>
        ) : overCap ? (
          <p className="text-amber-300 text-sm">
            Generation-1 bets are capped at {fmtEthWithUsd(maxBetEth, ethPrice, { prize: true })} per
            transaction. Lower the amount to continue.
          </p>
        ) : wrongNetwork ? (
          <div className="space-y-3">
            <p className="text-amber-300 text-sm">
              Your wallet is on a different network. Bets are placed on{' '}
              <span className="font-semibold">{chainLabel}</span> — switch to continue.
            </p>
            <StandardButton
              onClick={switchToChain}
              disabled={switching}
              className="rounded-full w-full"
              backgroundColor="bg-moon-green"
            >
              {switching ? 'Switching…' : `Switch wallet to ${chainLabel}`}
            </StandardButton>
          </div>
        ) : !canBet ? (
          <div className="p-3 rounded-xl bg-amber-500/10 border border-amber-500/30 text-amber-200 text-sm">
            Betting isn&apos;t live yet on this network — the bet router is not deployed. Check back
            soon.
          </div>
        ) : needsFunding ? (
          <div className="space-y-3">
            <p className="text-amber-300 text-sm">
              You only have {fmtEthWithUsd(spendableEth, ethPrice, { prize: true })} available (a
              little is kept back for gas).
            </p>
            {spendableEth > 0 && (
              <button
                type="button"
                className={`inline-flex items-center text-sm text-moon-green underline ${TOUCH}`}
                onClick={() => setBetAmount(String(Math.floor(spendableEth * 1e6) / 1e6))}
              >
                Bet {fmtEthWithUsd(spendableEth, ethPrice, { prize: true })} instead
              </button>
            )}
            {fundingStrategy.kind === 'none' ? (
              <p className="text-amber-300 text-sm">Lower your bet or add funds.</p>
            ) : (
              <>
                {!drivenByPredict && (
                  <button
                    type="button"
                    className={`w-full rounded-full border border-white/25 px-4 py-2 text-sm text-white ${TOUCH}`}
                    onClick={() => {
                      setShowFunding(true)
                      trackOnrampEvent('cta_clicked')
                      if (fundingStrategy.kind === 'faucet') {
                        trackOnrampEvent('provider_selected:faucet')
                      }
                    }}
                  >
                    Add funds to your wallet
                  </button>
                )}
                {showFunding && (
                  <div className="space-y-2">
                    <p className="text-gray-400 text-xs leading-relaxed">
                      {drivenByPredict
                        ? 'This buys ETH into your wallet for this bet. MoonDAO never holds it. When the ETH arrives, the button places the bet.'
                        : 'This buys ETH into your own wallet. It is not a bet, MoonDAO never holds it, and MoonDAO cannot reverse it. You may still be unable to bet afterwards.'}
                    </p>
                    {fundingStrategy.kind === 'faucet' ? (
                      <p className="text-gray-300 text-sm">
                        Get Sepolia ETH from a faucet (e.g.{' '}
                        <a
                          href={fundingStrategy.faucetUrl}
                          target="_blank"
                          rel="noreferrer"
                          className="underline text-indigo-300"
                        >
                          sepoliafaucet.com
                        </a>
                        ), then come back — your balance will refresh.
                      </p>
                    ) : (
                      <FundOnramp
                        address={wallet}
                        selectedChain={chain}
                        ethAmount={betAmountNum || ONRAMP_SUGGESTED_PURCHASE_ETH}
                        defaultProvider={fundingStrategy.defaultProvider}
                        coinbaseRedirectUrl={buildOnrampReturnUrl({
                          origin: typeof window !== 'undefined' ? window.location.origin : '',
                          deprizeId,
                          outcomeIndex,
                          amountEth: betAmountNum > 0 ? String(betAmountNum) : undefined,
                          capEth: String(maxBetEth),
                          chainSlug: getChainSlug(chain),
                        })}
                        onCoinbaseBeforeNavigate={async () => {
                          const ok = await persistOnrampSession()
                          if (!ok) throw new Error('jwt_generate_error')
                          trackOnrampEvent('provider_selected:coinbase')
                        }}
                        onMoonPayBeforeOpen={async () => {
                          const ok = await persistOnrampSession()
                          if (!ok) throw new Error('jwt_generate_error')
                          trackOnrampEvent('provider_selected:moonpay')
                        }}
                      />
                    )}
                  </div>
                )}
              </>
            )}
          </div>
        ) : drivenByPredict ? null : (
          <StandardButton
            onClick={placeBet}
            disabled={
              busy ||
              betAmountWei <= 0n ||
              overCap ||
              !canSubmitDePrizeBet({
                termsAccepted,
                attestations,
                eligibilityAllowed: eligibility.allowed,
                eligibilityReady: eligibility.status === 'ready',
                acceptanceState,
              })
            }
            className="rounded-full w-full"
            backgroundColor="bg-moon-green"
          >
            {busy
              ? 'Placing bet…'
              : betAmountNum <= 0
              ? 'Enter an amount'
              : !termsAccepted || !allAttested
              ? 'Accept the Terms to bet'
              : acceptanceState === 'saving'
              ? 'Recording acceptance…'
              : acceptanceState === 'error'
              ? 'Acceptance failed — retry'
              : `Bet ${fmtEthWithUsd(betAmountNum, ethPrice)}`}
          </StandardButton>
        )}
        </>
        )}
      </div>
  )

  if (embedded) return body

  return (
    <Modal id="deprize-bet" setEnabled={(v) => !v && onClose()} title={`Back ${teamName}`}>
      {body}
    </Modal>
  )
}
