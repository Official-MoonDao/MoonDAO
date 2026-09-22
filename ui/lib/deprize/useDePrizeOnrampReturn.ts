import { useRouter } from 'next/router'
import { useEffect, useRef, useState } from 'react'
import useOnrampJWT from '@/lib/coinbase/useOnrampJWT'
import { DEPRIZE_ONRAMP_JWT_KEY, JWT_FRESHNESS_MS, WALLET_WAIT_MS } from './fundingStrategy'
import {
  jwtSnapshotId,
  markOnrampSnapshotConsumed,
  mockOnrampEnabled,
  parseMockOnrampScenario,
  parseOnrampReturn,
  readOnrampSnapshot,
} from './onrampReturn'
import { trackOnrampEvent } from './onrampTelemetryClient'
import { resolveOnrampReturn, type ReturnNotice } from './resolveOnrampReturn'

const VERIFY_RETRY_MS = 2500
const VERIFY_RETRY_LIMIT = 5

export type OnrampReturnState = {
  betIndex: number | null
  prefillEth?: string
  fundsArrived?: boolean
  notice?: ReturnNotice
}

function stripOnrampParams(router: ReturnType<typeof useRouter>) {
  const rest = { ...router.query }
  delete rest.onrampSuccess
  delete rest.outcome
  delete rest.amount
  delete rest.mockOnramp
  router.replace({ pathname: router.pathname, query: rest }, undefined, { shallow: true })
}

function readDeprizeOnrampToken(
  storedJWT: string | null,
  getStoredJWT: () => string | null
): string | null {
  return (
    storedJWT ||
    getStoredJWT() ||
    (typeof window !== 'undefined' ? window.localStorage.getItem(DEPRIZE_ONRAMP_JWT_KEY) : null)
  )
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
}): OnrampReturnState {
  const router = useRouter()
  const { verifyJWT, getStoredJWT, getAddressFromJWT, storedJWT } = useOnrampJWT(
    DEPRIZE_ONRAMP_JWT_KEY
  )
  const [state, setState] = useState<OnrampReturnState>({ betIndex: null })
  const [verifyAttempt, setVerifyAttempt] = useState(0)
  const handled = useRef(false)
  const walletWaitStarted = useRef<number | null>(null)
  const walletSeen = useRef(false)
  const returnTracked = useRef(false)
  const wrongWalletTracked = useRef<string | null>(null)
  const verifyFailures = useRef(0)
  const lastAddress = useRef<string | undefined>(undefined)
  const optsRef = useRef(opts)
  const routerRef = useRef(router)
  optsRef.current = opts
  routerRef.current = router
  if (lastAddress.current !== opts.userAddress) {
    lastAddress.current = opts.userAddress
    verifyFailures.current = 0
  }

  const onrampQueryKey = [
    router.query.onrampSuccess,
    router.query.outcome,
    router.query.amount,
    router.query.mockOnramp,
  ].join('|')

  useEffect(() => {
    const live = optsRef.current
    const liveRouter = routerRef.current
    if (!liveRouter.isReady || live.marketLoading || live.numOutcomes <= 0) return
    if (handled.current) return

    const parsed = parseOnrampReturn(liveRouter.query)
    const mock = mockOnrampEnabled() ? parseMockOnrampScenario(liveRouter.query) : null
    if (!parsed.active && !mock) return

    const userAddress = live.userAddress
    if (!userAddress) {
      // The timeout is only for the first hydration. A later disconnect is how
      // Privy switches wallets, and consuming the return here drops the hold.
      if (walletSeen.current) return
      if (walletWaitStarted.current == null) walletWaitStarted.current = Date.now()
      const remaining = WALLET_WAIT_MS - (Date.now() - walletWaitStarted.current)
      if (remaining > 0) {
        const waitTimer = setTimeout(() => setVerifyAttempt((n) => n + 1), remaining)
        return () => clearTimeout(waitTimer)
      }
      handled.current = true
      stripOnrampParams(liveRouter)
      setState({
        betIndex: null,
        notice: { kind: 'connect-wallet' },
      })
      return
    }

    walletSeen.current = true
    walletWaitStarted.current = null

    if (!returnTracked.current) {
      returnTracked.current = true
      trackOnrampEvent('return_received')
    }

    const token = mock ? null : readDeprizeOnrampToken(storedJWT, getStoredJWT)
    const fundedHint = token ? getAddressFromJWT(token) : null
    if (fundedHint && fundedHint.toLowerCase() !== userAddress.toLowerCase()) {
      // Privy often reconnects a different wallet. Keep the URL and snapshot
      // so switching to the funded address can still open the bet.
      if (wrongWalletTracked.current !== fundedHint.toLowerCase()) {
        wrongWalletTracked.current = fundedHint.toLowerCase()
        trackOnrampEvent('return_rejected:address')
      }
      setState({
        betIndex: null,
        notice: { kind: 'wrong-wallet', fundedAddress: fundedHint },
      })
      return
    }

    let cancelled = false
    const timer: { id?: ReturnType<typeof setTimeout> } = {}

    ;(async () => {
      const current = optsRef.current
      let jwtVerified = false
      let jwtAddress: string | undefined
      let jwtIssuedAtMs: number | undefined
      let jwtConsumed = false
      let verifyUnavailable = false

      if (mock) {
        jwtVerified = mock !== 'stale'
        jwtAddress = current.userAddress
        jwtIssuedAtMs = mock === 'stale' ? Date.now() - JWT_FRESHNESS_MS - 1 : Date.now()
      } else if (token) {
        try {
          const payload = await verifyJWT(
            token,
            fundedHint || userAddress,
            undefined,
            'deprize'
          )
          jwtVerified = !!payload
          jwtAddress = payload?.address
          // Signer stores `timestamp` in seconds. Freshness is measured in ms.
          jwtIssuedAtMs = payload?.timestamp != null ? payload.timestamp * 1000 : undefined
          const snap = readOnrampSnapshot(jwtSnapshotId(token))
          jwtConsumed = snap?.consumed === true
        } catch {
          verifyUnavailable = true
        }
      }

      if (cancelled) return

      if (verifyUnavailable) {
        verifyFailures.current += 1
        if (verifyFailures.current <= VERIFY_RETRY_LIMIT) {
          timer.id = setTimeout(() => {
            if (!cancelled) setVerifyAttempt((n) => n + 1)
          }, VERIFY_RETRY_MS)
        }
        return
      }

      const settled = optsRef.current
      const snapshot = token ? readOnrampSnapshot(jwtSnapshotId(token)) : null
      const result = resolveOnrampReturn({
        parsed: parsed.active ? parsed : { active: true, outcomeIndex: 0 },
        jwtVerified: mock === 'closed' ? true : jwtVerified,
        jwtAddress,
        jwtIssuedAtMs,
        jwtConsumed,
        nowMs: Date.now(),
        userAddress: settled.userAddress,
        numOutcomes: settled.numOutcomes,
        marketAcceptsBets: mock === 'closed' ? false : settled.acceptsBets,
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
                : settled.spendableEthNow,
        capEth: settled.capEth,
      })

      if (cancelled) return

      if (result.action === 'hold') {
        const funded = result.notice?.kind === 'wrong-wallet' ? result.notice.fundedAddress : ''
        if (funded && wrongWalletTracked.current !== funded.toLowerCase()) {
          wrongWalletTracked.current = funded.toLowerCase()
          trackOnrampEvent('return_rejected:address')
        }
        setState({ betIndex: null, notice: result.notice })
        return
      }

      handled.current = true
      if (token) markOnrampSnapshotConsumed(jwtSnapshotId(token))
      stripOnrampParams(routerRef.current)

      if (result.action === 'ignore') {
        if (!jwtVerified) trackOnrampEvent('return_rejected:no_jwt')
        else if (result.notice?.kind === 'market-closed') {
          trackOnrampEvent('return_rejected:market_closed')
        } else if (jwtConsumed) trackOnrampEvent('return_rejected:consumed')
        setState({ betIndex: null, notice: result.notice })
        return
      }
      if (result.action === 'strip') {
        trackOnrampEvent('return_rejected:outcome')
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
    })()

    return () => {
      cancelled = true
      if (timer.id !== undefined) clearTimeout(timer.id)
    }
  }, [
    onrampQueryKey,
    router.isReady,
    opts.marketLoading,
    opts.numOutcomes,
    opts.userAddress,
    opts.acceptsBets,
    storedJWT,
    getStoredJWT,
    getAddressFromJWT,
    verifyJWT,
    verifyAttempt,
  ])

  return state
}
