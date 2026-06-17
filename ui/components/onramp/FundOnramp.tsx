import { useEffect, useRef, useState } from 'react'
import { CBOnramp } from '../coinbase/CBOnramp'
import { MoonPayOnramp } from '../moonpay/MoonPayOnramp'

export type OnrampProvider = 'moonpay' | 'coinbase'

interface FundOnrampProps {
  address: string
  selectedChain: any
  ethAmount: number
  fullWidth?: boolean
  isWaitingForGasEstimate?: boolean
  onExit?: () => void
  /** Forces a provider. When omitted, auto-selects by region: Coinbase for US
   *  users, MoonPay for everyone else. */
  defaultProvider?: OnrampProvider

  // MoonPay-specific
  onMoonPayBeforeOpen?: () => Promise<void>
  onMoonPayPurchaseSubmitted?: () => void
  checkBalanceSufficient?: () => Promise<boolean>
  onBalanceSufficient?: () => void
  refetchBalance?: () => Promise<void>
  pollIntervalMs?: number
  pollMaxMinutes?: number

  // Coinbase-specific
  coinbaseRedirectUrl?: string
  onCoinbaseBeforeNavigate?: () => Promise<void>
  onCoinbaseQuoteCalculated?: (
    ethAmount: number,
    paymentSubtotal: number,
    paymentTotal: number,
    totalFees: number
  ) => void
  allowAmountInput?: boolean
}

/**
 * Combined fiat onramp. Defaults to Coinbase (Apple/Google Pay) for US users
 * and MoonPay for everyone else. The user can always switch manually.
 */
export function FundOnramp({
  address,
  selectedChain,
  ethAmount,
  fullWidth = false,
  isWaitingForGasEstimate = false,
  onExit,
  defaultProvider,
  onMoonPayBeforeOpen,
  onMoonPayPurchaseSubmitted,
  checkBalanceSufficient,
  onBalanceSufficient,
  refetchBalance,
  pollIntervalMs,
  pollMaxMinutes,
  coinbaseRedirectUrl,
  onCoinbaseBeforeNavigate,
  onCoinbaseQuoteCalculated,
  allowAmountInput = false,
}: FundOnrampProps) {
  // Start with the caller's override (if any), otherwise 'moonpay' until
  // region detection resolves.
  const [provider, setProvider] = useState<OnrampProvider>(
    defaultProvider ?? 'moonpay'
  )
  // Track whether the user has manually switched so we don't override them.
  const userSwitchedRef = useRef(false)
  const [isUS, setIsUS] = useState<boolean | null>(null)

  useEffect(() => {
    // Only auto-select when the caller hasn't forced a defaultProvider.
    if (defaultProvider) return
    let cancelled = false
    fetch('/api/coinbase/region')
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        if (cancelled || userSwitchedRef.current) return
        // US → Coinbase (Apple/Google Pay); everyone else → MoonPay
        setIsUS(data ? !!data.isUS : false)
        setProvider(data?.isUS ? 'coinbase' : 'moonpay')
      })
      .catch(() => {
        if (!cancelled) setIsUS(false)
      })
    return () => {
      cancelled = true
    }
  }, [defaultProvider])

  const handleSetProvider = (p: OnrampProvider) => {
    userSwitchedRef.current = true
    setProvider(p)
  }

  const shellWidthClass = fullWidth ? 'w-full' : 'w-full max-w-md mx-auto'

  // Rendered just beneath the embedded provider's "Fund Wallet" header so the
  // user picks how to pay after they see what they're funding.
  const providerSelector = (
    <div
      data-testid="onramp-provider-select"
      className="p-4 space-y-3 border-b border-white/10"
    >
      <p className="text-gray-400 font-semibold text-xs uppercase tracking-wider">
        Choose how to pay
      </p>
      <div className="grid grid-cols-2 gap-2">
        <button
          type="button"
          data-testid="onramp-select-moonpay"
          onClick={() => handleSetProvider('moonpay')}
          aria-pressed={provider === 'moonpay'}
          className={`relative flex flex-col items-start gap-1 rounded-xl border p-3 text-left transition-all duration-200 ${
            provider === 'moonpay'
              ? 'border-indigo-400/60 bg-indigo-500/15 ring-2 ring-indigo-500/40'
              : 'border-white/10 bg-white/5 hover:bg-white/10'
          }`}
        >
          <span className="text-sm font-semibold text-white">MoonPay</span>
          <span className="text-[10px] font-semibold uppercase tracking-wide text-emerald-300">
            {isUS ? 'Card or bank' : 'Recommended'}
          </span>
        </button>
        <button
          type="button"
          data-testid="onramp-select-coinbase"
          onClick={() => handleSetProvider('coinbase')}
          aria-pressed={provider === 'coinbase'}
          className={`relative flex flex-col items-start gap-1 rounded-xl border p-3 text-left transition-all duration-200 ${
            provider === 'coinbase'
              ? 'border-blue-400/60 bg-blue-500/15 ring-2 ring-blue-500/40'
              : 'border-white/10 bg-white/5 hover:bg-white/10'
          }`}
        >
          <span className="text-sm font-semibold text-white">Coinbase</span>
          <span className="text-[10px] font-semibold uppercase tracking-wide text-emerald-300">
            {isUS ? 'Recommended' : 'Apple Pay / Google Pay'}
          </span>
        </button>
      </div>

      {provider === 'coinbase' ? (
        isUS ? (
          <p className="text-gray-300/80 text-xs leading-relaxed">
            Recommended. Pay with Apple Pay or Google Pay — no account needed.
          </p>
        ) : (
          <p className="text-gray-300/80 text-xs leading-relaxed">
            Pay with Apple Pay or Google Pay — no account needed. Outside the US,{' '}
            <button
              type="button"
              onClick={() => handleSetProvider('moonpay')}
              className="underline font-semibold text-emerald-300 hover:text-emerald-200"
            >
              MoonPay
            </button>{' '}
            usually has better coverage — switch if Coinbase doesn&apos;t work for you.
          </p>
        )
      ) : (
        <p className="text-gray-300/80 text-xs leading-relaxed">
          {isUS
            ? 'Pay with a debit/credit card, Apple Pay, Google Pay, or bank transfer — no account needed.'
            : 'Recommended for your region. Pay with a debit/credit card, Apple Pay, Google Pay, or bank transfer — no account needed.'}
        </p>
      )}
    </div>
  )

  return (
    <div
      className={`${shellWidthClass} bg-gradient-to-br from-gray-900 via-blue-900/30 to-purple-900/20 backdrop-blur-xl border border-white/10 rounded-2xl shadow-2xl text-white overflow-hidden`}
    >
      {/* Selected provider (embedded so it shares this single card). The
          provider selector renders inside, just below the "Fund Wallet" header. */}
      {provider === 'moonpay' ? (
        <MoonPayOnramp
          embedded
          fullWidth
          headerSlot={providerSelector}
          address={address}
          selectedChain={selectedChain}
          ethAmount={ethAmount}
          isWaitingForGasEstimate={isWaitingForGasEstimate}
          onExit={onExit}
          onBeforeOpen={onMoonPayBeforeOpen}
          onPurchaseSubmitted={onMoonPayPurchaseSubmitted}
          checkBalanceSufficient={checkBalanceSufficient}
          onBalanceSufficient={onBalanceSufficient}
          refetchBalance={refetchBalance}
          pollIntervalMs={pollIntervalMs}
          pollMaxMinutes={pollMaxMinutes}
        />
      ) : (
        <CBOnramp
          embedded
          fullWidth
          headerSlot={providerSelector}
          address={address}
          selectedChain={selectedChain}
          ethAmount={ethAmount}
          isWaitingForGasEstimate={isWaitingForGasEstimate}
          onExit={onExit}
          allowAmountInput={allowAmountInput}
          onQuoteCalculated={onCoinbaseQuoteCalculated}
          onBeforeNavigate={onCoinbaseBeforeNavigate}
          redirectUrl={coinbaseRedirectUrl}
          onUnsupported={() => handleSetProvider('moonpay')}
        />
      )}
    </div>
  )
}
