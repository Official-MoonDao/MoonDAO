import { useRouter } from 'next/router'
import { useEffect, useRef, useState } from 'react'
import useOnrampJWT from '@/lib/coinbase/useOnrampJWT'
import {
  DEPRIZE_ONRAMP_JWT_KEY,
  JWT_FRESHNESS_MS,
  WALLET_WAIT_MS,
  getFundingStrategy,
  pollWindowMs,
} from './fundingStrategy'
import {
  jwtSnapshotId,
  markOnrampSnapshotConsumed,
  mockOnrampEnabled,
  parseMockOnrampScenario,
  parseOnrampReturn,
  readOnrampSnapshot,
} from './onrampReturn'
import { trackOnrampEvent } from './onrampTelemetryClient'
import { resolveOnrampReturn, toJwtIssuedAtMs, type ReturnNotice } from './resolveOnrampReturn'

export type OnrampReturnState = {
  betIndex: number | null
  prefillEth?: string
  fundsArrived?: boolean
  notice?: ReturnNotice
}

function sleep(ms: number) {
  return new Promise<void>((resolve) => setTimeout(resolve, ms))
}

function stripOnrampParams(router: ReturnType<typeof useRouter>) {
  const rest = { ...router.query }
  delete rest.onrampSuccess
  delete rest.outcome
  delete rest.amount
  delete rest.mockOnramp
  router.replace({ pathname: router.pathname, query: rest }, undefined, { shallow: true })
}

export function useDePrizeOnrampReturn(opts: {
  userAddress?: string
  numOutcomes: number
  marketLoading: boolean
  acceptsBets: boolean
  spendableEthNow?: number
  capEth: number
  deprizeState?: number
  liveTipId?: number
  chainId?: number
  refetchSpendable?: () => Promise<number | undefined>
}): OnrampReturnState {
  const router = useRouter()
  const { verifyJWT, getStoredJWT, storedJWT, getAddressFromJWT } =
    useOnrampJWT(DEPRIZE_ONRAMP_JWT_KEY)
  const [state, setState] = useState<OnrampReturnState>({ betIndex: null })
  const handled = useRef(false)
  const started = useRef(false)
  const walletWaitStarted = useRef<number | null>(null)
  const returnReceived = useRef(false)
  const spendableRef = useRef(opts.spendableEthNow)
  const refetchRef = useRef(opts.refetchSpendable)
  spendableRef.current = opts.spendableEthNow
  refetchRef.current = opts.refetchSpendable

  useEffect(() => {
    if (!router.isReady || opts.marketLoading || opts.numOutcomes <= 0) return
    if (handled.current || started.current) return

    const parsed = parseOnrampReturn(router.query)
    const mock = mockOnrampEnabled() ? parseMockOnrampScenario(router.query) : null
    if (!parsed.active && !mock) return

    if (!opts.userAddress) {
      if (walletWaitStarted.current == null) walletWaitStarted.current = Date.now()
      if (Date.now() - walletWaitStarted.current < WALLET_WAIT_MS) return
      handled.current = true
      stripOnrampParams(router)
      setState({
        betIndex: null,
        notice: { kind: 'connect-wallet' },
      })
      return
    }

    started.current = true
    let cancelled = false

    ;(async () => {
      const token = storedJWT || getStoredJWT()
      let jwtVerified = false
      let jwtAddress: string | undefined
      let jwtIssuedAtMs: number | undefined
      let jwtConsumed = false

      if (mock) {
        jwtVerified = mock !== 'stale'
        jwtAddress = opts.userAddress
        jwtIssuedAtMs = mock === 'stale' ? Date.now() - JWT_FRESHNESS_MS - 1 : Date.now()
      } else if (token) {
        const fundedAddress = getAddressFromJWT(token) || undefined
        const payload = await verifyJWT(
          token,
          fundedAddress || opts.userAddress,
          undefined,
          'deprize'
        )
        if (cancelled) return
        jwtVerified = !!payload
        jwtAddress = payload?.address || fundedAddress
        jwtIssuedAtMs = payload?.timestamp != null ? toJwtIssuedAtMs(payload.timestamp) : undefined
        const snap = readOnrampSnapshot(jwtSnapshotId(token))
        jwtConsumed = snap?.consumed === true
      }

      if (!returnReceived.current) {
        returnReceived.current = true
        trackOnrampEvent('return_received')
      }

      const snapshot = token ? readOnrampSnapshot(jwtSnapshotId(token)) : null
      const strategy = opts.chainId != null ? getFundingStrategy(opts.chainId) : undefined
      const windowMs = mock || strategy?.kind !== 'onramp' ? 0 : pollWindowMs(strategy, 'coinbase')
      const intervalMs = strategy?.kind === 'onramp' ? strategy.pollIntervalMs : 0

      const resolveWith = (spendableEthNow: number | undefined) =>
        resolveOnrampReturn({
          parsed: parsed.active ? parsed : { active: true, outcomeIndex: 0 },
          jwtVerified: mock === 'closed' ? true : jwtVerified,
          jwtAddress,
          jwtIssuedAtMs,
          jwtConsumed,
          nowMs: Date.now(),
          userAddress: opts.userAddress,
          numOutcomes: opts.numOutcomes,
          marketAcceptsBets: mock === 'closed' ? false : opts.acceptsBets,
          spendableEthAtReturn:
            mock === 'instant'
              ? 0
              : mock === 'short'
              ? 0
              : mock === 'none'
              ? 0.01
              : snapshot?.spendableEthAtReturn,
          spendableEthNow:
            mock === 'instant'
              ? 0.05
              : mock === 'short'
              ? 0.004
              : mock === 'none'
              ? 0.01
              : spendableEthNow,
          capEth: opts.capEth,
        })

      let spendableNow = spendableRef.current
      if (!mock && spendableNow === undefined && refetchRef.current) {
        spendableNow = await refetchRef.current()
        if (cancelled) return
      }

      let result = resolveWith(spendableNow)
      if (cancelled) return
      handled.current = true
      if (token) markOnrampSnapshotConsumed(jwtSnapshotId(token))
      stripOnrampParams(router)

      if (result.action === 'ignore') {
        if (!jwtVerified) trackOnrampEvent('return_rejected:no_jwt')
        else if (result.notice?.kind === 'market-closed') {
          trackOnrampEvent('return_rejected:market_closed')
        } else if (jwtConsumed) trackOnrampEvent('return_rejected:consumed')
        setState({ betIndex: null, notice: result.notice })
        return
      }
      if (result.action === 'strip') {
        if (result.notice?.kind === 'wrong-wallet') trackOnrampEvent('return_rejected:address')
        else trackOnrampEvent('return_rejected:outcome')
        setState({ betIndex: null, notice: result.notice })
        return
      }

      if (result.fundsArrived) trackOnrampEvent('funds_observed')
      setState({
        betIndex: result.betIndex ?? null,
        prefillEth: result.prefillEth,
        fundsArrived: result.fundsArrived,
        notice: result.notice,
      })

      const waitingForFunds =
        !mock && result.fundsArrived !== true && windowMs > 0 && intervalMs > 0
      if (!waitingForFunds) return

      const deadline = Date.now() + windowMs
      while (Date.now() < deadline) {
        await sleep(intervalMs)
        if (cancelled) return
        if (refetchRef.current) {
          spendableNow = await refetchRef.current()
        }
        if (cancelled) return
        result = resolveWith(spendableNow)
        if (result.action !== 'open') return
        setState({
          betIndex: result.betIndex ?? null,
          prefillEth: result.prefillEth,
          fundsArrived: result.fundsArrived,
          notice: result.notice,
        })
        if (result.fundsArrived === true) {
          trackOnrampEvent('funds_observed')
          return
        }
      }
      trackOnrampEvent('poll_timeout')
    })()

    return () => {
      cancelled = true
      if (!handled.current) started.current = false
    }
  }, [
    router,
    router.isReady,
    router.query,
    opts.marketLoading,
    opts.numOutcomes,
    opts.userAddress,
    opts.acceptsBets,
    opts.capEth,
    opts.chainId,
    storedJWT,
    getStoredJWT,
    verifyJWT,
    getAddressFromJWT,
  ])

  return state
}
