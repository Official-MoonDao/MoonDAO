import { XMarkIcon } from '@heroicons/react/24/outline'
import { usePrivy } from '@privy-io/react-auth'
import Image from 'next/image'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import useOnrampVerification from '@/lib/coinbase/useOnrampVerification'
import { LoadingSpinner } from '../layout/LoadingSpinner'
import { PrivyWeb3Button } from '../privy/PrivyWeb3Button'

interface CBHeadlessOnrampProps {
  address: string
  selectedChain: any
  ethAmount: number
  onExit?: () => void
  isWaitingForGasEstimate?: boolean
  fullWidth?: boolean
  embedded?: boolean
  /** When true, shows a USD amount input the user fills in (e.g. generic
   *  wallet top-ups with no predetermined amount). The entered USD is
   *  converted to ETH for the order. */
  allowAmountInput?: boolean
  /** Optional content rendered just beneath the "Fund" header. */
  headerSlot?: React.ReactNode
  onQuoteCalculated?: (
    ethAmount: number,
    paymentSubtotal: number,
    paymentTotal: number,
    totalFees: number
  ) => void
  /** Optional: confirm the on-chain balance is now sufficient. */
  checkBalanceSufficient?: () => Promise<boolean>
  /** Called once funds have arrived and the flow can proceed. */
  onBalanceSufficient?: () => void
  /** Refetch the on-chain balance so newly arrived funds are detected. */
  refetchBalance?: () => Promise<void>
  /** Called after a successful purchase (e.g. to resume the parent flow). */
  onSuccess?: () => void
  /** Called when the device doesn't support Apple Pay or Google Pay so the
   *  parent can fall back to MoonPay automatically. */
  onUnsupported?: () => void
}

type FundingState =
  | 'idle'
  | 'creating'
  | 'ready'
  | 'processing'
  | 'success'

const MOCK_ONRAMP = process.env.NEXT_PUBLIC_MOCK_ONRAMP === 'true'

const COINBASE_TERMS_URL = 'https://www.coinbase.com/legal/guest-checkout/us'
const COINBASE_USER_AGREEMENT_URL = 'https://www.coinbase.com/legal/user_agreement'
const COINBASE_PRIVACY_URL = 'https://www.coinbase.com/legal/privacy'

// Coinbase post-message event origins for the embedded payment link.
function isCoinbaseOrigin(origin: string): boolean {
  try {
    const { hostname } = new URL(origin)
    return hostname === 'coinbase.com' || hostname.endsWith('.coinbase.com')
  } catch {
    return false
  }
}

type OnrampPaymentMethod = 'GUEST_CHECKOUT_APPLE_PAY' | 'GUEST_CHECKOUT_GOOGLE_PAY'

// Coinbase guest checkout supports both Apple Pay and Google Pay on the web. We
// pick the method per device: Apple devices use Apple Pay (the native sheet in
// Safari, a scannable QR code elsewhere) and Android uses Google Pay's
// in-iframe button.

// True only in Safari/WebKit, where the native Apple Pay sheet is available.
// Other browsers fall back to Coinbase's Apple Pay QR-code experience.
function hasNativeApplePay(): boolean {
  return typeof window !== 'undefined' && !!(window as any).ApplePaySession
}

// Android phones/tablets, where Coinbase renders an in-iframe Google Pay button.
function isAndroidDevice(): boolean {
  return typeof navigator !== 'undefined' && /Android/i.test(navigator.userAgent || '')
}

export function CBHeadlessOnramp({
  address,
  selectedChain,
  ethAmount,
  onExit,
  isWaitingForGasEstimate = false,
  fullWidth = false,
  embedded = false,
  headerSlot,
  allowAmountInput = false,
  onQuoteCalculated,
  checkBalanceSufficient,
  onBalanceSufficient,
  refetchBalance,
  onSuccess,
  onUnsupported,
}: CBHeadlessOnrampProps) {
  const { user } = usePrivy()
  const verification = useOnrampVerification()

  const shellWidthClass = fullWidth ? 'w-full' : 'w-full max-w-md mx-auto'
  const shellChrome = embedded
    ? 'w-full text-white'
    : `${shellWidthClass} bg-gradient-to-br from-gray-900 via-blue-900/30 to-purple-900/20 backdrop-blur-xl border border-white/10 rounded-2xl shadow-2xl text-white overflow-hidden`

  const [fundingState, setFundingState] = useState<FundingState>('idle')
  const [error, setError] = useState<string | null>(null)
  const [agreed, setAgreed] = useState(false)
  const [paymentLinkUrl, setPaymentLinkUrl] = useState<string | null>(null)
  const [paymentTotal, setPaymentTotal] = useState<number | null>(null)
  const [quoteLoading, setQuoteLoading] = useState(false)

  // USD amount-input mode (e.g. generic wallet top-ups). The user types USD,
  // which we convert to ETH using the spot price for the order.
  const [usdInputString, setUsdInputString] = useState('')
  const [ethPrice, setEthPrice] = useState<number | null>(null)

  useEffect(() => {
    if (!allowAmountInput) return
    let cancelled = false
    fetch('/api/coinbase/eth-price')
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => {
        if (!cancelled && d?.price > 0) setEthPrice(d.price)
      })
      .catch(() => {})
    return () => {
      cancelled = true
    }
  }, [allowAmountInput])

  // ETH the order will purchase: typed-USD ÷ spot when in input mode,
  // otherwise the predetermined prop amount.
  const effectiveEthAmount = useMemo(() => {
    if (!allowAmountInput) return ethAmount
    const usd = parseFloat(usdInputString) || 0
    if (!ethPrice || ethPrice <= 0 || usd <= 0) return 0
    return usd / ethPrice
  }, [allowAmountInput, ethAmount, usdInputString, ethPrice])

  // Debounce the effective amount so we don't quote on every keystroke.
  const [debouncedEthAmount, setDebouncedEthAmount] = useState(ethAmount)
  useEffect(() => {
    if (!allowAmountInput) {
      setDebouncedEthAmount(ethAmount)
      return
    }
    const t = setTimeout(() => setDebouncedEthAmount(effectiveEthAmount), 500)
    return () => clearTimeout(t)
  }, [allowAmountInput, ethAmount, effectiveEthAmount])

  const nativeApplePay = useMemo(() => hasNativeApplePay(), [])
  // Android (without Apple Pay) → Google Pay; everyone else → Apple Pay.
  const useGooglePay = useMemo(() => isAndroidDevice() && !nativeApplePay, [nativeApplePay])
  const paymentMethod: OnrampPaymentMethod = useGooglePay
    ? 'GUEST_CHECKOUT_GOOGLE_PAY'
    : 'GUEST_CHECKOUT_APPLE_PAY'
  const payLabel = useGooglePay ? 'Google Pay' : 'Apple Pay'

  const onBalanceSufficientRef = useRef(onBalanceSufficient)
  const refetchBalanceRef = useRef(refetchBalance)
  const checkBalanceSufficientRef = useRef(checkBalanceSufficient)
  const onSuccessRef = useRef(onSuccess)
  const onUnsupportedRef = useRef(onUnsupported)
  useEffect(() => {
    onBalanceSufficientRef.current = onBalanceSufficient
    refetchBalanceRef.current = refetchBalance
    checkBalanceSufficientRef.current = checkBalanceSufficient
    onSuccessRef.current = onSuccess
    onUnsupportedRef.current = onUnsupported
  }, [onBalanceSufficient, refetchBalance, checkBalanceSufficient, onSuccess, onUnsupported])

  // Fetch a fee estimate to display (and surface to the parent) before paying.
  useEffect(() => {
    let cancelled = false
    const fetchEstimate = async () => {
      if (
        !address ||
        !debouncedEthAmount ||
        debouncedEthAmount <= 0 ||
        isWaitingForGasEstimate
      ) {
        return
      }
      setQuoteLoading(true)
      try {
        const priceRes = await fetch('/api/coinbase/eth-price')
        if (!priceRes.ok) throw new Error('price')
        const { price } = await priceRes.json()
        if (!price || price <= 0) throw new Error('price')

        const estimateUSD = debouncedEthAmount * price * 1.05
        const quoteRes = await fetch('/api/coinbase/buy-quote', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            paymentAmount: estimateUSD,
            destinationAddress: address,
            purchaseNetwork: 'ethereum',
            purchaseCurrency: 'ETH',
          }),
        })
        if (!quoteRes.ok) throw new Error('quote')
        const data = await quoteRes.json()
        const quote = data?.quote
        const subtotal = parseFloat(quote?.payment_subtotal?.value || '0')
        const total = parseFloat(quote?.payment_total?.value || '0')
        if (!cancelled && total > 0) {
          setPaymentTotal(total)
          onQuoteCalculated?.(
            debouncedEthAmount,
            subtotal,
            total,
            total - subtotal
          )
        }
      } catch {
        // Estimate is best-effort; the real total comes from the created order.
      } finally {
        if (!cancelled) setQuoteLoading(false)
      }
    }
    fetchEstimate()
    return () => {
      cancelled = true
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [address, debouncedEthAmount, isWaitingForGasEstimate])

  const handleExit = useCallback(() => {
    setFundingState('idle')
    setPaymentLinkUrl(null)
    onExit?.()
  }, [onExit])

  // Called when the user acknowledges the post-purchase confirmation screen.
  // Deferring these until the user clicks lets them actually see the success
  // state before the modal closes / onboarding advances.
  const handleSuccessAck = useCallback(() => {
    onBalanceSufficientRef.current?.()
    onSuccessRef.current?.()
  }, [])

  const handleCreateOrder = useCallback(async () => {
    if (!verification.isReady) {
      setError('Please verify your phone and email before continuing.')
      return
    }
    if (!agreed) {
      setError('Please accept the Coinbase guest checkout terms to continue.')
      return
    }
    if (!effectiveEthAmount || effectiveEthAmount <= 0) {
      setError('Please enter an amount to continue.')
      return
    }

    try {
      setError(null)
      setFundingState('creating')

      const partnerUserRef = user?.id || address

      const res = await fetch('/api/coinbase/create-onramp-order', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          destinationAddress: address,
          selectedChain: {
            id: selectedChain?.id,
            name: selectedChain?.name,
          },
          ethAmount: effectiveEthAmount,
          paymentMethod,
          email: verification.email,
          phoneNumber: verification.phoneNumber,
          phoneNumberVerifiedAt: verification.phoneVerifiedAt,
          agreementAcceptedAt: new Date().toISOString(),
          partnerUserRef,
          domain:
            typeof window !== 'undefined' ? window.location.host : undefined,
        }),
      })

      const data = await res.json()
      if (!res.ok) {
        setError(data?.error || 'Unable to create the Coinbase order.')
        setFundingState('idle')
        return
      }

      let url: string | undefined = data?.paymentLink?.url
      if (!url) {
        setError('Coinbase did not return a payment link. Please try again.')
        setFundingState('idle')
        return
      }

      const total = parseFloat(data?.order?.paymentTotal || '0')
      if (total > 0) setPaymentTotal(total)

      // Sandbox mode swaps the real Apple Pay sheet for a fake popup (Apple Pay only).
      if (MOCK_ONRAMP && !useGooglePay) {
        url += (url.includes('?') ? '&' : '?') + 'useApplePaySandbox=true'
      }

      console.info('[CBHeadlessOnramp] order created', {
        mockOnramp: MOCK_ONRAMP,
        paymentMethod,
        sandboxParamAppended: MOCK_ONRAMP,
        orderId: data?.order?.orderId ?? data?.order?.id ?? null,
        paymentTotal: data?.order?.paymentTotal ?? null,
      })

      setPaymentLinkUrl(url)
      setFundingState('ready')
    } catch (err: any) {
      setError(
        'Failed to start the Coinbase checkout: ' +
          (err?.message || 'Unknown error')
      )
      setFundingState('idle')
    }
  }, [
    address,
    agreed,
    effectiveEthAmount,
    paymentMethod,
    useGooglePay,
    selectedChain,
    user?.id,
    verification.email,
    verification.isReady,
    verification.phoneNumber,
    verification.phoneVerifiedAt,
  ])

  // Listen to the embedded payment link's post-message events.
  useEffect(() => {
    if (fundingState !== 'ready' && fundingState !== 'processing') return

    const handleMessage = async (event: MessageEvent) => {
      if (!isCoinbaseOrigin(event.origin)) return

      let payload: any = event.data
      if (typeof payload === 'string') {
        try {
          payload = JSON.parse(payload)
        } catch {
          return
        }
      }
      const eventName: string | undefined = payload?.eventName
      const errorCode: string | undefined = payload?.data?.errorCode
      const errorMessage: string | undefined = payload?.data?.errorMessage
      if (!eventName) return

      if (eventName.startsWith('onramp_api.')) {
        console.info('[CBHeadlessOnramp] event:', eventName, payload?.data)
      }

      switch (eventName) {
        case 'onramp_api.load_error': {
          // On non-Safari Apple Pay browsers, Coinbase renders an Apple Pay QR
          // code instead of the native sheet. Per Coinbase docs this "not
          // supported" error is expected there and must be ignored so the QR
          // code stays visible. This QR fallback doesn't apply to Google Pay.
          if (
            !useGooglePay &&
            errorCode === 'ERROR_CODE_GUEST_APPLE_PAY_NOT_SUPPORTED'
          ) {
            break
          }
          // The chosen method genuinely isn't available/set up on this device
          // (no Apple Pay card, or Google Pay unavailable): fall back to MoonPay.
          if (
            (errorCode === 'ERROR_CODE_GUEST_APPLE_PAY_NOT_SETUP' ||
              errorCode === 'ERROR_CODE_GUEST_APPLE_PAY_NOT_SUPPORTED' ||
              errorCode === 'ERROR_CODE_GUEST_GOOGLE_PAY_NOT_SETUP' ||
              errorCode === 'ERROR_CODE_GUEST_GOOGLE_PAY_NOT_SUPPORTED') &&
            onUnsupportedRef.current
          ) {
            onUnsupportedRef.current()
            setFundingState('idle')
            setPaymentLinkUrl(null)
            break
          }
          setError(
            errorMessage ||
              'The Coinbase payment button failed to load. Please try again.'
          )
          setFundingState('idle')
          setPaymentLinkUrl(null)
          break
        }
        case 'onramp_api.commit_error': {
          const friendlyCommitError =
            errorCode === 'ERROR_CODE_GUEST_CARD_PREPAID_DECLINED'
              ? 'Prepaid cards are not supported. Please use a regular debit or credit card and try again.'
              : errorMessage || 'Your payment could not be completed. Please try again.'
          setError(friendlyCommitError)
          setFundingState('ready')
          break
        }
        case 'onramp_api.commit_success':
          setError(null)
          setFundingState('processing')
          break
        case 'onramp_api.polling_success':
          setFundingState('success')
          try {
            await refetchBalanceRef.current?.()
            if (checkBalanceSufficientRef.current) {
              await checkBalanceSufficientRef.current()
            }
          } catch {
            // ignore
          }
          // onBalanceSufficient / onSuccess are deferred to handleSuccessAck so
          // the confirmation screen stays up until the user acknowledges it.
          break
        case 'onramp_api.polling_error':
          setError(
            errorMessage ||
              'There was a problem processing your transaction. Please try again.'
          )
          setFundingState('ready')
          break
        case 'onramp_api.cancel':
          setFundingState('ready')
          break
        default:
          break
      }
    }

    window.addEventListener('message', handleMessage)
    return () => window.removeEventListener('message', handleMessage)
  }, [fundingState, useGooglePay])

  // --- Success state ---
  if (fundingState === 'success') {
    return (
      <div className={shellChrome}>
        <div className="flex items-center justify-between p-6 border-b border-white/10">
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 rounded-full bg-emerald-500/20 flex items-center justify-center">
              <svg className="w-6 h-6 text-emerald-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
            <h2 className="text-lg font-semibold text-white">Funds on the way</h2>
          </div>
          <button onClick={handleSuccessAck} className="p-2 hover:bg-white/10 rounded-full transition-colors duration-200">
            <XMarkIcon className="h-5 w-5 text-gray-300 hover:text-white" />
          </button>
        </div>
        <div className="p-6 space-y-5">
          <p className="text-gray-300 text-sm text-center">
            Your purchase was successful. Your {selectedChain?.name || 'wallet'} balance will
            update shortly — funds typically arrive within a few minutes.
          </p>
          <button
            onClick={handleSuccessAck}
            className="w-full py-3 rounded-xl bg-gradient-to-r from-blue-500 to-purple-600 text-white font-semibold hover:opacity-90 transition-opacity duration-200"
          >
            Continue
          </button>
        </div>
      </div>
    )
  }

  // --- Payment link (iframe) state ---
  if ((fundingState === 'ready' || fundingState === 'processing') && paymentLinkUrl) {
    return (
      <div className={shellChrome}>
        <div className="flex items-center justify-between p-6 border-b border-white/10">
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 rounded-full bg-gradient-to-r from-blue-500 to-purple-600 flex items-center justify-center">
              <Image src="/coins/ETH.svg" alt="ETH" width={20} height={20} className="w-6 h-6" />
            </div>
            <div>
              <h2 className="text-lg font-semibold text-white">
                {fundingState === 'processing' ? 'Processing payment' : `Pay with ${payLabel}`}
              </h2>
              {paymentTotal != null && (
                <p className="text-gray-400 text-xs">Total: ${paymentTotal.toFixed(2)}</p>
              )}
            </div>
          </div>
          <button onClick={handleExit} className="p-2 hover:bg-white/10 rounded-full transition-colors duration-200">
            <XMarkIcon className="h-5 w-5 text-gray-300 hover:text-white" />
          </button>
        </div>

        {headerSlot}

        <div className="p-6 space-y-4">
          {fundingState === 'processing' && (
            <div className="flex items-center justify-center space-x-2 text-gray-300">
              <LoadingSpinner />
              <span className="text-sm">Completing your purchase…</span>
            </div>
          )}
          <div className="bg-black/20 rounded-lg border border-white/10 overflow-hidden">
            {/* Apple Pay (Safari) and Google Pay render just a button (short);
                non-Safari Apple Pay renders a full QR-code screen needing more height. */}
            <iframe
              title="Coinbase payment"
              src={paymentLinkUrl}
              allow="payment *; camera *; microphone *; accelerometer *; gyroscope *; magnetometer *"
              sandbox="allow-scripts allow-same-origin"
              referrerPolicy="no-referrer"
              className="w-full"
              style={{
                height: nativeApplePay ? 220 : useGooglePay ? 360 : 520,
                maxHeight: '60vh',
                border: 'none',
              }}
            />
          </div>
          <p className="text-gray-400 text-xs text-center leading-relaxed">
            {nativeApplePay
              ? 'Press the Apple Pay button above to complete your purchase securely with Coinbase.'
              : useGooglePay
                ? 'Press the Google Pay button above to complete your purchase securely with Coinbase.'
                : 'Scan the QR code above with your phone to complete your purchase securely with Apple Pay.'}
          </p>
        </div>
      </div>
    )
  }

  // --- Config state (quote + verification + terms) ---
  return (
    <div className={shellChrome}>
      <div className="flex items-center justify-between p-6 border-b border-white/10">
        <div className="flex items-center space-x-3">
          <div className="w-10 h-10 rounded-full bg-gradient-to-r from-blue-500 to-purple-600 flex items-center justify-center">
            <Image src="/coins/ETH.svg" alt="ETH" width={20} height={20} className="w-6 h-6" />
          </div>
          <div>
            <h2 className="text-lg font-semibold text-white">Fund</h2>
          </div>
        </div>
        <button onClick={() => onExit?.()} className="p-2 hover:bg-white/10 rounded-full transition-colors duration-200">
          <XMarkIcon className="h-5 w-5 text-gray-300 hover:text-white" />
        </button>
      </div>

      {headerSlot}

      <div className="p-6 space-y-6">
        {/* USD amount input (generic top-ups) */}
        {allowAmountInput && (
          <div className="space-y-2">
            <label className="text-gray-300 text-sm font-medium">Amount (USD)</label>
            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400">
                $
              </span>
              <input
                type="number"
                inputMode="decimal"
                min="0"
                step="1"
                value={usdInputString}
                onChange={(e) => setUsdInputString(e.target.value)}
                placeholder="50"
                className="w-full bg-black/30 border border-white/15 rounded-lg py-3 pl-7 pr-3 text-white placeholder-gray-500 focus:border-blue-400 focus:ring-1 focus:ring-blue-400/50 outline-none"
              />
            </div>
            {effectiveEthAmount > 0 && (
              <p className="text-gray-400 text-xs">
                ≈ {effectiveEthAmount.toFixed(4)} ETH
              </p>
            )}
          </div>
        )}

        {/* Amount summary */}
        <div className="bg-black/20 rounded-lg p-4 border border-white/5 space-y-3">
          {isWaitingForGasEstimate || quoteLoading ? (
            <div className="flex items-center justify-center">
              <LoadingSpinner />
              <span className="ml-2 text-gray-400 text-sm">Getting quote…</span>
            </div>
          ) : (
            <>
              <div className="flex items-center justify-between">
                <span className="text-gray-400 text-sm">Network:</span>
                <span className="text-white font-medium">{selectedChain?.name || 'Arbitrum'}</span>
              </div>
              {!allowAmountInput && ethAmount > 0 && (
                <div className="flex items-center justify-between">
                  <span className="text-gray-400 text-sm">Amount:</span>
                  <span className="text-white font-medium">{ethAmount.toFixed(4)} ETH</span>
                </div>
              )}
              {paymentTotal != null && (
                <div className="flex items-center justify-between">
                  <span className="text-gray-400 text-sm">Estimated total:</span>
                  <span className="text-white font-medium">${paymentTotal.toFixed(2)}</span>
                </div>
              )}
            </>
          )}
        </div>

        {/* Verification */}
        <div className="bg-white/5 border border-white/10 rounded-lg p-4 space-y-3">
          <p className="text-gray-200 font-semibold text-sm">Verify your details</p>
          <p className="text-gray-400 text-xs leading-relaxed">
            Coinbase {payLabel} checkout requires a verified US phone number and email.
          </p>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 text-sm">
              <StatusDot ok={verification.hasPhone} />
              <span className="text-gray-300">
                Phone{verification.phoneNumber ? `: ${verification.phoneNumber}` : ''}
              </span>
            </div>
            {!verification.hasPhone && (
              <button
                type="button"
                onClick={verification.linkPhone}
                className="text-xs font-semibold text-blue-300 hover:text-blue-200 underline"
              >
                {verification.phoneVerificationStale ? 'Re-verify' : 'Add phone'}
              </button>
            )}
          </div>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 text-sm">
              <StatusDot ok={verification.hasEmail} />
              <span className="text-gray-300">
                Email{verification.email ? `: ${verification.email}` : ''}
              </span>
            </div>
            {!verification.hasEmail && (
              <button
                type="button"
                onClick={verification.linkEmail}
                className="text-xs font-semibold text-blue-300 hover:text-blue-200 underline"
              >
                Add email
              </button>
            )}
          </div>
        </div>

        {/* Terms */}
        <label className="flex items-start gap-3 cursor-pointer">
          <input
            type="checkbox"
            checked={agreed}
            onChange={(e) => setAgreed(e.target.checked)}
            className="mt-1 h-4 w-4 rounded border-white/20 bg-black/30 text-blue-500 focus:ring-blue-500/50"
          />
          <span className="text-gray-300 text-xs leading-relaxed">
            By continuing, I agree to Coinbase&apos;s{' '}
            <a href={COINBASE_TERMS_URL} target="_blank" rel="noreferrer" className="underline text-blue-300 hover:text-blue-200">
              Guest Checkout Terms
            </a>
            ,{' '}
            <a href={COINBASE_USER_AGREEMENT_URL} target="_blank" rel="noreferrer" className="underline text-blue-300 hover:text-blue-200">
              User Agreement
            </a>
            , and{' '}
            <a href={COINBASE_PRIVACY_URL} target="_blank" rel="noreferrer" className="underline text-blue-300 hover:text-blue-200">
              Privacy Policy
            </a>
            .
          </span>
        </label>

        {error && (
          <div className="bg-red-500/10 border border-red-400/30 rounded-lg p-3">
            <p className="text-red-200 text-xs leading-relaxed">{error}</p>
          </div>
        )}

        {/* Continue button */}
        <PrivyWeb3Button
          label={
            fundingState === 'creating'
              ? 'Preparing checkout…'
              : `Continue to ${payLabel}`
          }
          showSignInLabel={false}
          action={handleCreateOrder}
          className="w-full bg-gradient-to-r from-blue-500 to-purple-600 hover:from-blue-600 hover:to-purple-700 text-white py-4 px-6 rounded-lg font-semibold transition-all duration-200 transform hover:scale-105 shadow-lg disabled:opacity-50 disabled:cursor-not-allowed disabled:transform-none"
          skipNetworkCheck={true}
          isDisabled={
            fundingState === 'creating' ||
            isWaitingForGasEstimate ||
            !verification.isReady ||
            !agreed ||
            effectiveEthAmount <= 0
          }
        />

        {/* Secured footer */}
        <div className="bg-black/10 rounded-lg p-4 border border-white/5">
          <div className="flex items-center justify-center space-x-2 text-gray-400 mb-2">
            <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M5 9V7a5 5 0 0110 0v2a2 2 0 012 2v5a2 2 0 01-2 2H5a2 2 0 01-2-2v-5a2 2 0 012-2zm8-2v2H7V7a3 3 0 016 0z" clipRule="evenodd" />
            </svg>
            <span className="text-xs font-medium uppercase tracking-wide">Secured by Coinbase</span>
          </div>
          <p className="text-gray-300 text-xs text-center leading-relaxed">
            Pay with {payLabel} without leaving this page. Funds typically arrive within a few minutes.
          </p>
        </div>
      </div>
    </div>
  )
}

function StatusDot({ ok }: { ok: boolean }) {
  return (
    <span
      className={`inline-block w-2.5 h-2.5 rounded-full ${
        ok ? 'bg-emerald-400' : 'bg-gray-500'
      }`}
    />
  )
}
