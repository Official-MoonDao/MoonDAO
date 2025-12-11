import { LoadingSpinner } from '../layout/LoadingSpinner'
import ProgressBar from '../layout/ProgressBar'

interface MissionContributeAutoTriggeringViewProps {
  account: any
  isVerifyingJWT: boolean
  onrampJWTPayload: any
  getStoredJWT: () => string | null
  jwtVerificationError: string | null
  hasEnoughBalance: boolean
  isLoadingGasEstimate: boolean
  usdInput: string
  missionName?: string
  onDismissError: () => void
  router: any
  formatWithCommas: (value: string) => string
}

export function MissionContributeAutoTriggeringView({
  account,
  isVerifyingJWT,
  onrampJWTPayload,
  getStoredJWT,
  jwtVerificationError,
  hasEnoughBalance,
  isLoadingGasEstimate,
  usdInput,
  missionName,
  onDismissError,
  router,
  formatWithCommas,
}: MissionContributeAutoTriggeringViewProps) {
  return (
    <div className="flex flex-col items-center justify-center py-12 px-6 space-y-6">
      <div className="w-16 h-16 rounded-full bg-gradient-to-r from-blue-500 to-purple-600 flex items-center justify-center">
        <LoadingSpinner width="w-10" height="h-10" className="text-white" />
      </div>

      <div className="text-center space-y-2">
        <h3 className="text-xl font-semibold text-white">
          {!account
            ? 'Connecting Your Wallet'
            : isVerifyingJWT || (!onrampJWTPayload && getStoredJWT())
            ? 'Verifying Onramp Success'
            : jwtVerificationError
            ? 'Verification Failed'
            : !hasEnoughBalance || isLoadingGasEstimate
            ? 'Preparing Transaction'
            : 'Processing Your Contribution'}
        </h3>
        <p className="text-gray-300 text-sm max-w-md">
          {!account
            ? 'Please connect or unlock your wallet to continue'
            : isVerifyingJWT || (!onrampJWTPayload && getStoredJWT())
            ? 'Verifying your onramp session...'
            : jwtVerificationError
            ? jwtVerificationError
            : !hasEnoughBalance
            ? router?.query?.onrampSuccess === 'true'
              ? process.env.NEXT_PUBLIC_ENV === 'dev'
                ? 'Proceeding with transaction in dev mode...'
                : 'Refreshing balance after purchase...'
              : 'Verifying your balance...'
            : isLoadingGasEstimate
            ? 'Calculating gas fees...'
            : 'Please confirm the transaction in your wallet'}
        </p>
        {jwtVerificationError && (
          <button
            onClick={onDismissError}
            className="mt-4 px-4 py-2 bg-red-500/20 hover:bg-red-500/30 text-red-400 rounded-lg text-sm transition-colors"
          >
            Dismiss
          </button>
        )}
      </div>

      <div className="w-full max-w-md">
        <ProgressBar
          progress={!account ? 33 : !hasEnoughBalance || isLoadingGasEstimate ? 66 : 100}
          height="24px"
          label={
            !account
              ? 'Step 1/3: Wallet Connection'
              : !hasEnoughBalance || isLoadingGasEstimate
              ? 'Step 2/3: Preparing'
              : 'Step 3/3: Contributing'
          }
        />
      </div>

      <div className="bg-blue-500/10 border border-blue-500/30 rounded-lg p-4 w-full max-w-md">
        <div className="flex items-start gap-3">
          <div className="w-6 h-6 bg-blue-500/20 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5">
            <span className="text-blue-400 text-sm">💰</span>
          </div>
          <div className="text-left">
            <p className="text-blue-300 font-medium text-sm">
              Contributing ${formatWithCommas(usdInput)} USD
            </p>
            <p className="text-blue-200/80 text-xs mt-1">To {missionName}</p>
          </div>
        </div>
      </div>

      {!account && router?.isReady && (
        <div className="bg-orange-500/10 border border-orange-500/30 rounded-lg p-4 w-full max-w-md">
          <p className="text-orange-300 text-sm text-center">
            Your wallet is not connected. Please close this modal and connect your wallet to
            continue.
          </p>
        </div>
      )}
    </div>
  )
}

