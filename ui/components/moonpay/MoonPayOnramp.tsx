import { XMarkIcon } from '@heroicons/react/24/outline'
import Image from 'next/image'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useMoonPay } from '@/lib/privy/hooks/useMoonPay'
import { clearOnrampReturn, setOnrampReturn } from '@/lib/onramp/onrampReturn'
import { LoadingSpinner } from '../layout/LoadingSpinner'
import { PrivyWeb3Button } from '../privy/PrivyWeb3Button'

type FundingState = 'idle' | 'opening' | 'waiting' | 'sufficient'

interface MoonPayOnrampProps {
  address: string
  selectedChain: any
  /** Native token amount to pre-fill in the MoonPay widget */
  ethAmount: number
  onExit?: () => void
  /** Called just before the MoonPay widget opens (e.g. cache form data) */
  onBeforeOpen?: () => Promise<void>
  /** Called when the MoonPay widget closes (purchase submitted, funds in flight) */
  onPurchaseSubmitted?: () => void
  /** When true, stretches to parent width */
  fullWidth?: boolean
  /** When true, drops the outer card chrome so it can be nested inside another card */
  embedded?: boolean
  /** Optional: poll until balance is sufficient, then call onBalanceSufficient */
  checkBalanceSufficient?: () => Promise<boolean>
  onBalanceSufficient?: () => void
  /** Optional: refetch on-chain balance before each poll so newly arrived funds are detected */
  refetchBalance?: () => Promise<void>
  /** Milliseconds between each balance poll. Default: 15000 */
  pollIntervalMs?: number
  /** How long (minutes) to keep polling. Default: 30 */
  pollMaxMinutes?: number
  isWaitingForGasEstimate?: boolean
  /** Optional content rendered just beneath the "Fund Wallet" header */
  headerSlot?: React.ReactNode
}

const POLL_INTERVAL_DEFAULT = 15_000
const POLL_MAX_MINUTES_DEFAULT = 30

export function MoonPayOnramp({
  address,
  selectedChain,
  ethAmount,
  onExit,
  onBeforeOpen,
  onPurchaseSubmitted,
  fullWidth = false,
  embedded = false,
  checkBalanceSufficient,
  onBalanceSufficient,
  refetchBalance,
  pollIntervalMs = POLL_INTERVAL_DEFAULT,
  pollMaxMinutes = POLL_MAX_MINUTES_DEFAULT,
  isWaitingForGasEstimate = false,
  headerSlot,
}: MoonPayOnrampProps) {
  const shellWidthClass = fullWidth ? 'w-full' : 'w-full max-w-md mx-auto'
  // When embedded, render transparent so we blend into the parent card.
  const shellChrome = (accent: 'blue' | 'red') =>
    embedded
      ? 'w-full text-white'
      : `${shellWidthClass} bg-gradient-to-br from-gray-900 ${
          accent === 'red' ? 'via-red-900/30' : 'via-blue-900/30'
        } to-purple-900/20 backdrop-blur-xl border ${
          accent === 'red' ? 'border-red-500/20' : 'border-white/10'
        } rounded-2xl shadow-2xl text-white overflow-hidden`
  const fund = useMoonPay()

  const [fundingState, setFundingState] = useState<FundingState>('idle')
  const [error, setError] = useState<string | null>(null)
  const [pollCount, setPollCount] = useState(0)

  // Display the chain's native token symbol (all supported onramp chains are
  // ETH-native, so this is "ETH" in practice).
  const nativeSymbol: string = useMemo(
    () => selectedChain?.nativeCurrency?.symbol ?? 'ETH',
    [selectedChain]
  )

  const pollTimeoutRef = useRef<NodeJS.Timeout | null>(null)
  const pollStartRef = useRef<number | null>(null)
  const isPollInFlightRef = useRef(false)

  const onBalanceSufficientRef = useRef(onBalanceSufficient)
  useEffect(() => {
    onBalanceSufficientRef.current = onBalanceSufficient
  }, [onBalanceSufficient])

  const checkBalanceSufficientRef = useRef(checkBalanceSufficient)
  useEffect(() => {
    checkBalanceSufficientRef.current = checkBalanceSufficient
  }, [checkBalanceSufficient])

  const refetchBalanceRef = useRef(refetchBalance)
  useEffect(() => {
    refetchBalanceRef.current = refetchBalance
  }, [refetchBalance])

  const stopPolling = useCallback(() => {
    if (pollTimeoutRef.current) {
      clearTimeout(pollTimeoutRef.current)
      pollTimeoutRef.current = null
    }
    isPollInFlightRef.current = false
  }, [])

  // Recursive setTimeout instead of setInterval to prevent overlapping async polls
  const schedulePoll = useCallback(
    (delayMs: number) => {
      pollTimeoutRef.current = setTimeout(async () => {
        if (isPollInFlightRef.current) return
        isPollInFlightRef.current = true

        const elapsed = Date.now() - (pollStartRef.current ?? Date.now())
        const maxMs = pollMaxMinutes * 60 * 1000

        setPollCount((c) => c + 1)

        try {
          // Refetch on-chain balance first so newly arrived funds are seen
          await refetchBalanceRef.current?.()
          const sufficient = await checkBalanceSufficientRef.current?.()
          if (sufficient) {
            stopPolling()
            setFundingState('sufficient')
            onBalanceSufficientRef.current?.()
            return
          }
        } catch {
          // Swallow polling errors — just keep trying
        }

        isPollInFlightRef.current = false

        if (elapsed >= maxMs) {
          stopPolling()
          setError(
            `Funds haven't arrived after ${pollMaxMinutes} minutes. Please check your MoonPay email for status and try again.`
          )
          return
        }

        // Schedule the next poll only after this one finishes
        schedulePoll(pollIntervalMs)
      }, delayMs)
    },
    [pollIntervalMs, pollMaxMinutes, stopPolling]
  )

  const startPolling = useCallback(() => {
    if (!checkBalanceSufficientRef.current) return
    stopPolling()
    pollStartRef.current = Date.now()
    setPollCount(0)
    schedulePoll(pollIntervalMs)
  }, [pollIntervalMs, schedulePoll, stopPolling])

  useEffect(() => () => stopPolling(), [stopPolling])

  const handleFund = useCallback(async () => {
    if (!address) {
      setError('Wallet address required')
      return
    }

    try {
      setError(null)
      setFundingState('opening')

      if (onBeforeOpen) {
        await onBeforeOpen()
      }

      // Privy's fiat onramp pre-fills a FIAT (USD) amount, not a token amount.
      // Convert the native-token deficit to USD (with a small buffer for fees and
      // price drift) so the purchase covers the amount the user actually needs.
      // All supported onramp chains are ETH-native, so the ETH spot price applies.
      let fiatAmount: number | undefined
      if (ethAmount > 0) {
        try {
          const res = await fetch('/api/coinbase/eth-price')
          if (res.ok) {
            const { price } = await res.json()
            if (price > 0) {
              fiatAmount = Math.ceil(ethAmount * price * 1.05)
            }
          }
        } catch {
          // Price lookup failed — fall back to letting the user enter the amount.
        }
      }

      // Remember where we are before opening the widget. The provider's KYC /
      // 3-D Secure step can perform a top-level redirect (Privy's in-app onramp
      // has no return-URL option), which would otherwise drop the user on the
      // site root. The breadcrumb lets us send them back here on the next load.
      setOnrampReturn()

      // fund() opens Privy's in-app modal and resolves once the user finishes (or
      // exits) the flow. It rejects if the user closes the modal before submitting.
      const result = await fund(fiatAmount, selectedChain?.id)

      // Resolved in-context (no redirect happened) — the breadcrumb isn't needed.
      clearOnrampReturn()

      setFundingState('waiting')
      onPurchaseSubmitted?.()

      // If Privy already confirmed delivery, the balance poll will pick it up on
      // its first tick. Otherwise we keep polling until funds arrive.
      if (checkBalanceSufficient) {
        startPolling()
      } else if (result?.status === 'confirmed') {
        setFundingState('sufficient')
      }
    } catch (err: any) {
      // A rejection most often means the user closed the funding modal before
      // submitting — treat that as a quiet cancel rather than a hard error.
      const message: string = err?.message ?? ''
      const userCancelled = /exit|close|cancel|dismiss/i.test(message)
      clearOnrampReturn()
      setFundingState('idle')
      if (!userCancelled) {
        setError('Failed to open the funding flow: ' + (message || 'Unknown error'))
      }
    }
  }, [
    address,
    ethAmount,
    selectedChain,
    onBeforeOpen,
    onPurchaseSubmitted,
    fund,
    checkBalanceSufficient,
    startPolling,
  ])

  const handleExit = useCallback(() => {
    stopPolling()
    clearOnrampReturn()
    setFundingState('idle')
    onExit?.()
  }, [stopPolling, onExit])

  if (error) {
    return (
      <div className={shellChrome('red')}>
        <div className="flex items-center justify-between p-6 border-b border-red-500/20">
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 rounded-full bg-red-500/20 flex items-center justify-center">
              <svg className="w-6 h-6 text-red-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L3.732 16.5c-.77.833.192 2.5 1.732 2.5z" />
              </svg>
            </div>
            <h3 className="text-lg font-semibold text-red-400">Error</h3>
          </div>
          <button
            onClick={() => { setError(null); setFundingState('idle'); onExit?.() }}
            className="p-2 hover:bg-white/10 rounded-full transition-colors duration-200"
          >
            <XMarkIcon className="h-5 w-5 text-gray-300 hover:text-white" />
          </button>
        </div>
        <div className="p-6">
          <p className="text-gray-300 text-sm text-center">{error}</p>
          <button
            onClick={() => { setError(null); setFundingState('idle') }}
            className="mt-4 w-full px-4 py-2 bg-gradient-to-r from-blue-500 to-purple-600 hover:from-blue-600 hover:to-purple-700 text-white rounded-lg font-medium transition-all duration-200"
          >
            Try Again
          </button>
        </div>
      </div>
    )
  }

  if (fundingState === 'waiting') {
    return (
      <div className={shellChrome('blue')}>
        <div className="flex items-center justify-between p-6 border-b border-white/10">
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 rounded-full bg-gradient-to-r from-blue-500 to-purple-600 flex items-center justify-center">
              <Image src="/coins/ETH.svg" alt={nativeSymbol} width={20} height={20} className="w-6 h-6" />
            </div>
            <div>
              <h2 className="text-lg font-semibold text-white">MoonPay Processing</h2>
              <p className="text-gray-400 text-xs">Waiting for {nativeSymbol} to arrive</p>
            </div>
          </div>
          <button onClick={handleExit} className="p-2 hover:bg-white/10 rounded-full transition-colors duration-200">
            <XMarkIcon className="h-5 w-5 text-gray-300 hover:text-white" />
          </button>
        </div>

        <div className="p-6 space-y-5">
          <div className="bg-blue-500/10 border border-blue-400/30 rounded-lg p-4">
            <div className="flex items-start gap-3">
              <div className="flex-shrink-0 mt-0.5">
                <LoadingSpinner />
              </div>
              <div className="flex-1">
                <p className="text-blue-200 font-semibold text-sm mb-1">
                  Your purchase is being processed
                </p>
                <p className="text-blue-100/80 text-xs leading-relaxed">
                  MoonPay typically delivers {nativeSymbol} within <strong>5–30 minutes</strong>. Once your funds arrive, your transaction will proceed automatically.
                </p>
                {checkBalanceSufficient && (
                  <p className="text-blue-100/60 text-xs mt-2">
                    Checking balance{pollCount > 0 ? ` (check ${pollCount})` : ''}…
                  </p>
                )}
              </div>
            </div>
          </div>

          <div className="bg-emerald-500/10 border border-emerald-400/30 rounded-lg p-4">
            <div className="flex items-start gap-3">
              <svg className="w-4 h-4 text-emerald-300 mt-0.5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <p className="text-emerald-100/80 text-xs leading-relaxed">
                You'll receive an email from MoonPay with your purchase status. You can safely leave this page and return once funds have arrived.
              </p>
            </div>
          </div>

          {!checkBalanceSufficient && (
            <button
              onClick={handleExit}
              className="w-full px-4 py-3 bg-white/5 hover:bg-white/10 border border-white/10 text-white rounded-lg font-medium transition-all duration-200 text-sm"
            >
              Done
            </button>
          )}
        </div>
      </div>
    )
  }

  return (
    <div className={shellChrome('blue')}>
      {/* Header */}
      <div className="flex items-center justify-between p-6 border-b border-white/10">
        <div className="flex items-center space-x-3">
          <div className="w-10 h-10 rounded-full bg-gradient-to-r from-blue-500 to-purple-600 flex items-center justify-center">
            <Image src="/coins/ETH.svg" alt={nativeSymbol} width={20} height={20} className="w-6 h-6" />
          </div>
          <div>
            <h2 className="text-lg font-semibold text-white">Fund Wallet</h2>
          </div>
        </div>
        <button
          onClick={handleExit}
          className="p-2 hover:bg-white/10 rounded-full transition-colors duration-200"
        >
          <XMarkIcon className="h-5 w-5 text-gray-300 hover:text-white" />
        </button>
      </div>

      {headerSlot}

      <div className="p-6 space-y-6">
        {/* Amount summary */}
        <div className="bg-black/20 rounded-lg p-4 border border-white/5 space-y-3">
          {isWaitingForGasEstimate ? (
            <div className="flex items-center justify-center">
              <LoadingSpinner />
              <span className="ml-2 text-gray-400 text-sm">Estimating amount…</span>
            </div>
          ) : (
            <>
              <div className="flex items-center justify-between">
                <span className="text-gray-400 text-sm">Network:</span>
                <span className="text-white font-medium">{selectedChain?.name || 'Arbitrum'}</span>
              </div>
              {ethAmount > 0 && (
                <div className="flex items-center justify-between">
                  <span className="text-gray-400 text-sm">Amount needed:</span>
                  <span className="text-white font-medium">{ethAmount.toFixed(4)} {nativeSymbol}</span>
                </div>
              )}
            </>
          )}
        </div>

        {/* MoonPay tip */}
        <div className="bg-emerald-500/10 border border-emerald-400/30 rounded-lg p-4">
          <div className="flex items-start gap-3">
            <div className="flex-shrink-0 w-6 h-6 bg-emerald-500/20 rounded-full flex items-center justify-center mt-0.5">
              <svg className="w-3.5 h-3.5 text-emerald-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
              </svg>
            </div>
            <div className="flex-1">
              <p className="text-emerald-200 font-semibold text-sm mb-1">
                Pay by card or bank transfer
              </p>
              <p className="text-emerald-100/80 text-xs leading-relaxed">
                MoonPay supports debit &amp; credit cards, Apple Pay, Google Pay, and bank transfers. Funds typically arrive within 5–30 minutes.
              </p>
            </div>
          </div>
        </div>

        {/* Buy button */}
        <PrivyWeb3Button
          label={
            fundingState === 'opening'
              ? 'Opening MoonPay…'
              : ethAmount > 0
              ? `Buy ${ethAmount.toFixed(4)} ${nativeSymbol} with MoonPay`
              : `Buy ${nativeSymbol} with MoonPay`
          }
          showSignInLabel={false}
          action={handleFund}
          className="w-full bg-gradient-to-r from-indigo-500 to-purple-600 hover:from-indigo-600 hover:to-purple-700 text-white py-4 px-6 rounded-lg font-semibold transition-all duration-200 transform hover:scale-105 shadow-lg disabled:opacity-50 disabled:cursor-not-allowed disabled:transform-none"
          skipNetworkCheck={true}
          isDisabled={fundingState === 'opening' || isWaitingForGasEstimate}
        />

        {fundingState === 'opening' && (
          <div className="flex items-center justify-center space-x-2 text-gray-400">
            <LoadingSpinner />
            <span className="text-sm">Opening MoonPay widget…</span>
          </div>
        )}

        {/* Secured by MoonPay */}
        <div className="bg-black/10 rounded-lg p-4 border border-white/5">
          <div className="flex items-center justify-center space-x-2 text-gray-400 mb-2">
            <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M5 9V7a5 5 0 0110 0v2a2 2 0 012 2v5a2 2 0 01-2 2H5a2 2 0 01-2-2v-5a2 2 0 012-2zm8-2v2H7V7a3 3 0 016 0z" clipRule="evenodd" />
            </svg>
            <span className="text-xs font-medium uppercase tracking-wide">Powered by MoonPay</span>
          </div>
          <p className="text-gray-300 text-xs text-center leading-relaxed">
            MoonPay is a trusted fiat-to-crypto gateway used by millions worldwide.
          </p>
        </div>
      </div>
    </div>
  )
}
