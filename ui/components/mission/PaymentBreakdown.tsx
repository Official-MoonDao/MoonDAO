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
  console.log('coinbaseTotalFees', coinbaseTotalFees)
  return (
    <div className="bg-gray-500/5 border border-gray-500/20 rounded-lg p-4">
      <p className="text-white text-sm font-semibold mb-3">Payment Breakdown</p>
      <div className="space-y-2">
        {/* Contribution */}
        <div className="flex items-center justify-between text-sm">
          <p className="text-gray-300">Contribution</p>
          <p className="text-white">${usdInput} USD</p>
        </div>

        {/* Cross-Chain Fee */}
        {chainSlug !== defaultChainSlug && !layerZeroLimitExceeded && (
          <div className="flex items-center justify-between text-sm">
            <p className="text-orange-300">Cross-Chain Fee</p>
            {!isLoadingGasEstimate && layerZeroFeeDisplay.usd !== '0.00' ? (
              <p className="text-orange-400 font-medium">
                ~${layerZeroFeeDisplay.usd} USD
              </p>
            ) : (
              <LoadingSpinner className="scale-50" />
            )}
          </div>
        )}

        {/* Gas Fee */}
        {showEstimatedGas && (
          <div className="flex items-center justify-between text-sm">
            <p className="text-gray-300">Gas Fee</p>
            {!isLoadingGasEstimate && gasCostDisplay.eth !== '0.0000' ? (
              <p className="text-gray-400">~${gasCostDisplay.usd} USD</p>
            ) : (
              <LoadingSpinner className="scale-50" />
            )}
          </div>
        )}

        {/* Coinbase Fees */}
        {coinbaseTotalFees && (
          <div className="flex items-center justify-between text-sm">
            <p className="text-gray-300">Coinbase Fees</p>
            <p className="text-gray-400">
              ~${coinbaseTotalFees.toFixed(2)} USD
            </p>
          </div>
        )}

        {!showCurrentBalance && !showTotalToBuy && (
          <>
            {/* Divider */}
            <div className="border-t border-gray-500/30 my-2"></div>

            {/* Total Required - for users with enough balance */}
            {requiredEth > 0 && (
              <div className="flex items-center justify-between">
                <p className="text-white text-base font-semibold">
                  Total Required
                </p>
                <div className="text-right">
                  <p className="text-blue-400 text-base font-bold">
                    ~${(requiredEth * ethUsdPrice).toFixed(2)} USD
                  </p>
                  <p className="text-blue-300 text-xs">
                    ~{requiredEth.toFixed(6)} ETH
                  </p>
                </div>
              </div>
            )}
          </>
        )}

        {/* For users with some balance who need to buy more */}
        {showCurrentBalance && (
          <>
            {/* Current Balance */}
            <div className="flex items-center justify-between text-sm">
              <p className="text-blue-300">Current Balance</p>
              <p className="text-blue-400">
                ${((nativeBalance || 0) * ethUsdPrice).toFixed(2)} USD
              </p>
            </div>

            {/* Divider */}
            <div className="border-t border-gray-500/30 my-2"></div>

            {/* Need to Buy */}
            {showNeedToBuy && requiredEth > (nativeBalance || 0) && (
              <div className="flex items-center justify-between">
                <p className="text-white text-base font-semibold">
                  Need to Pay
                </p>
                <div className="text-right">
                  <p className="text-green-400 text-base font-bold">
                    $
                    {coinbasePaymentTotal
                      ? coinbasePaymentTotal.toFixed(2)
                      : (
                          requiredEth * ethUsdPrice -
                          (nativeBalance || 0) * ethUsdPrice
                        ).toFixed(2)}{' '}
                    USD
                  </p>
                  <p className="text-green-300 text-xs">
                    {coinbaseEthReceive ? (
                      <>
                        You'll receive at least {coinbaseEthReceive.toFixed(8)}{' '}
                        ETH
                      </>
                    ) : (
                      <>
                        ~
                        {(
                          (requiredEth * ethUsdPrice -
                            (nativeBalance || 0) * ethUsdPrice) /
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
            <div className="flex items-center justify-between">
              <p className="text-white text-base font-semibold">Total to Buy</p>
              <div className="text-right">
                <p className="text-green-400 text-base font-bold">
                  ~$
                  {requiredEth && ethUsdPrice
                    ? (requiredEth * ethUsdPrice).toFixed(2)
                    : '0.00'}{' '}
                  USD
                </p>
                <p className="text-green-300 text-xs">
                  ~{requiredEth ? requiredEth.toFixed(6) : '0.000000'} ETH
                </p>
              </div>
            </div>
          </>
        )}

        {/* Minimum adjustment notice */}
        {isAdjustedForMinimum && (
          <p className="text-blue-300 text-xs pt-2">
            * Adjusted to Coinbase's $2 minimum. Extra ETH can be used for
            future transactions.
          </p>
        )}

        {/* For minimum purchase with no balance */}
        {showTotalToBuy &&
          parseFloat(usdInput.replace(/,/g, '')) < 2 &&
          !isAdjustedForMinimum && (
            <p className="text-blue-300 text-xs pt-2">
              * Adjusted to Coinbase's $2 minimum. Extra ETH can be used for
              future transactions.
            </p>
          )}
      </div>
    </div>
  )
}
