import { MoonPayOnramp } from '../moonpay/MoonPayOnramp'

export type OnrampProvider = 'moonpay' | 'coinbase'

interface FundOnrampProps {
  address: string
  selectedChain: any
  ethAmount: number
  fullWidth?: boolean
  isWaitingForGasEstimate?: boolean
  onExit?: () => void
  /** Retained for API compatibility; MoonPay is currently the only provider. */
  defaultProvider?: OnrampProvider

  // MoonPay-specific
  onMoonPayBeforeOpen?: () => Promise<void>
  onMoonPayPurchaseSubmitted?: () => void
  checkBalanceSufficient?: () => Promise<boolean>
  onBalanceSufficient?: () => void
  refetchBalance?: () => Promise<void>
  pollIntervalMs?: number
  pollMaxMinutes?: number

  // Coinbase-specific (accepted for API compatibility, currently unused while
  // the Coinbase Headless Onramp awaits Apple Pay domain verification).
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
 * Fiat onramp. Uses MoonPay (via Privy's in-app fiat onramp) as the single
 * provider. Coinbase Headless Onramp ships separately once Apple Pay domain
 * verification is approved.
 */
export function FundOnramp({
  address,
  selectedChain,
  ethAmount,
  fullWidth = false,
  isWaitingForGasEstimate = false,
  onExit,
  onMoonPayBeforeOpen,
  onMoonPayPurchaseSubmitted,
  checkBalanceSufficient,
  onBalanceSufficient,
  refetchBalance,
  pollIntervalMs,
  pollMaxMinutes,
}: FundOnrampProps) {
  const shellWidthClass = fullWidth ? 'w-full' : 'w-full max-w-md mx-auto'

  return (
    <div
      className={`${shellWidthClass} bg-gradient-to-br from-gray-900 via-blue-900/30 to-purple-900/20 backdrop-blur-xl border border-white/10 rounded-2xl shadow-2xl text-white overflow-hidden`}
    >
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
    </div>
  )
}
