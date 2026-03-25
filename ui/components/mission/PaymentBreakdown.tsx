import { LoadingSpinner } from '../layout/LoadingSpinner'

type PaymentBreakdownProps = {
  usdInput: string
  chainSlug: string
  defaultChainSlug: string
  layerZeroLimitExceeded: boolean
  isLoadingGasEstimate: boolean
  layerZeroFeeDisplay: { eth: string; usd: string }
  showEstimatedGas: boolean
  gasCostDisplay: { eth: string; usd: string }
  requiredEth: number
  ethUsdPrice: number
  nativeBalance?: number | null
  showCurrentBalance?: boolean
  showNeedToBuy?: boolean
  coinbasePaymentSubtotal?: number
  coinbaseEthReceive?: number | null
  isAdjustedForMinimum?: boolean
  coinbaseEthInsufficient?: boolean
  showTotalToBuy?: boolean
  coinbaseTotalFees?: number
  coinbasePaymentTotal?: number
}

export function PaymentBreakdown({
  usdInput,
  chainSlug,
  defaultChainSlug,
  layerZeroLimitExceeded,
  isLoadingGasEstimate,
  layerZeroFeeDisplay,
  showEstimatedGas,
  gasCostDisplay,
  requiredEth,
  ethUsdPrice,
  nativeBalance,
  showCurrentBalance = false,
  showNeedToBuy = false,
  coinbasePaymentSubtotal,
  coinbaseEthReceive,
  isAdjustedForMinimum = false,
  coinbaseEthInsufficient = false,
  showTotalToBuy = false,
  coinbaseTotalFees,
  coinbasePaymentTotal,
}: PaymentBreakdownProps) {
  const contributionUsd = parseFloat(usdInput.replace(/,/g, '')) || 0

  const hasCrossChainRow = chainSlug !== defaultChainSlug && !layerZeroLimitExceeded
  const crossChainReady =
    hasCrossChainRow && !isLoadingGasEstimate && layerZeroFeeDisplay.usd !== '0.00'
  const crossChainFeeUsd = crossChainReady ? parseFloat(layerZeroFeeDisplay.usd) || 0 : 0

  const hasGasRow = showEstimatedGas
  const gasReady = hasGasRow && !isLoadingGasEstimate && gasCostDisplay.eth !== '0.0000'
  const gasFeeUsd = gasReady ? parseFloat(gasCostDisplay.usd) || 0 : 0

  const coinbaseFeesUsd = coinbaseTotalFees ?? 0

  const totalUsd = contributionUsd + crossChainFeeUsd + gasFeeUsd + coinbaseFeesUsd

  const totalAmountPending =
    isLoadingGasEstimate && (hasCrossChainRow || hasGasRow)

  const showOnchainFeesDisclaimer = crossChainFeeUsd > 0 || gasFeeUsd > 0

  const nativeBal = nativeBalance ?? 0
  const hasEthDeficit = requiredEth > nativeBal

  const rowLabelClass = 'text-sm text-gray-300 leading-relaxed'

  return (
    <div className="bg-gray-500/5 border border-gray-500/20 rounded-lg p-4">
      <p className="text-gray-300 font-medium text-sm uppercase tracking-wider mb-3">
        Payment Breakdown
      </p>
      <div className="space-y-2">
        {/* Contribution */}
        <div className="flex items-center justify-between gap-3">
          <p className={rowLabelClass}>Contribution</p>
          <p className="text-sm text-gray-300 leading-relaxed text-right tabular-nums">
            ${usdInput} USD
          </p>
        </div>

        {/* Cross-Chain Fee */}
        {chainSlug !== defaultChainSlug && !layerZeroLimitExceeded && (
          <div className="flex items-center justify-between gap-3">
            <p className={rowLabelClass}>Cross-Chain Fee</p>
            {!isLoadingGasEstimate && layerZeroFeeDisplay.usd !== '0.00' ? (
              <p className="text-sm text-gray-300 leading-relaxed text-right tabular-nums">
                ~${layerZeroFeeDisplay.usd} USD
              </p>
            ) : (
              <LoadingSpinner className="scale-50" />
            )}
          </div>
        )}

        {/* Gas Fee */}
        {showEstimatedGas && (
          <div className="flex items-center justify-between gap-3">
            <p className={rowLabelClass}>Gas Fee</p>
            {!isLoadingGasEstimate && gasCostDisplay.eth !== '0.0000' ? (
              <p className="text-sm text-gray-300 leading-relaxed text-right tabular-nums">
                ~${gasCostDisplay.usd} USD
              </p>
            ) : (
              <LoadingSpinner className="scale-50" />
            )}
          </div>
        )}

        {/* Coinbase Fees */}
        {coinbaseTotalFees && (
          <div className="flex items-center justify-between gap-3">
            <p className={rowLabelClass}>Coinbase Fees</p>
            <p className="text-sm text-gray-300 leading-relaxed text-right tabular-nums">
              ~${coinbaseTotalFees.toFixed(2)} USD
            </p>
          </div>
        )}

        {!showTotalToBuy && (
          <>
            <div className="border-t border-gray-500/30 my-2"></div>
            <div className="flex items-center justify-between gap-3">
              <p className="text-gray-300 font-medium text-sm uppercase tracking-wider">
                Total:
              </p>
              <div className="text-right">
                {totalAmountPending ? (
                  <LoadingSpinner className="scale-50 ml-auto" />
                ) : (
                  <p className="text-sm text-gray-300 leading-relaxed font-medium tabular-nums">
                    ~${totalUsd.toFixed(2)} USD
                  </p>
                )}
              </div>
            </div>
            {showOnchainFeesDisclaimer && (
              <p className="text-sm text-gray-300 leading-relaxed">
                Onchain fees are not collected by MoonDAO.
              </p>
            )}
          </>
        )}

        {/* For users with some balance who need to buy more */}
        {showCurrentBalance && hasEthDeficit && (
          <>
            <div className="flex items-center justify-between gap-3">
              <p className={rowLabelClass}>Current Balance</p>
              <p className="text-sm text-gray-300 leading-relaxed text-right tabular-nums">
                ${(nativeBal * ethUsdPrice).toFixed(2)} USD
              </p>
            </div>

            <div className="border-t border-gray-500/30 my-2"></div>

            {/* Need to Buy */}
            {showNeedToBuy && requiredEth > nativeBal && (
              <div className="flex items-center justify-between gap-3">
                <p className="text-gray-300 font-medium text-sm uppercase tracking-wider">
                  Need to Pay
                </p>
                <div className="text-right">
                  <p className="text-sm text-gray-300 leading-relaxed font-medium tabular-nums">
                    $
                    {coinbasePaymentTotal
                      ? coinbasePaymentTotal.toFixed(2)
                      : (requiredEth * ethUsdPrice - nativeBal * ethUsdPrice).toFixed(2)}{' '}
                    USD
                  </p>
                  <p className="text-sm text-gray-300 leading-relaxed tabular-nums">
                    {coinbaseEthReceive ? (
                      <>
                        You'll receive at least {coinbaseEthReceive.toFixed(8)}{' '}
                        ETH
                      </>
                    ) : (
                      <>
                        ~
                        {(
                          (requiredEth * ethUsdPrice - nativeBal * ethUsdPrice) /
                          ethUsdPrice
                        ).toFixed(6)}{' '}
                        ETH
                      </>
                    )}
                  </p>
                </div>
              </div>
            )}
          </>
        )}

        {/* For users with no balance */}
        {showTotalToBuy && (
          <>
            {/* Divider */}
            <div className="border-t border-gray-500/30 my-2"></div>

            {/* Total to Buy */}
            <div className="flex items-center justify-between gap-3">
              <p className="text-gray-300 font-medium text-sm uppercase tracking-wider">
                Total to Buy
              </p>
              <div className="text-right">
                <p className="text-sm text-gray-300 leading-relaxed font-medium tabular-nums">
                  ~$
                  {requiredEth && ethUsdPrice
                    ? (requiredEth * ethUsdPrice).toFixed(2)
                    : '0.00'}{' '}
                  USD
                </p>
                <p className="text-sm text-gray-300 leading-relaxed tabular-nums">
                  ~{requiredEth ? requiredEth.toFixed(6) : '0.000000'} ETH
                </p>
              </div>
            </div>
          </>
        )}

        {/* Minimum adjustment notice */}
        {isAdjustedForMinimum && (
          <p className="text-sm text-gray-300 leading-relaxed pt-2">
            * Adjusted to Coinbase's $2 minimum. Extra ETH can be used for
            future transactions.
          </p>
        )}

        {/* For minimum purchase with no balance */}
        {showTotalToBuy &&
          parseFloat(usdInput.replace(/,/g, '')) < 2 &&
          !isAdjustedForMinimum && (
            <p className="text-sm text-gray-300 leading-relaxed pt-2">
              * Adjusted to Coinbase's $2 minimum. Extra ETH can be used for
              future transactions.
            </p>
          )}
      </div>
    </div>
  )
}
