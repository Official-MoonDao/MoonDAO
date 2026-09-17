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
  const { verifyJWT, getStoredJWT, storedJWT } = useOnrampJWT(DEPRIZE_ONRAMP_JWT_KEY)
  const [state, setState] = useState<OnrampReturnState>({ betIndex: null })
  const handled = useRef(false)
  const walletWaitStarted = useRef<number | null>(null)

  useEffect(() => {
    if (!router.isReady || opts.marketLoading || opts.numOutcomes <= 0) return
    if (handled.current) return

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

    handled.current = true
    trackOnrampEvent('return_received')

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
        const payload = await verifyJWT(token, opts.userAddress, undefined, 'deprize')
        jwtVerified = !!payload
        jwtAddress = payload?.address
        jwtIssuedAtMs = payload?.timestamp
        const snap = readOnrampSnapshot(jwtSnapshotId(token))
        jwtConsumed = snap?.consumed === true
      }

      const snapshot = token ? readOnrampSnapshot(jwtSnapshotId(token)) : null
      const result = resolveOnrampReturn({
        parsed: parsed.active
          ? parsed
          : { active: true, outcomeIndex: 0 },
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
                : opts.spendableEthNow,
        capEth: opts.capEth,
      })

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
    })()
  }, [
    router,
    router.isReady,
    router.query,
    opts.marketLoading,
    opts.numOutcomes,
    opts.userAddress,
    opts.acceptsBets,
    opts.spendableEthNow,
    opts.capEth,
    storedJWT,
    getStoredJWT,
    verifyJWT,
  ])

  return state
}
