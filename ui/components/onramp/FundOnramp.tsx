import { useState } from 'react'
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
  /** Which provider is selected first. Defaults to MoonPay (recommended). */
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
 * Combined fiat onramp that leads with MoonPay (recommended for everyone — no
 * account required) and offers Coinbase as a secondary option for users who
 * already have a Coinbase account. Coinbase's onramp is deprecated June 30,
 * 2026, so MoonPay is the default.
 */
export function FundOnramp({
  address,
  selectedChain,
  ethAmount,
  fullWidth = false,
  isWaitingForGasEstimate = false,
  onExit,
  defaultProvider = 'moonpay',
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
  const [provider, setProvider] = useState<OnrampProvider>(defaultProvider)
  const shellWidthClass = fullWidth ? 'w-full' : 'w-full max-w-md mx-auto'

  return (
    <div
      className={`${shellWidthClass} bg-gradient-to-br from-gray-900 via-blue-900/30 to-purple-900/20 backdrop-blur-xl border border-white/10 rounded-2xl shadow-2xl text-white overflow-hidden`}
    >
      {/* Provider selector */}
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
            onClick={() => setProvider('moonpay')}
            aria-pressed={provider === 'moonpay'}
            className={`relative flex flex-col items-start gap-1 rounded-xl border p-3 text-left transition-all duration-200 ${
              provider === 'moonpay'
                ? 'border-indigo-400/60 bg-indigo-500/15 ring-2 ring-indigo-500/40'
                : 'border-white/10 bg-white/5 hover:bg-white/10'
            }`}
          >
            <span className="text-sm font-semibold text-white">MoonPay</span>
            <span className="text-[10px] font-semibold uppercase tracking-wide text-emerald-300">
              Recommended
            </span>
          </button>
          <button
            type="button"
            data-testid="onramp-select-coinbase"
            onClick={() => setProvider('coinbase')}
            aria-pressed={provider === 'coinbase'}
            className={`relative flex flex-col items-start gap-1 rounded-xl border p-3 text-left transition-all duration-200 ${
              provider === 'coinbase'
                ? 'border-blue-400/60 bg-blue-500/15 ring-2 ring-blue-500/40'
                : 'border-white/10 bg-white/5 hover:bg-white/10'
            }`}
          >
            <span className="text-sm font-semibold text-white">Coinbase</span>
            <span className="text-[10px] font-semibold uppercase tracking-wide text-gray-400">
              Have an account?
            </span>
          </button>
        </div>

        {provider === 'coinbase' ? (
          <div className="bg-amber-500/10 border border-amber-400/30 rounded-lg p-3">
            <p className="text-amber-200/90 text-xs leading-relaxed">
              <strong>Only choose Coinbase if you already have a Coinbase account.</strong> If you
              don&apos;t, switch to{' '}
              <button
                type="button"
                onClick={() => setProvider('moonpay')}
                className="underline font-semibold text-emerald-300 hover:text-emerald-200"
              >
                MoonPay
              </button>{' '}
              — no account needed, just a debit/credit card, Apple Pay, or Google Pay.
            </p>
          </div>
        ) : (
          <p className="text-gray-300/80 text-xs leading-relaxed">
            Recommended for everyone. Pay with a debit/credit card, Apple Pay, Google Pay, or bank
            transfer — no account required.
          </p>
        )}
      </div>

      {/* Selected provider (embedded so it shares this single card) */}
      {provider === 'moonpay' ? (
        <MoonPayOnramp
          embedded
          fullWidth
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
          address={address}
          selectedChain={selectedChain}
          ethAmount={ethAmount}
          isWaitingForGasEstimate={isWaitingForGasEstimate}
          onExit={onExit}
          allowAmountInput={allowAmountInput}
          onQuoteCalculated={onCoinbaseQuoteCalculated}
          onBeforeNavigate={onCoinbaseBeforeNavigate}
          redirectUrl={coinbaseRedirectUrl}
        />
      )}
    </div>
  )
}
