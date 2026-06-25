import { getAccessToken } from '@privy-io/react-auth'
import { useCallback, useEffect, useRef, useState } from 'react'
import type { SwapTokenKey } from '@/lib/privy/swapTokens'

// Client-side lifecycle for a single Privy swap: fetch a quote, execute after
// the user confirms, then poll the wallet action until it reaches a terminal
// state. All Privy API access happens server-side behind /api/privy/swap/*.

export type SwapPhase =
  | 'idle'
  | 'quoting'
  | 'quoted'
  | 'executing'
  | 'pending'
  | 'succeeded'
  | 'failed'
  | 'rejected'
  | 'error'

export interface SwapQuote {
  fromToken: SwapTokenKey
  toToken: SwapTokenKey
  inputDecimals: number
  outputDecimals: number
  inputAmount: string | null
  estOutputAmount: string | null
  minimumOutputAmount: string | null
  gasEstimate: string | null
  caip2: string | null
  expiresAt: number | null
  chainId: number
}

export interface QuoteParams {
  address: string
  fromToken: SwapTokenKey
  toToken: SwapTokenKey
  amount: string
  chainId: number
}

export interface ExecuteParams extends QuoteParams {
  slippageBps: number
}

const TERMINAL_PHASES: SwapPhase[] = ['succeeded', 'failed', 'rejected']
const POLL_INTERVAL_MS = 3000
const POLL_TIMEOUT_MS = 3 * 60 * 1000

async function authedFetch(url: string, init?: RequestInit) {
  const accessToken = await getAccessToken()
  if (!accessToken) {
    throw new Error('You must be signed in to swap.')
  }
  const res = await fetch(url, {
    ...init,
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${accessToken}`,
      ...(init?.headers || {}),
    },
  })
  let data: any = null
  try {
    data = await res.json()
  } catch {
    data = null
  }
  if (!res.ok) {
    throw new Error(data?.error || 'Request failed. Please try again.')
  }
  return data
}

export function usePrivySwap() {
  const [phase, setPhase] = useState<SwapPhase>('idle')
  const [quote, setQuote] = useState<SwapQuote | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [failureReason, setFailureReason] = useState<string | null>(null)
  const [actionId, setActionId] = useState<string | null>(null)

  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const pollDeadlineRef = useRef<number>(0)
  const idempotencyKeyRef = useRef<string | null>(null)
  const mountedRef = useRef(true)

  const clearPoll = useCallback(() => {
    if (pollRef.current) {
      clearInterval(pollRef.current)
      pollRef.current = null
    }
  }, [])

  useEffect(() => {
    mountedRef.current = true
    return () => {
      mountedRef.current = false
      clearPoll()
    }
  }, [clearPoll])

  const reset = useCallback(() => {
    clearPoll()
    idempotencyKeyRef.current = null
    setPhase('idle')
    setQuote(null)
    setError(null)
    setFailureReason(null)
    setActionId(null)
  }, [clearPoll])

  const fetchQuote = useCallback(async (params: QuoteParams) => {
    setError(null)
    setFailureReason(null)
    setPhase('quoting')
    try {
      const data = await authedFetch('/api/privy/swap/quote', {
        method: 'POST',
        body: JSON.stringify(params),
      })
      if (!mountedRef.current) return null
      setQuote(data.quote as SwapQuote)
      setPhase('quoted')
      return data.quote as SwapQuote
    } catch (err: any) {
      if (!mountedRef.current) return null
      setError(err?.message || 'Could not fetch a quote.')
      setPhase('error')
      return null
    }
  }, [])

  const startPolling = useCallback(
    (address: string, id: string) => {
      clearPoll()
      pollDeadlineRef.current = Date.now() + POLL_TIMEOUT_MS

      const poll = async () => {
        try {
          const data = await authedFetch(
            `/api/privy/swap/action/${encodeURIComponent(id)}?address=${encodeURIComponent(
              address
            )}`
          )
          if (!mountedRef.current) return
          const status = data.status as SwapPhase
          if (status === 'succeeded' || status === 'failed' || status === 'rejected') {
            clearPoll()
            if (data.failureReason) setFailureReason(data.failureReason)
            setPhase(status)
            return
          }
          // 'created' / 'pending' → keep waiting.
          if (Date.now() > pollDeadlineRef.current) {
            clearPoll()
            setPhase('pending')
            setError(
              'This swap is taking longer than expected. Your balances may update in a few minutes.'
            )
          }
        } catch (err: any) {
          // Transient polling errors shouldn't kill the flow; stop only on timeout.
          if (Date.now() > pollDeadlineRef.current) {
            clearPoll()
            setPhase('pending')
            setError(err?.message || 'Lost track of the swap status.')
          }
        }
      }

      pollRef.current = setInterval(poll, POLL_INTERVAL_MS)
      // Kick off an immediate poll so the user isn't waiting a full interval.
      poll()
    },
    [clearPoll]
  )

  const executeSwap = useCallback(
    async (params: ExecuteParams) => {
      setError(null)
      setFailureReason(null)
      setPhase('executing')

      // Stable idempotency key per confirmed swap so accidental double-submits
      // (or retries) don't create two swaps.
      if (!idempotencyKeyRef.current) {
        idempotencyKeyRef.current =
          typeof crypto !== 'undefined' && 'randomUUID' in crypto
            ? crypto.randomUUID()
            : `${Date.now()}-${Math.random().toString(36).slice(2)}`
      }

      try {
        const data = await authedFetch('/api/privy/swap/execute', {
          method: 'POST',
          body: JSON.stringify({
            ...params,
            idempotencyKey: idempotencyKeyRef.current,
          }),
        })
        if (!mountedRef.current) return null
        setActionId(data.actionId)
        setPhase('pending')
        startPolling(params.address, data.actionId)
        return data.actionId as string
      } catch (err: any) {
        if (!mountedRef.current) return null
        setError(err?.message || 'Could not start the swap.')
        setPhase('error')
        return null
      }
    },
    [startPolling]
  )

  return {
    phase,
    quote,
    error,
    failureReason,
    actionId,
    isTerminal: TERMINAL_PHASES.includes(phase),
    fetchQuote,
    executeSwap,
    reset,
  }
}
