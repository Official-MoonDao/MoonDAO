interface MissionContributeStatusNoticesProps {
  onrampSuccess: boolean
  transactionRejected: boolean
  hasEnoughBalance: boolean
  ethDeficit: number
}

export function MissionContributeStatusNotices({
  onrampSuccess,
  transactionRejected,
  hasEnoughBalance,
  ethDeficit,
}: MissionContributeStatusNoticesProps) {
  return (
    <>
      {onrampSuccess && !transactionRejected && hasEnoughBalance && (
        <div className="bg-green-500/10 border border-green-500/30 rounded-lg p-4">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 bg-green-500/20 rounded-full flex items-center justify-center">
              <span className="text-green-400 text-lg">✓</span>
            </div>
            <div>
              <p className="text-green-300 font-semibold text-sm">ETH Purchase Successful!</p>
              <p className="text-green-200/80 text-xs mt-1">Ready to contribute to the mission</p>
            </div>
          </div>
        </div>
      )}

      {onrampSuccess && !transactionRejected && !hasEnoughBalance && ethDeficit > 0 && (
        <div className="bg-orange-500/10 border border-orange-500/30 rounded-lg p-4">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 bg-orange-500/20 rounded-full flex items-center justify-center">
              <span className="text-orange-400 text-lg">⚠️</span>
            </div>
            <div>
              <p className="text-orange-300 font-semibold text-sm">Additional ETH Required</p>
              <p className="text-orange-200/80 text-xs mt-1">
                You still need {ethDeficit.toFixed(6)} ETH to complete this contribution. Please
                purchase ETH below.
              </p>
            </div>
          </div>
        </div>
      )}

      {transactionRejected && (
        <div className="bg-orange-500/10 border border-orange-500/30 rounded-lg p-4">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 bg-orange-500/20 rounded-full flex items-center justify-center">
              <span className="text-orange-400 text-lg">⚠️</span>
            </div>
            <div>
              <p className="text-orange-300 font-semibold text-sm">Transaction Rejected</p>
              <p className="text-orange-200/80 text-xs mt-1">
                Review the details below and try again when ready
              </p>
            </div>
          </div>
        </div>
      )}
    </>
  )
}

