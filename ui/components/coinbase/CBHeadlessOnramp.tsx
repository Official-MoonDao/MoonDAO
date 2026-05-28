import { usePrivy } from '@privy-io/react-auth'
import { XMarkIcon } from '@heroicons/react/24/outline'
import { DEPLOYED_ORIGIN } from 'const/config'
import Image from 'next/image'
import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react'
import { arbitrum } from '@/lib/rpc/chains'
import { LoadingSpinner } from '../layout/LoadingSpinner'
import { PrivyWeb3Button } from '../privy/PrivyWeb3Button'
import { CoinbaseQuoteUnavailableGuide } from './CoinbaseQuoteUnavailableGuide'
import {
  LARGE_ONRAMP_FIAT_THRESHOLD_USD,
  LargeAmountExchangeOnrampNotice,
} from './LargeAmountExchangeOnrampNotice'
import usePhoneVerification from '@/lib/coinbase/usePhoneVerification'
import {
  type HeadlessStatus,
  getQuoteNetworkName,
  getOnrampNetworkName,
  parseOnrampMessage,
  mapOnrampEvent,
} from '@/lib/coinbase/headlessEvents'

interface CBHeadlessOnrampProps {
  address: string
  selectedChain: any
  ethAmount: number
  /** Unique per-user identifier sent to Coinbase as partnerUserRef */
  partnerUserRef: string
  onExit?: () => void
  /** Called before the order is created (e.g. generate the resume-JWT) */
  onBeforeNavigate?: () => Promise<void>
  /** Called once Coinbase emits onramp_api.polling_success */
  onPaymentSuccess?: () => void | Promise<void>
  isWaitingForGasEstimate?: boolean
  allowAmountInput?: boolean
  onQuoteCalculated?: (
    ethAmount: number,
    paymentSubtotal: number,
    paymentTotal: number,
    totalFees: number
  ) => void
  fullWidth?: boolean
}

const MOCK_ONRAMP = process.env.NEXT_PUBLIC_MOCK_ONRAMP === 'true'

export const CBHeadlessOnramp: React.FC<CBHeadlessOnrampProps> = ({
  address,
  selectedChain,
  ethAmount,
  partnerUserRef,
  onExit,
  onBeforeNavigate,
  onPaymentSuccess,
  isWaitingForGasEstimate = false,
  allowAmountInput = false,
  onQuoteCalculated,
  fullWidth = false,
}) => {
  const shellWidthClass = fullWidth ? 'w-full' : 'w-full max-w-md mx-auto'
  const { user } = usePrivy()
  const userEmail = user?.email?.address || user?.google?.email || null

  const {
    phoneNumber,
    isLinked: hasPhone,
    isStale: phoneStale,
    verifiedAt: phoneVerifiedAt,
    requestVerification,
    refreshVerification,
  } = usePhoneVerification()

  const [isLoadingQuote, setIsLoadingQuote] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [errorCode, setErrorCode] = useState<string | null>(null)
  const [showExchangeFundingGuide, setShowExchangeFundingGuide] = useState(false)
  const [status, setStatus] = useState<HeadlessStatus>('idle')
  const [paymentLinkUrl, setPaymentLinkUrl] = useState<string | null>(null)
  const [quoteData, setQuoteData] = useState<{
    ethAmount: number
    purchaseAmount: number
    totalAmount: number
    fees: number
    quoteId?: string | null
  } | null>(null)

  const [inputAmount, setInputAmount] = useState(ethAmount)
  const [inputAmountString, setInputAmountString] = useState(
    ethAmount > 0 ? ethAmount.toString() : ''
  )
  const [debouncedEthAmount, setDebouncedEthAmount] = useState(ethAmount)

  const iframeRef = useRef<HTMLIFrameElement | null>(null)

  // Track latest status in a ref so the postMessage listener can read it
  // without re-subscribing on every status change.
  const statusRef = useRef<HeadlessStatus>(status)
  useEffect(() => {
    statusRef.current = status
  }, [status])

  useEffect(() => {
    if (!allowAmountInput) {
      setInputAmount(ethAmount)
      setInputAmountString(ethAmount > 0 ? ethAmount.toString() : '')
    }
  }, [ethAmount, allowAmountInput])

  const isArbitrum = useMemo(
    () =>
      selectedChain === arbitrum ||
      selectedChain?.id === 42161 ||
      selectedChain?.id === 421614,
    [selectedChain]
  )

  const effectiveAmount = allowAmountInput ? inputAmount : ethAmount

  useEffect(() => {
    const timeoutId = setTimeout(() => {
      setDebouncedEthAmount(effectiveAmount)
    }, 800)
    return () => clearTimeout(timeoutId)
  }, [effectiveAmount])

  // ---------------------------------------------------------------------------
  // Quote fetching (reuses the existing /api/coinbase/buy-quote endpoint).
  // We only need a quote to preview ETH amount/fees + grab quoteId for the
  // create-order call.
  // ---------------------------------------------------------------------------
  useEffect(() => {
    const fetchQuote = async () => {
      if (!address || !debouncedEthAmount || debouncedEthAmount <= 0) {
        setIsLoadingQuote(false)
        return
      }
      if (isWaitingForGasEstimate) {
        setIsLoadingQuote(true)
        return
      }
      setError(null)
      setErrorCode(null)
      setShowExchangeFundingGuide(false)
      setIsLoadingQuote(true)

      try {
        const quoteNetwork = isArbitrum
          ? 'ethereum'
          : getQuoteNetworkName(selectedChain)

        const priceResponse = await fetch('/api/coinbase/eth-price')
        if (!priceResponse.ok) {
          throw new Error('Failed to fetch ETH price')
        }
        const priceData = await priceResponse.json()
        const spotPrice = priceData.price
        const initialEstimateUSD = debouncedEthAmount * spotPrice * 1.05

        const response = await fetch('/api/coinbase/buy-quote', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include',
          body: JSON.stringify({
            paymentAmount: initialEstimateUSD,
            destinationAddress: address,
            purchaseNetwork: quoteNetwork,
            purchaseCurrency: 'ETH',
            paymentMethod: 'APPLE_PAY',
          }),
        })

        if (!response.ok) {
          if (response.status === 400) {
            setShowExchangeFundingGuide(true)
          } else {
            setError('Unable to get quote from Coinbase. Please try again.')
          }
          setIsLoadingQuote(false)
          onQuoteCalculated?.(0, 0, 0, 0)
          return
        }

        const data = await response.json()
        const quote = data.quote
        if (!quote) {
          setError('Invalid quote response from Coinbase')
          setIsLoadingQuote(false)
          return
        }

        const receivedEth = parseFloat(quote?.purchase_amount?.value || '0')
        const subtotal = parseFloat(quote?.payment_subtotal?.value || '0')
        const total = parseFloat(quote?.payment_total?.value || '0')
        const quoteId = quote?.quote_id || null
        const fees = total - subtotal

        if (receivedEth > 0 && total > 0) {
          setQuoteData({
            ethAmount: receivedEth,
            purchaseAmount: total,
            totalAmount: total,
            fees,
            quoteId,
          })
          onQuoteCalculated?.(receivedEth, subtotal, total, fees)
        } else {
          onQuoteCalculated?.(0, 0, 0, 0)
          setError('Invalid final quote data from Coinbase')
        }
      } catch (err: any) {
        console.error('[CBHeadlessOnramp] quote error:', err)
        setError('Failed to fetch quote from Coinbase. Please try again.')
        onQuoteCalculated?.(0, 0, 0, 0)
      } finally {
        setIsLoadingQuote(false)
      }
    }
    fetchQuote()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    address,
    debouncedEthAmount,
    selectedChain,
    isArbitrum,
    isWaitingForGasEstimate,
    onQuoteCalculated,
  ])

  // ---------------------------------------------------------------------------
  // Post-message listener for the embedded payment-link iframe.
  // Docs: onramp_api.{load_pending,load_success,load_error,commit_success,
  //                  commit_error,cancel,polling_start,polling_success,polling_error}
  // ---------------------------------------------------------------------------
  useEffect(() => {
    if (!paymentLinkUrl) return
    const handler = (event: MessageEvent) => {
      // We can't always pin to a Coinbase origin (sandbox uses different host),
      // so we parse defensively and only act on well-formed onramp_api.* messages.
      const parsed = parseOnrampMessage(event.data)
      const result = mapOnrampEvent(parsed, statusRef.current)
      if (result.ignored) return

      if (result.status) setStatus(result.status)
      if (result.error !== undefined) setError(result.error)
      if (result.errorCode !== undefined) setErrorCode(result.errorCode)
      if (result.fireSuccess) {
        // Fire the in-page success callback immediately. Consumers should
        // either run their on-chain transaction directly or rely on the
        // useOnrampAutoTransaction hook (the modal forwards this through).
        Promise.resolve(onPaymentSuccess?.()).catch((err) =>
          console.error('[CBHeadlessOnramp] onPaymentSuccess threw', err)
        )
      }
    }
    window.addEventListener('message', handler)
    return () => window.removeEventListener('message', handler)
  }, [paymentLinkUrl, onPaymentSuccess])

  // ---------------------------------------------------------------------------
  // Create the order + render the iframe.
  // ---------------------------------------------------------------------------
  const handleStartHeadlessPayment = useCallback(async () => {
    if (!address) {
      setError('Wallet address required')
      return
    }
    if (!userEmail) {
      setError(
        'A verified email is required. Please link an email to your account first.'
      )
      return
    }
    if (!hasPhone) {
      setError('A verified US phone number is required.')
      return
    }
    if (phoneStale) {
      setError(
        'Your phone verification is older than 60 days. Please re-verify your number to continue.'
      )
      return
    }
    if (!quoteData?.purchaseAmount) {
      setError('Please wait for the quote to load.')
      return
    }

    try {
      setStatus('creating')
      setError(null)
      setErrorCode(null)

      if (onBeforeNavigate) {
        try {
          await onBeforeNavigate()
          // Allow any localStorage writes (e.g. the resume-JWT) to flush.
          await new Promise((r) => setTimeout(r, 100))
        } catch (err) {
          console.error('[CBHeadlessOnramp] onBeforeNavigate failed', err)
        }
      }

      const response = await fetch('/api/coinbase/create-order', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          paymentAmount: quoteData.purchaseAmount,
          destinationAddress: address,
          email: userEmail,
          phoneNumber,
          phoneNumberVerifiedAt: phoneVerifiedAt?.toISOString(),
          partnerUserRef,
          purchaseCurrency: 'ETH',
          destinationNetwork: getOnrampNetworkName(selectedChain),
          paymentCurrency: 'USD',
          paymentMethod: 'GUEST_CHECKOUT_APPLE_PAY',
          domain: DEPLOYED_ORIGIN.replace(/^https?:\/\//, ''),
          agreementAcceptedAt: new Date().toISOString(),
        }),
      })

      if (!response.ok) {
        const data = await response.json().catch(() => ({}))
        setStatus('error')
        setError(
          data?.error ||
            'Failed to create Coinbase payment. Please try again later.'
        )
        return
      }

      const data = await response.json()
      if (!data?.paymentLinkUrl) {
        setStatus('error')
        setError('Coinbase did not return a payment link. Please try again.')
        return
      }

      setPaymentLinkUrl(data.paymentLinkUrl)
      setStatus('iframe-loading')
    } catch (err: any) {
      console.error('[CBHeadlessOnramp] create-order failed', err)
      setStatus('error')
      setError(err?.message || 'Failed to initialize Coinbase payment.')
    }
  }, [
    address,
    userEmail,
    hasPhone,
    phoneStale,
    quoteData,
    onBeforeNavigate,
    phoneNumber,
    phoneVerifiedAt,
    partnerUserRef,
    selectedChain,
  ])

  const exceedsLegacyGuestLimit = false // Headless has higher limits via API; no $500 guest cap.

  // ---------------------------------------------------------------------------
  // Error UI
  // ---------------------------------------------------------------------------
  if (error || showExchangeFundingGuide) {
    const isGuide = showExchangeFundingGuide
    return (
      <div
        data-testid="cbheadless-modal-content"
        className={`${shellWidthClass} bg-gradient-to-br from-gray-900 ${
          isGuide ? 'via-amber-950/40' : 'via-red-900/30'
        } to-purple-900/20 backdrop-blur-xl border ${
          isGuide ? 'border-amber-500/25' : 'border-red-500/20'
        } rounded-2xl shadow-2xl text-white overflow-hidden`}
      >
        <div
          className={`flex items-center justify-between p-6 border-b ${
            isGuide ? 'border-amber-500/20' : 'border-red-500/20'
          }`}
        >
          <h3
            className={`text-lg font-semibold ${
              isGuide ? 'text-amber-200' : 'text-red-400'
            }`}
          >
            {isGuide ? 'Fund another way' : 'Error'}
          </h3>
          <button
            data-testid="cbheadless-error-close-button"
            onClick={() => {
              setError(null)
              setErrorCode(null)
              setShowExchangeFundingGuide(false)
              setStatus('idle')
              setPaymentLinkUrl(null)
              onExit?.()
            }}
            className="p-2 hover:bg-white/10 rounded-full transition-colors duration-200"
          >
            <XMarkIcon className="h-5 w-5 text-gray-300 hover:text-white" />
          </button>
        </div>
        <div className="p-6 space-y-4">
          {isGuide ? (
            <CoinbaseQuoteUnavailableGuide
              walletAddress={address}
              networkName={selectedChain?.name}
            />
          ) : (
            <>
              <p className="text-gray-300 text-sm text-center">{error}</p>
              {errorCode && (
                <p className="text-gray-500 text-xs text-center">
                  Code: {errorCode}
                </p>
              )}
              <button
                data-testid="cbheadless-error-try-again-button"
                onClick={() => {
                  setError(null)
                  setErrorCode(null)
                  setStatus('idle')
                  setPaymentLinkUrl(null)
                }}
                className="w-full px-4 py-2 bg-gradient-to-r from-blue-500 to-purple-600 hover:from-blue-600 hover:to-purple-700 text-white rounded-lg font-medium transition-all duration-200"
              >
                Try Again
              </button>
            </>
          )}
        </div>
      </div>
    )
  }

  // ---------------------------------------------------------------------------
  // Iframe (active) UI
  // ---------------------------------------------------------------------------
  if (paymentLinkUrl) {
    return (
      <div
        data-testid="cbheadless-modal-content"
        className={`${shellWidthClass} bg-gradient-to-br from-gray-900 via-blue-900/30 to-purple-900/20 backdrop-blur-xl border border-white/10 rounded-2xl shadow-2xl text-white overflow-hidden`}
      >
        <div className="flex items-center justify-between p-6 border-b border-white/10">
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 rounded-full bg-gradient-to-r from-blue-500 to-purple-600 flex items-center justify-center">
              <Image
                src="/coins/ETH.svg"
                alt="ETH"
                width={20}
                height={20}
                className="w-6 h-6"
              />
            </div>
            <div>
              <h2 className="text-lg font-semibold text-white">
                {status === 'polling'
                  ? 'Processing payment...'
                  : status === 'success'
                  ? 'Payment complete'
                  : 'Complete payment'}
              </h2>
              {quoteData && (
                <p className="text-xs text-gray-400">
                  Buying {quoteData.ethAmount.toFixed(4)} ETH for $
                  {quoteData.purchaseAmount.toFixed(2)}
                </p>
              )}
            </div>
          </div>
          <button
            data-testid="cbheadless-close-button"
            onClick={() => {
              setPaymentLinkUrl(null)
              setStatus('idle')
              onExit?.()
            }}
            className="p-2 hover:bg-white/10 rounded-full transition-colors duration-200"
            aria-label="Close"
          >
            <XMarkIcon className="h-5 w-5 text-gray-300 hover:text-white" />
          </button>
        </div>

        <div className="p-4 space-y-3">
          {(status === 'iframe-loading' || status === 'creating') && (
            <div className="flex items-center justify-center py-6">
              <LoadingSpinner />
              <span className="ml-2 text-gray-400 text-sm">
                Loading payment sheet...
              </span>
            </div>
          )}

          <iframe
            ref={iframeRef}
            data-testid="cbheadless-iframe"
            src={paymentLinkUrl}
            title="Coinbase Onramp"
            allow="payment"
            sandbox="allow-scripts allow-same-origin"
            referrerPolicy="no-referrer"
            className="w-full h-[520px] rounded-lg bg-white"
            style={{ minHeight: 520, border: 'none' }}
          />

          {status === 'polling' && (
            <div className="flex items-center justify-center space-x-2 text-gray-400 pt-2">
              <LoadingSpinner />
              <span className="text-sm">
                Settling your transaction... do not close this window.
              </span>
            </div>
          )}
          {status === 'success' && (
            <p className="text-emerald-300 text-sm text-center pt-2">
              Payment confirmed! Continuing your transaction...
            </p>
          )}
        </div>
      </div>
    )
  }

  // ---------------------------------------------------------------------------
  // Pre-payment UI
  // ---------------------------------------------------------------------------
  const needsPhone = !hasPhone
  const needsPhoneRefresh = phoneStale
  const needsEmail = !userEmail
  const needsVerification = needsPhone || needsPhoneRefresh
  // Step 1 = phone verification, Step 2 = payment
  const currentStep = needsVerification ? 1 : 2
  const totalSteps = 2

  const disableBuy =
    status === 'creating' ||
    isLoadingQuote ||
    !quoteData?.purchaseAmount ||
    needsVerification ||
    needsEmail

  return (
    <div
      data-testid="cbheadless-modal-content"
      className={`${shellWidthClass} bg-gradient-to-br from-gray-900 via-blue-900/30 to-purple-900/20 backdrop-blur-xl border border-white/10 rounded-2xl shadow-2xl text-white overflow-hidden`}
    >
      {/* Header */}
      <div className="flex items-center justify-between p-5 border-b border-white/10">
        <div className="flex items-center space-x-3">
          <div className="w-9 h-9 rounded-full bg-gradient-to-r from-blue-500 to-purple-600 flex items-center justify-center flex-shrink-0">
            <Image src="/coins/ETH.svg" alt="ETH" width={18} height={18} />
          </div>
          <div>
            <h2 className="text-base font-semibold text-white leading-tight">
              Fund with Apple Pay
            </h2>
            <p className="text-xs text-gray-400">Powered by Coinbase</p>
          </div>
        </div>
        <button
          data-testid="cbheadless-close-button"
          onClick={() => onExit?.()}
          className="p-2 hover:bg-white/10 rounded-full transition-colors"
          aria-label="Close"
        >
          <XMarkIcon className="h-5 w-5 text-gray-300 hover:text-white" />
        </button>
      </div>

      {/* Step indicator */}
      <div className="flex items-center gap-2 px-5 pt-4">
        {Array.from({ length: totalSteps }).map((_, i) => {
          const stepNum = i + 1
          const done = stepNum < currentStep
          const active = stepNum === currentStep
          return (
            <div key={stepNum} className="flex items-center gap-2">
              <div
                className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0 transition-colors ${
                  done
                    ? 'bg-emerald-500 text-white'
                    : active
                    ? 'bg-blue-500 text-white'
                    : 'bg-white/10 text-gray-400'
                }`}
              >
                {done ? (
                  <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
                  </svg>
                ) : (
                  stepNum
                )}
              </div>
              <span
                className={`text-xs ${
                  active ? 'text-white font-medium' : done ? 'text-emerald-400' : 'text-gray-500'
                }`}
              >
                {stepNum === 1 ? 'Verify phone' : 'Pay'}
              </span>
              {stepNum < totalSteps && (
                <div className={`flex-1 h-px w-8 ${done ? 'bg-emerald-500/50' : 'bg-white/10'}`} />
              )}
            </div>
          )
        })}
      </div>

      <div className="p-5 space-y-4">
        {/* ── STEP 1: Phone verification ── */}
        {needsVerification && (
          <div className="space-y-4">
            {/* Order summary (collapsed, for context) */}
            <div className="bg-black/20 rounded-lg px-4 py-3 border border-white/5 flex items-center justify-between">
              <span className="text-gray-400 text-sm">Buying</span>
              {isLoadingQuote ? (
                <span className="text-gray-500 text-sm">Calculating...</span>
              ) : quoteData ? (
                <span className="text-white text-sm font-medium">
                  {quoteData.ethAmount.toFixed(4)} ETH &mdash; ${quoteData.purchaseAmount.toFixed(2)}
                </span>
              ) : (
                <span className="text-gray-500 text-sm">{ethAmount.toFixed(4)} ETH</span>
              )}
            </div>

            {/* Phone step card */}
            <div className="bg-blue-500/10 border border-blue-400/30 rounded-xl p-5 space-y-4">
              <div className="flex items-start gap-3">
                <div className="w-10 h-10 rounded-full bg-blue-500/20 flex items-center justify-center flex-shrink-0 mt-0.5">
                  {/* Phone icon */}
                  <svg className="w-5 h-5 text-blue-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8}
                      d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z"
                    />
                  </svg>
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-white font-semibold text-sm">
                    {needsPhoneRefresh ? 'Re-verify your phone number' : 'Verify your US mobile number'}
                  </p>
                  <p className="text-blue-200/80 text-xs leading-relaxed mt-1">
                    {needsPhoneRefresh
                      ? 'Your verification is older than 60 days. Coinbase requires a fresh verification to process your payment.'
                      : "Coinbase requires a one-time SMS verification to use Apple Pay. You'll only need to do this once every 60 days."}
                  </p>
                </div>
              </div>

              <div className="space-y-2 text-xs text-blue-200/60 pl-1">
                <div className="flex items-center gap-2">
                  <span className="w-1 h-1 rounded-full bg-blue-400/60 flex-shrink-0" />
                  Must be a US cell number (not VoIP)
                </div>
                <div className="flex items-center gap-2">
                  <span className="w-1 h-1 rounded-full bg-blue-400/60 flex-shrink-0" />
                  You&apos;ll receive a one-time code via SMS
                </div>
                <div className="flex items-center gap-2">
                  <span className="w-1 h-1 rounded-full bg-blue-400/60 flex-shrink-0" />
                  Handled securely by Privy — MoonDAO never sees your number
                </div>
              </div>

              <button
                onClick={() => needsPhoneRefresh ? refreshVerification() : requestVerification()}
                className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-blue-500 hover:bg-blue-400 active:bg-blue-600 text-white rounded-lg font-semibold text-sm transition-colors shadow-md"
              >
                {needsPhoneRefresh ? 'Re-verify phone number' : 'Send verification code'}
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                </svg>
              </button>

              <p className="text-blue-200/40 text-[10px] text-center">
                After verifying, this step won&apos;t appear again for 60 days.
              </p>
            </div>

            {needsEmail && (
              <div className="bg-amber-500/10 border border-amber-400/30 rounded-lg p-3 text-amber-100 text-xs">
                A verified email is also required. Please link one via your account settings.
              </div>
            )}
          </div>
        )}

        {/* ── STEP 2: Payment ── */}
        {!needsVerification && (
          <>
            {allowAmountInput && (
              <div className="space-y-1.5">
                <label className="text-gray-300 text-sm font-medium">Amount (ETH)</label>
                <input
                  data-testid="cbheadless-amount-input"
                  type="text"
                  value={inputAmountString}
                  onChange={(e) => {
                    const value = e.target.value
                    if (value === '' || value === '.') {
                      setInputAmountString(value)
                      setInputAmount(0)
                      return
                    }
                    if (/^\d*\.?\d*$/.test(value)) {
                      setInputAmountString(value)
                      const numValue = parseFloat(value)
                      setInputAmount(isNaN(numValue) ? 0 : numValue)
                    }
                  }}
                  placeholder="0.0"
                  className="w-full bg-black/20 border border-white/10 rounded-lg p-3 text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500/50"
                />
              </div>
            )}

            {/* Quote summary */}
            <div className="bg-black/20 rounded-lg p-4 border border-white/5 space-y-2.5">
              {isLoadingQuote ? (
                <div className="flex items-center justify-center">
                  <LoadingSpinner />
                  <span className="ml-2 text-gray-400 text-sm">Getting quote...</span>
                </div>
              ) : quoteData?.purchaseAmount ? (
                <>
                  {isArbitrum && (
                    <p className="text-xs text-gray-500 italic">
                      * Fees estimated using Ethereum rates. Actual fees may vary slightly.
                    </p>
                  )}
                  <div className="flex items-center justify-between">
                    <span className="text-gray-400 text-sm">Network</span>
                    <span className="text-white text-sm font-medium">{selectedChain?.name || 'Ethereum'}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-gray-400 text-sm">You receive</span>
                    <span className="text-white text-sm font-medium">{quoteData.ethAmount.toFixed(4)} ETH</span>
                  </div>
                  <div className="flex items-center justify-between border-t border-white/5 pt-2 mt-1">
                    <span className="text-gray-300 text-sm font-semibold">Total</span>
                    <span className="text-white text-sm font-bold">${quoteData.purchaseAmount.toFixed(2)}</span>
                  </div>
                  {/* Phone number confirmation */}
                  <div className="flex items-center justify-between border-t border-white/5 pt-2 mt-1">
                    <span className="text-gray-400 text-sm">Phone</span>
                    <span className="text-emerald-300 text-sm font-medium flex items-center gap-1">
                      <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
                      </svg>
                      {phoneNumber}
                    </span>
                  </div>
                </>
              ) : (
                <div className="flex items-center justify-between">
                  <span className="text-gray-400 text-sm">Network</span>
                  <span className="text-white text-sm font-medium">{selectedChain?.name || 'Ethereum'}</span>
                </div>
              )}
            </div>

            {needsEmail && (
              <div className="bg-amber-500/10 border border-amber-400/30 rounded-lg p-3 text-amber-100 text-xs">
                A verified email is also required. Please link one via your account settings.
              </div>
            )}

            {quoteData?.purchaseAmount &&
              quoteData.purchaseAmount > LARGE_ONRAMP_FIAT_THRESHOLD_USD && (
                <LargeAmountExchangeOnrampNotice walletAddress={address} />
              )}

            <div
              data-testid="cbheadless-debit-card-tip"
              className="bg-emerald-500/10 border border-emerald-400/30 rounded-lg p-3"
            >
              <p className="text-emerald-100/80 text-xs leading-relaxed">
                <span className="font-semibold text-emerald-200">Tip:</span> Bank-issued debit
                cards have the highest success rate. Credit cards, prepaid cards, and virtual
                cards are not supported by Coinbase.
              </p>
            </div>

            <PrivyWeb3Button
              label={
                status === 'creating'
                  ? 'Preparing payment...'
                  : isLoadingQuote
                  ? 'Getting quote...'
                  : quoteData?.purchaseAmount
                  ? `Pay $${quoteData.purchaseAmount.toFixed(2)} with Apple Pay`
                  : 'Pay with Apple Pay'
              }
              showSignInLabel={false}
              action={handleStartHeadlessPayment}
              className="w-full bg-gradient-to-r from-blue-500 to-purple-600 hover:from-blue-600 hover:to-purple-700 text-white py-4 px-6 rounded-lg font-semibold transition-all duration-200 shadow-lg disabled:opacity-50 disabled:cursor-not-allowed"
              skipNetworkCheck={true}
              isDisabled={disableBuy}
            />

            {MOCK_ONRAMP && (
              <p className="text-xs text-amber-300/80 text-center">
                Sandbox mode — your card will not be charged.
              </p>
            )}

            <div className="bg-black/10 rounded-lg p-3 border border-white/5">
              <p className="text-gray-400 text-[11px] text-center leading-relaxed">
                By continuing you agree to Coinbase&apos;s{' '}
                <a className="underline" href="https://www.coinbase.com/legal/guest-checkout/us" target="_blank" rel="noreferrer">
                  Guest Checkout Terms
                </a>
                {', '}
                <a className="underline" href="https://www.coinbase.com/legal/user_agreement" target="_blank" rel="noreferrer">
                  User Agreement
                </a>{' '}
                and{' '}
                <a className="underline" href="https://www.coinbase.com/legal/privacy" target="_blank" rel="noreferrer">
                  Privacy Policy
                </a>
                .
              </p>
            </div>
          </>
        )}
      </div>
    </div>
  )
}

export default CBHeadlessOnramp
