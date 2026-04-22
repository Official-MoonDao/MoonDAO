import { formatUnits } from 'ethers/lib/utils'
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
  /** When set with `nativeBalanceWei`, deficit math uses exact wei (avoids float threshold bugs). */
  requiredWei?: bigint | null
  ethUsdPrice: number
  nativeBalance?: number | null
  nativeBalanceWei?: bigint | null
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
  requiredWei = null,
  ethUsdPrice,
  nativeBalance,
  nativeBalanceWei = null,
  showCurrentBalance = false,
  showNeedToBuy = false,
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

  const totalAmountPending = isLoadingGasEstimate && (hasCrossChainRow || hasGasRow)

  const showOnchainFeesDisclaimer = crossChainFeeUsd > 0 || gasFeeUsd > 0

  const nativeBal = nativeBalance ?? 0
  const useWeiFunding =
    nativeBalanceWei != null &&
    requiredWei != null &&
    nativeBalanceWei >= BigInt(0) &&
    requiredWei >= BigInt(0)
  const hasEthDeficit = useWeiFunding
    ? nativeBalanceWei < requiredWei
    : requiredEth > nativeBal

  const nativeBalEthForDisplay = useWeiFunding
    ? parseFloat(formatUnits(nativeBalanceWei.toString(), 18))
    : nativeBal

  const deficitEth =
    useWeiFunding && nativeBalanceWei < requiredWei
      ? parseFloat(formatUnits((requiredWei - nativeBalanceWei).toString(), 18))
      : Math.max(0, requiredEth - nativeBal)

  const fundingMode = (showCurrentBalance && hasEthDeficit) || showTotalToBuy

  const needToPayUsd = coinbasePaymentTotal
    ? coinbasePaymentTotal.toFixed(2)
    : (deficitEth * ethUsdPrice).toFixed(2)

  const needToPayEthEstimate =
    coinbaseEthReceive != null
      ? coinbaseEthReceive.toFixed(8)
      : deficitEth.toFixed(6)

  const rowLabelClass = fundingMode
    ? 'text-sm text-gray-400 leading-relaxed'
    : 'text-sm text-gray-300 leading-relaxed'

  const rowValueClass = fundingMode
    ? 'text-sm text-white/95 leading-relaxed text-right tabular-nums'
    : 'text-sm text-gray-300 leading-relaxed text-right tabular-nums'

  const shellClass = fundingMode
    ? 'rounded-xl border border-cyan-500/25 bg-slate-950/90 ring-1 ring-cyan-500/10 shadow-lg shadow-black/30 p-5'
    : 'bg-gray-500/5 border border-gray-500/20 rounded-lg p-4'

  const costsInsetClass = fundingMode
    ? 'rounded-lg bg-black/30 border border-white/[0.06] p-3.5 space-y-2.5'
    : ''

  return (
    <div className={shellClass}>
      <div className={fundingMode ? 'mb-4' : 'mb-3'}>
        <p className="text-white font-semibold text-sm uppercase tracking-wider">
          Payment Breakdown
        </p>
        {fundingMode && (
          <p className="text-gray-500 text-xs mt-1.5 leading-relaxed">
            Estimated costs for this contribution, then how much to add so your wallet can cover it.
          </p>
        )}
      </div>

      <div className={fundingMode ? `${costsInsetClass} space-y-2.5` : 'space-y-2'}>
        {/* Contribution */}
        <div className="flex items-center justify-between gap-3">
          <p className={rowLabelClass}>Contribution</p>
          <p className={rowValueClass}>${usdInput} USD</p>
        </div>

        {/* Cross-Chain Fee. Spinner is gated on `isLoadingGasEstimate`
            ONLY — previously it also required a non-zero fee value, which
            meant any time the LayerZero quote failed/timed out (e.g. slow
            Ethereum RPC) the value stayed at "0.00" forever and the
            spinner spun indefinitely even though loading was done. After
            loading finishes we render whatever value we have, falling back
            to a "—" placeholder when no quote was retrieved so users see
            the breakdown progress instead of an apparent hang. */}
        {chainSlug !== defaultChainSlug && !layerZeroLimitExceeded && (
          <div className="flex items-center justify-between gap-3">
            <p className={rowLabelClass}>Cross-chain fee</p>
            {isLoadingGasEstimate ? (
              <LoadingSpinner className="scale-50" />
            ) : layerZeroFeeDisplay.usd !== '0.00' ? (
              <p className={rowValueClass}>~${layerZeroFeeDisplay.usd} USD</p>
            ) : (
              <p className={`${rowValueClass} text-gray-500`}>—</p>
            )}
          </div>
        )}

        {/* Gas Fee. Same spinner-gate rationale as the cross-chain row
            above — only spin while we're actively loading, then show the
            value (or a "—" placeholder if the estimator returned nothing). */}
        {showEstimatedGas && (
          <div className="flex items-center justify-between gap-3">
            <p className={rowLabelClass}>Gas fee</p>
            {isLoadingGasEstimate ? (
              <LoadingSpinner className="scale-50" />
            ) : gasCostDisplay.eth !== '0.0000' ? (
              <p className={rowValueClass}>~${gasCostDisplay.usd} USD</p>
            ) : (
              <p className={`${rowValueClass} text-gray-500`}>—</p>
            )}
          </div>
        )}

        {/* Coinbase Fees */}
        {coinbaseTotalFees ? (
          <div className="flex items-center justify-between gap-3">
            <p className={rowLabelClass}>Coinbase fees (est.)</p>
            <p className={rowValueClass}>~${coinbaseTotalFees.toFixed(2)} USD</p>
          </div>
        ) : null}

        {!showTotalToBuy && (
          <>
            <div
              className={
                fundingMode
                  ? 'border-t border-white/10 pt-2.5 mt-0.5'
                  : 'border-t border-gray-500/30 my-2'
              }
            />
            <div className="flex items-center justify-between gap-3">
              <p
                className={
                  fundingMode
                    ? 'text-gray-300 font-medium text-xs uppercase tracking-wider'
                    : 'text-gray-300 font-medium text-sm uppercase tracking-wider'
                }
              >
                Est. total (USD)
              </p>
              <div className="text-right">
                {totalAmountPending ? (
                  <LoadingSpinner className="scale-50 ml-auto" />
                ) : (
                  <p
                    className={
                      fundingMode
                        ? 'text-base text-white font-semibold tabular-nums'
                        : 'text-sm text-gray-300 leading-relaxed font-medium tabular-nums'
                    }
                  >
                    ~${totalUsd.toFixed(2)}
                  </p>
                )}
              </div>
            </div>
            {showOnchainFeesDisclaimer && (
              <p
                className={
                  fundingMode
                    ? 'text-xs text-gray-500 leading-relaxed pt-1'
                    : 'text-sm text-gray-300 leading-relaxed'
                }
              >
                Onchain fees are not collected by MoonDAO.
              </p>
            )}
          </>
        )}
      </div>

      {/* For users with some balance who need to buy more */}
      {showCurrentBalance && hasEthDeficit && (
        <div className={fundingMode ? 'mt-5 pt-5 border-t border-white/10 space-y-4' : 'mt-2'}>
          {!fundingMode && (
            <>
              <div className="flex items-center justify-between gap-3">
                <p className={rowLabelClass}>Current Balance</p>
                <p className="text-sm text-gray-300 leading-relaxed text-right tabular-nums">
                  ${(nativeBalEthForDisplay * ethUsdPrice).toFixed(2)} USD
                </p>
              </div>
              <div className="border-t border-gray-500/30 my-2" />
            </>
          )}

          {fundingMode && (
            <div className="flex items-center justify-between gap-3 text-sm">
              <div>
                <p className="text-gray-500 text-xs uppercase tracking-wide mb-0.5">Your wallet</p>
                <p className="text-gray-300">Available now</p>
              </div>
              <div className="text-right">
                <p className="text-white font-medium tabular-nums">
                  ${(nativeBalEthForDisplay * ethUsdPrice).toFixed(2)}
                </p>
                <p className="text-gray-500 text-xs tabular-nums mt-0.5">
                  {nativeBalEthForDisplay.toFixed(6)} ETH
                </p>
              </div>
            </div>
          )}

          {showNeedToBuy && hasEthDeficit && (
            <>
              {!fundingMode && (
                <div className="flex items-center justify-between gap-3">
                  <p className="text-gray-300 font-medium text-sm uppercase tracking-wider">
                    Need to Pay
                  </p>
                  <div className="text-right">
                    <p className="text-sm text-gray-300 leading-relaxed font-medium tabular-nums">
                      ${needToPayUsd} USD
                    </p>
                    <p className="text-sm text-gray-300 leading-relaxed tabular-nums">
                      {coinbaseEthReceive != null ? (
                        <>You&apos;ll receive at least {coinbaseEthReceive.toFixed(8)} ETH</>
                      ) : (
                        <>~{needToPayEthEstimate} ETH</>
                      )}
                    </p>
                  </div>
                </div>
              )}

              {fundingMode && (
                <div className="rounded-xl bg-gradient-to-br from-blue-600/25 via-violet-600/15 to-slate-900/50 border border-blue-500/35 p-4 shadow-inner shadow-black/20">
                  <p className="text-[11px] font-semibold uppercase tracking-wider text-blue-200/90 mb-2">
                    Add via Coinbase (below)
                  </p>
                  <div className="flex flex-col sm:flex-row sm:items-baseline sm:justify-between gap-1 sm:gap-4">
                    <p className="text-2xl sm:text-3xl font-bold text-white tabular-nums tracking-tight">
                      ${needToPayUsd}
                      <span className="text-lg font-semibold text-gray-400 ml-1.5">USD</span>
                    </p>
                    <p className="text-sm text-cyan-100/90 tabular-nums sm:text-right">
                      {coinbaseEthReceive != null ? (
                        <>At least {coinbaseEthReceive.toFixed(8)} ETH</>
                      ) : (
                        <>~{needToPayEthEstimate} ETH</>
                      )}
                    </p>
                  </div>
                  <p className="text-xs text-gray-400 mt-3 leading-relaxed">
                    Quote updates as fees load. You&apos;ll complete purchase in the Fund step.
                  </p>
                  {coinbaseEthInsufficient && (
                    <p className="text-xs text-amber-200/90 mt-2 leading-relaxed border-t border-amber-500/20 pt-2">
                      This purchase may still leave you slightly short of the full amount needed for
                      gas—try adding a small buffer or retry after the quote refreshes.
                    </p>
                  )}
                </div>
              )}
            </>
          )}
        </div>
      )}

      {/* For users with no balance */}
      {showTotalToBuy && (
        <div className={fundingMode ? 'mt-5 pt-5 border-t border-white/10' : ''}>
          <div
            className={
              fundingMode
                ? 'rounded-xl bg-gradient-to-br from-blue-600/25 via-violet-600/15 to-slate-900/50 border border-blue-500/35 p-4 shadow-inner shadow-black/20'
                : ''
            }
          >
            {!fundingMode && <div className="border-t border-gray-500/30 my-2" />}
            <div className="flex items-center justify-between gap-3">
              <p
                className={
                  fundingMode
                    ? 'text-[11px] font-semibold uppercase tracking-wider text-blue-200/90'
                    : 'text-gray-300 font-medium text-sm uppercase tracking-wider'
                }
              >
                {fundingMode ? 'Total to purchase' : 'Total to Buy'}
              </p>
              {!fundingMode && (
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
              )}
            </div>
            {fundingMode && (
              <div className="flex flex-col sm:flex-row sm:items-baseline sm:justify-between gap-1 sm:gap-4 mt-2">
                <p className="text-2xl sm:text-3xl font-bold text-white tabular-nums tracking-tight">
                  ~
                  {requiredEth && ethUsdPrice
                    ? (requiredEth * ethUsdPrice).toFixed(2)
                    : '0.00'}
                  <span className="text-lg font-semibold text-gray-400 ml-1.5">USD</span>
                </p>
                <p className="text-sm text-cyan-100/90 tabular-nums sm:text-right">
                  ~{requiredEth ? requiredEth.toFixed(6) : '0.000000'} ETH
                </p>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Minimum adjustment notice */}
      {isAdjustedForMinimum && (
        <p
          className={
            fundingMode
              ? 'text-xs text-gray-500 leading-relaxed pt-4'
              : 'text-sm text-gray-300 leading-relaxed pt-2'
          }
        >
          * Adjusted to Coinbase&apos;s $2 minimum. Extra ETH can be used for future transactions.
        </p>
      )}

      {showTotalToBuy &&
        parseFloat(usdInput.replace(/,/g, '')) < 2 &&
        !isAdjustedForMinimum && (
          <p
            className={
              fundingMode
                ? 'text-xs text-gray-500 leading-relaxed pt-2'
                : 'text-sm text-gray-300 leading-relaxed pt-2'
            }
          >
            * Adjusted to Coinbase&apos;s $2 minimum. Extra ETH can be used for future transactions.
          </p>
        )}
    </div>
  )
}
