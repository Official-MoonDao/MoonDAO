import JBV5MultiTerminal from 'const/abis/JBV5MultiTerminal.json'
import { DEFAULT_CHAIN_V5, JB_NATIVE_TOKEN_ADDRESS } from 'const/config'
import { JBRuleset } from 'juice-sdk-core'
import Image from 'next/image'
import Link from 'next/link'
import React, { useCallback, useContext, useEffect, useState } from 'react'
import toast from 'react-hot-toast'
import { prepareContractCall, sendAndConfirmTransaction, simulateTransaction } from 'thirdweb'
import { TransactionReceipt } from 'thirdweb/dist/types/transaction/types'
import { useActiveAccount } from 'thirdweb/react'
import useETHPrice from '@/lib/etherscan/useETHPrice'
import { calculateTokensFromPayment } from '@/lib/juicebox/tokenCalculations'
import { useMissionParticipantVolume } from '@/lib/juicebox/useMissionParticipantVolume'
import toastStyle from '@/lib/marketplace/marketplace-utils/toastConfig'
import { formatContributionOutput } from '@/lib/mission'
import { formatEthFiveSigFigs } from '@/lib/mission/formatEthFiveSigFigs'
import { computeContributionMaxUsd } from '@/lib/mission/computeContributionMaxUsd'
import useMissionFundingStage from '@/lib/mission/useMissionFundingStage'
import { getChainSlug } from '@/lib/thirdweb/chain'
import ChainContextV5 from '@/lib/thirdweb/chain-context-v5'
import useContract from '@/lib/thirdweb/hooks/useContract'
import { useNativeBalance } from '@/lib/thirdweb/hooks/useNativeBalance'
import useRead from '@/lib/thirdweb/hooks/useRead'
import useWatchTokenBalance from '@/lib/tokens/hooks/useWatchTokenBalance'
import MissionTokenSwapV4 from '@/components/uniswap/MissionTokenSwapV4'
import { LoadingSpinner } from '../layout/LoadingSpinner'
import Modal from '../layout/Modal'
import AcceptedPaymentMethods from '../privy/AcceptedPaymentMethods'
import { PrivyWeb3Button } from '../privy/PrivyWeb3Button'
import MissionActivityList from './MissionActivityList'
import MissionContributorTiersPanel from './MissionContributorTiersPanel'
import MissionTokenExchangeRates from './MissionTokenExchangeRates'

function formatContributedEth(eth: number): string {
  if (!Number.isFinite(eth) || eth <= 0) return '0'
  if (eth < 0.0001) return eth.toPrecision(4)
  return eth.toLocaleString('en-US', { maximumFractionDigits: 6 })
}

function MissionPayRedeemContent({
  mission,
  token,
  output,
  redeem,
  onOpenModal,
  tokenBalance,
  currentStage,
  stage,
  deadline,
  tokenCredit,
  claimTokenCredit,
  handleUsdInputChange,
  calculateEthAmount,
  formatTokenAmount,
  redeemAmount,
  isLoadingRedeemAmount,
  isLoadingEthUsdPrice,
  usdInput,
  setUsdInput,
  address,
  contributedEthWei,
  isLoadingContributedEth,
  ethUsdPrice,
  nativeBalance,
  nativeBalanceChain,
  applyMaxContribution,
  hideRecentContributions = false,
}: any) {
  const isRefundable = Number(stage) === 3
  const deadlineHasPassed = deadline ? deadline < Date.now() : false
  const shouldShowSwapOnly = deadlineHasPassed && Number(stage) === 2
  const contributedEth =
    contributedEthWei != null ? Number(contributedEthWei) / 1e18 : 0
  const showContributedRow =
    Boolean(address) &&
    (isLoadingContributedEth || contributedEth > 1e-12)
  const contributedUsdApprox =
    ethUsdPrice && contributedEth > 0 ? contributedEth * ethUsdPrice : null

  if (isRefundable && (!tokenCredit || tokenCredit <= 0) && (!tokenBalance || tokenBalance <= 0)) {
    return null
  }

  return (
    <div
      id="mission-pay-redeem-container"
      className="bg-gradient-to-br from-slate-900/90 via-slate-900/70 to-indigo-950/40 backdrop-blur-xl border border-white/[0.08] rounded-2xl w-full flex flex-col gap-4 lg:items-stretch shadow-2xl"
    >
      {shouldShowSwapOnly ? (
        <MissionTokenSwapV4 token={token} />
      ) : (
        !isRefundable && (
          <div id="mission-pay-container" className="p-5 flex flex-col">
            {/* You contribute — primary input; darker card so it reads as the main action */}
            <div className="space-y-2">
              <label
                htmlFor="usd-contribution-input"
                className="text-white font-semibold text-xs uppercase tracking-wider"
              >
                You contribute
              </label>
              <div className="bg-slate-950/90 border border-cyan-500/25 ring-1 ring-cyan-500/10 shadow-lg shadow-black/40 rounded-xl p-4 min-w-0">
                <div className="flex flex-col gap-4 min-w-0">
                  {/* ETH ↔ USD: side-by-side from md up, stacked on small screens */}
                  <div className="flex flex-col md:flex-row md:items-center gap-4 min-w-0">
                    <div className="flex items-center gap-3 min-w-0 md:flex-1">
                      <div className="w-9 h-9 shrink-0 bg-slate-800 rounded-full flex items-center justify-center ring-1 ring-white/15">
                        <Image
                          src="/coins/ETH.svg"
                          alt="ETH"
                          width={18}
                          height={18}
                        />
                      </div>
                      <div className="min-w-0">
                        <p className="font-bold text-white text-lg leading-tight break-all sm:break-normal">
                          {calculateEthAmount()}
                        </p>
                        <p className="text-gray-500 text-xs">ETH (estimated)</p>
                      </div>
                    </div>

                    <div className="flex min-w-0 w-full md:flex-1 items-center gap-2 rounded-lg px-3 py-2.5 border border-white/15 bg-black/50 shadow-inner">
                      <span className="text-cyan-200/80 text-lg font-bold shrink-0">$</span>
                      <input
                        id="usd-contribution-input"
                        type="text"
                        inputMode="decimal"
                        className="min-w-0 flex-1 bg-transparent border-none outline-none text-lg font-bold text-white text-right placeholder-gray-600 focus:placeholder-gray-500 focus:ring-0 ring-0 transition-colors duration-200 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                        value={usdInput}
                        onChange={handleUsdInputChange}
                        placeholder="0"
                        maxLength={15}
                      />
                      <span className="text-gray-300 text-lg font-bold shrink-0">USD</span>
                    </div>
                  </div>

                  <div className="pt-3 border-t border-white/[0.08] min-w-0 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                    <p className="text-gray-400 text-xs sm:text-sm leading-relaxed break-words min-w-0">
                      <span className="text-gray-500 uppercase tracking-wide mr-1">Balance</span>
                      <span className="text-white font-medium tabular-nums">
                        {nativeBalance != null && Number(nativeBalance) >= 0
                          ? `${formatEthFiveSigFigs(Number(nativeBalance))} ETH`
                          : '—'}
                      </span>
                      <span className="text-gray-500 text-[11px] sm:text-xs ml-1">
                        on {nativeBalanceChain?.name?.replace(' One', '') ?? 'network'}
                      </span>
                    </p>
                    <button
                      type="button"
                      onClick={applyMaxContribution}
                      disabled={
                        !address ||
                        nativeBalance == null ||
                        Number(nativeBalance) <= 0 ||
                        !ethUsdPrice ||
                        isLoadingEthUsdPrice
                      }
                      className="shrink-0 self-start sm:self-auto px-3 py-1.5 rounded-lg text-xs font-semibold uppercase tracking-wide bg-white/10 hover:bg-white/15 border border-white/15 text-white disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                    >
                      Max
                    </button>
                  </div>
                </div>
              </div>
            </div>

            {/* You receive — read-only quote; avoid bordered “field” so it doesn’t mirror the USD input */}
            <div className="mt-4 space-y-2">
              <p className="text-gray-500 font-medium text-xs uppercase tracking-wider">
                You receive
              </p>
              <div className="bg-white/[0.02] border border-white/[0.06] rounded-xl p-4 min-w-0">
                <div className="flex flex-col md:flex-row gap-4 items-stretch md:items-center justify-between min-w-0">
                  <div className="flex items-center gap-3 min-w-0 w-full md:w-auto md:flex-1">
                    <div className="w-9 h-9 shrink-0 bg-gradient-to-br from-orange-500/20 to-amber-600/20 rounded-full flex items-center justify-center ring-1 ring-orange-500/20">
                      <Image
                        src="/assets/icon-star.svg"
                        alt="Token"
                        width={16}
                        height={16}
                      />
                    </div>
                    <div className="min-w-0 text-left">
                      <p className="font-bold text-white text-lg leading-tight">{token?.tokenSymbol || 'Tokens'}</p>
                      {(() => {
                        const sym = (token?.tokenSymbol || '').trim()
                        const name = (token?.tokenName || '').trim()
                        if (!name || name.toLowerCase() === sym.toLowerCase()) return null
                        return <p className="text-gray-500 text-xs">{name}</p>
                      })()}
                    </div>
                  </div>
                  <div
                    className="w-full md:w-auto md:min-w-[10rem] md:text-right border-l-0 md:border-l border-t md:border-t-0 border-white/[0.08] pt-3 md:pt-0 md:pl-4"
                    role="status"
                    aria-live="polite"
                    aria-label={`${token?.tokenSymbol || 'Tokens'}: ${formatContributionOutput(output)}`}
                  >
                    <p
                      id="token-output"
                      className="text-xl md:text-2xl font-bold text-emerald-200/95 tabular-nums tracking-tight text-right"
                    >
                      {formatContributionOutput(output)}
                    </p>
                  </div>
                </div>
              </div>
            </div>

            <div className="flex flex-col items-center justify-center mt-2">
              <PrivyWeb3Button
                label={
                  isLoadingEthUsdPrice && usdInput && parseFloat(usdInput) > 0
                    ? 'Loading ETH price...'
                    : 'Contribute'
                }
                id="open-contribute-modal"
                className="rounded-xl gradient-2 w-full py-2.5 font-medium"
                action={() => onOpenModal?.(usdInput)}
                isDisabled={isLoadingEthUsdPrice && usdInput && parseFloat(usdInput) > 0}
              />
              <p className="pt-2.5 pb-1 text-xs text-gray-500">{`Sign In · Fund · Contribute`}</p>
              <div className="w-full flex justify-center pt-1">
                <AcceptedPaymentMethods />
              </div>
            </div>

            <MissionContributorTiersPanel missionId={mission?.id} />
            {token?.tokenSymbol && +tokenCredit?.toString() > 0 && (
              <PrivyWeb3Button
                requiredChain={DEFAULT_CHAIN_V5}
                id="claim-button"
                label={`Claim ${formatTokenAmount(tokenCredit.toString() / 1e18, 0)} $${
                  token?.tokenSymbol
                }`}
                className="rounded-xl gradient-2 w-full py-2 font-medium"
                action={claimTokenCredit}
              />
            )}
          </div>
        )
      )}
      {/* Token Section - Consolidated */}
      {(token?.tokenSupply > 0 ||
        tokenBalance > 0 ||
        isRefundable ||
        showContributedRow) && (
        <div id="mission-token-section" className="px-5 py-5 space-y-3">

          {/* Your contribution & balance */}
          {(showContributedRow || tokenBalance > 0) && (
            <div className="bg-white/[0.03] border border-white/[0.06] rounded-xl p-4 space-y-4">
              {showContributedRow && (
                <div>
                  <p className="text-gray-500 text-xs uppercase tracking-wider font-medium mb-1">
                    You contributed
                  </p>
                  {isLoadingContributedEth ? (
                    <LoadingSpinner className="scale-50 ml-0" />
                  ) : (
                    <div className="flex items-baseline gap-2 flex-wrap">
                      <span className="font-semibold text-white text-lg">
                        Ξ {formatContributedEth(contributedEth)} ETH
                      </span>
                      {contributedUsdApprox != null && contributedUsdApprox > 0 && (
                        <span className="text-gray-400 text-sm">
                          (~$
                          {contributedUsdApprox.toLocaleString('en-US', {
                            maximumFractionDigits: 2,
                            minimumFractionDigits: 2,
                          })}
                          )
                        </span>
                      )}
                    </div>
                  )}
                </div>
              )}
              {showContributedRow && tokenBalance > 0 && (
                <div className="border-t border-white/[0.06] pt-4" />
              )}
              {tokenBalance > 0 && (
                <div>
                  <p className="text-gray-500 text-xs uppercase tracking-wider font-medium mb-1">
                    Your Balance
                  </p>
                  <div className="flex items-baseline gap-2 flex-wrap">
                    <span className="font-semibold text-white text-lg">
                      {formatTokenAmount(tokenBalance, 2)}
                    </span>
                    <span className="text-gray-400 text-sm font-medium">${token?.tokenSymbol}</span>
                    {token?.tokenSupply > 0 && (
                      <span className="text-gray-600 text-xs">
                        (
                        {(
                          (tokenBalance / (+token?.tokenSupply.toString() / 1e18)) *
                          100
                        ).toFixed(1)}
                        % of Supply)
                      </span>
                    )}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Current Supply and Exchange Rate */}
          {token?.tokenSupply > 0 && !isRefundable && (
            <div className="grid grid-cols-2 gap-3">
              <div className="bg-white/[0.03] border border-white/[0.06] rounded-xl p-3">
                <p className="text-gray-500 text-xs uppercase tracking-wider font-medium mb-1">Supply</p>
                <p className="font-semibold text-white text-sm">
                  {formatTokenAmount(+token?.tokenSupply.toString() / 1e18, 2)}{' '}
                  <span className="text-gray-400 text-xs">${token?.tokenSymbol}</span>
                </p>
              </div>
              <div className="bg-white/[0.03] border border-white/[0.06] rounded-xl p-3">
                <MissionTokenExchangeRates
                  currentStage={currentStage}
                  tokenSymbol={token?.tokenSymbol}
                />
              </div>
            </div>
          )}

          {/* Refund Section */}
          {isRefundable && (tokenBalance > 0 || tokenCredit > 0) && (
            <div className="bg-white/[0.03] border border-white/[0.06] rounded-xl p-4 space-y-3">
              <PrivyWeb3Button
                requiredChain={DEFAULT_CHAIN_V5}
                id="redeem-button"
                className="w-full rounded-xl py-2.5 gradient-2 font-medium"
                label={
                  isLoadingRedeemAmount ? (
                    <LoadingSpinner />
                  ) : (
                    `Redeem ${formatTokenAmount(redeemAmount, 4)} ETH`
                  )
                }
                isDisabled={isLoadingRedeemAmount}
                action={redeem}
                noPadding
              />
              <p className="text-xs text-gray-500 text-center leading-relaxed">
                This mission did not reach its funding goal. You can claim your refund here.
              </p>
            </div>
          )}
        </div>
      )}

      {!hideRecentContributions &&
        mission?.projectId != null &&
        mission?.projectId !== '' && (
          <div className="px-5 pb-5 pt-2 border-t border-white/[0.08] space-y-3">
            <h3 className="text-gray-400 font-medium text-xs uppercase tracking-wider">
              Recent contributions
            </h3>
            <div className="max-h-[calc(100dvh-5rem)] overflow-y-auto overflow-x-hidden flex flex-col gap-0 pr-1 -mr-1">
              <MissionActivityList
                selectedChain={DEFAULT_CHAIN_V5}
                tokenSymbol={token?.tokenSymbol}
                projectId={mission?.projectId}
              />
            </div>
          </div>
        )}
    </div>
  )
}

export type MissionPayRedeemProps = {
  mission: any
  token: any
  teamNFT: any
  stage: any
  deadline: number
  usdInput: string
  setUsdInput: (usdInput: string) => void
  onlyModal?: boolean
  primaryTerminalAddress: string
  jbControllerContract?: any
  jbTokensContract?: any
  forwardClient?: any
  refreshTotalFunding?: () => void
  ruleset: JBRuleset
  onOpenModal?: (usdInput: string) => void
  onlyButton?: boolean
  visibleButton?: boolean
  buttonMode?: 'fixed' | 'standard'
  buttonClassName?: string
  /** Hide “Recent contributions” (e.g. shown under About on mobile instead). */
  hideRecentContributions?: boolean
}

function MissionPayRedeemComponent({
  mission,
  token,
  teamNFT,
  stage,
  deadline,
  onlyModal = false,
  primaryTerminalAddress,
  jbControllerContract,
  jbTokensContract,
  forwardClient,
  refreshTotalFunding,
  ruleset,
  onOpenModal,
  usdInput,
  setUsdInput,
  onlyButton = false,
  visibleButton = true,
  buttonMode = 'standard',
  buttonClassName = '',
  hideRecentContributions = false,
}: MissionPayRedeemProps) {
  const { selectedChain } = useContext(ChainContextV5)
  const defaultChainSlug = getChainSlug(DEFAULT_CHAIN_V5)
  const chainSlug = getChainSlug(selectedChain)

  const account = useActiveAccount()
  const address = account?.address

  const { nativeBalance, walletChain: nativeBalanceChain } = useNativeBalance()
  /** Slug for the chain the wallet is actually on (matches `nativeBalance`). */
  const walletConnectedChainSlug = nativeBalanceChain
    ? getChainSlug(nativeBalanceChain)
    : chainSlug

  const [input, setInput] = useState('')
  const [output, setOutput] = useState(0)
  const [redeemAmount, setRedeemAmount] = useState(0)
  const [isLoadingRedeemAmount, setIsLoadingRedeemAmount] = useState(true)

  const { data: ethUsdPrice, isLoading: isLoadingEthUsdPrice } = useETHPrice(1, 'ETH_TO_USD')

  const { volumeWei: contributedEthWei, isLoading: isLoadingContributedEth } =
    useMissionParticipantVolume(mission?.projectId, address)

  const currentStage = useMissionFundingStage(mission?.id)

  const primaryTerminalContract = useContract({
    address: primaryTerminalAddress,
    chain: DEFAULT_CHAIN_V5,
    abi: JBV5MultiTerminal.abi as any,
    forwardClient,
  })

  const tokenBalance = useWatchTokenBalance(
    DEFAULT_CHAIN_V5,
    token?.tokenAddress || JB_NATIVE_TOKEN_ADDRESS
  )

  const [tokenBalanceRefresh, setTokenBalanceRefresh] = useState(0)

  const { data: tokenCredit } = useRead({
    contract: jbTokensContract,
    method: 'creditBalanceOf' as string,
    params: [address, mission?.projectId],
    deps: [tokenBalanceRefresh],
  })

  const { data: jbTokenBalance } = useRead({
    contract: jbTokensContract,
    method: 'totalBalanceOf' as string,
    params: [address, mission?.projectId],
    deps: [tokenBalanceRefresh],
  })

  const refreshTokenBalances = useCallback(() => {
    setTokenBalanceRefresh((prev) => prev + 1)
  }, [])

  const refreshMissionData = useCallback(() => {
    refreshTotalFunding?.()
    refreshTokenBalances()
  }, [refreshTotalFunding, refreshTokenBalances])

  // Calculate ETH amount from USD for display
  const calculateEthAmount = useCallback(() => {
    if (!usdInput) return '0'
    const numericValue = usdInput.replace(/,/g, '')

    if (!usdInput || isNaN(Number(numericValue))) {
      return '0'
    }
    if (isLoadingEthUsdPrice) {
      return <LoadingSpinner className="scale-50" />
    }
    if (!ethUsdPrice) {
      return '0'
    }
    const eth = Number(numericValue) / ethUsdPrice
    return formatEthFiveSigFigs(eth)
  }, [usdInput, ethUsdPrice, isLoadingEthUsdPrice])

  // Format input with commas in real-time
  const formatInputWithCommas = useCallback((value: string) => {
    if (!value) return ''
    const numericValue = value.replace(/,/g, '')

    if (numericValue.endsWith('.')) {
      const integerPart = numericValue.slice(0, -1)
      const formattedInteger = integerPart.replace(/\B(?=(\d{3})+(?!\d))/g, ',')
      return `${formattedInteger}.`
    }

    const parts = numericValue.split('.')
    const integerPart = parts[0]
    const decimalPart = parts[1] || ''

    const formattedInteger = integerPart.replace(/\B(?=(\d{3})+(?!\d))/g, ',')

    return decimalPart ? `${formattedInteger}.${decimalPart}` : formattedInteger
  }, [])

  const applyMaxContribution = useCallback(() => {
    if (!ethUsdPrice || nativeBalance == null || !address) return
    const balanceEth = Number(nativeBalance)
    const maxUsd = computeContributionMaxUsd({
      balanceEth,
      selectedChainId: nativeBalanceChain?.id ?? selectedChain?.id ?? 0,
      chainSlug: walletConnectedChainSlug,
      defaultChainSlug,
      ethUsdPrice,
    })
    if (maxUsd == null || maxUsd <= 0) return

    // Enforce the same constraints as the USD input:
    // - At most 7 integer digits
    // - At most 15 total characters (input maxLength)
    const MAX_INTEGER_DIGITS = 7
    const MAX_TOTAL_LENGTH = 15

    // Numeric cap to 7 integer digits (e.g. 9,999,999.99)
    const maxAllowedNumeric = Number(`${'9'.repeat(MAX_INTEGER_DIGITS)}.99`)
    const clampedUsd = Math.min(maxUsd, maxAllowedNumeric)

    // Format to two decimals and apply comma formatting
    let formatted = formatInputWithCommas(clampedUsd.toFixed(2))

    // Ensure we don't exceed the input's maxLength
    if (formatted.length > MAX_TOTAL_LENGTH) {
      formatted = formatted.slice(0, MAX_TOTAL_LENGTH)
    }

    setUsdInput(formatted)
  }, [
    ethUsdPrice,
    nativeBalance,
    address,
    walletConnectedChainSlug,
    nativeBalanceChain?.id,
    selectedChain?.id,
    defaultChainSlug,
    formatInputWithCommas,
    setUsdInput,
  ])

  // Format token amount with commas
  const formatTokenAmount = useCallback((value: number, decimals: number = 2) => {
    return value.toLocaleString('en-US', {
      minimumFractionDigits: decimals,
      maximumFractionDigits: decimals,
    })
  }, [])

  // When USD input changes, update ETH input
  const handleUsdInputChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      let inputValue = e.target.value

      inputValue = inputValue.replace(/[^0-9.,]/g, '')

      const numericValue = inputValue.replace(/,/g, '')

      const decimalParts = numericValue.split('.')
      if (decimalParts.length > 2) {
        inputValue = decimalParts[0] + '.' + decimalParts.slice(1).join('')
      } else if (decimalParts.length === 2 && decimalParts[1].length > 2) {
        inputValue = decimalParts[0] + '.' + decimalParts[1].substring(0, 2)
      }

      const finalNumericValue = inputValue.replace(/,/g, '')
      const parts = finalNumericValue.split('.')
      if (parts[0].length > 7) return

      const formattedValue = formatInputWithCommas(inputValue)
      setUsdInput(formattedValue)

      if (formattedValue === '') {
        setInput('0')
        return
      }
    },
    [setInput, setUsdInput, formatInputWithCommas]
  )

  // Helper function to safely convert a number to wei (BigInt)
  const toWei = (value: number): bigint => {
    if (!isFinite(value) || isNaN(value) || value < 0) {
      return BigInt(0)
    }

    let valueStr = value.toString()

    if (valueStr.includes('e')) {
      valueStr = value.toFixed(20)
    }

    const [intPart = '0', decPart = ''] = valueStr.split('.')

    const intWei = BigInt(intPart) * BigInt(10) ** BigInt(18)

    const decimalDigits = decPart.slice(0, 18).padEnd(18, '0')
    const decWei = BigInt(decimalDigits)

    return intWei + decWei
  }

  const getQuote = useCallback(async () => {
    try {
      const inputValue = parseFloat(input) || 0
      if (inputValue <= 0) {
        setOutput(0)
        return
      }

      if (!ruleset || !ruleset[0] || !ruleset[1]) {
        console.warn('Ruleset not ready for quote calculation')
        return
      }

      const tokensReceived = calculateTokensFromPayment(toWei(inputValue), ruleset)
      setOutput(+tokensReceived)
    } catch (error) {
      console.error('Error calculating quote:', error)
      setOutput(0)
    }
  }, [input, ruleset])

  const getRedeemQuote = useCallback(async () => {
    if (!address) return
    if (!primaryTerminalContract) {
      console.error('Primary terminal contract not initialized')
      return
    }
    if (!jbTokenBalance && !tokenCredit) return
    if (Number(stage) !== 3) {
      setRedeemAmount(0)
      setIsLoadingRedeemAmount(false)
      return
    }

    setIsLoadingRedeemAmount(true)
    try {
      const tokenAmountWei = jbTokenBalance
        ? BigInt(jbTokenBalance.toString())
        : BigInt(tokenCredit.toString())

      const transaction = prepareContractCall({
        contract: primaryTerminalContract,
        method: 'cashOutTokensOf' as string,
        params: [
          address,
          mission?.projectId,
          tokenAmountWei,
          JB_NATIVE_TOKEN_ADDRESS,
          0,
          address,
          '',
        ],
      })

      const result = await simulateTransaction({
        transaction,
        account,
      })
      setRedeemAmount(Number(result.toString()) / 1e18)
    } catch (error) {
      console.error('Error getting redeem quote:', error)
      setRedeemAmount(0)
    } finally {
      setIsLoadingRedeemAmount(false)
    }
  }, [
    primaryTerminalContract,
    address,
    mission?.projectId,
    jbTokenBalance,
    tokenCredit,
    account,
    stage,
  ])

  //Redeem (stage 3 refund) all mission tokens for the connected wallet
  const redeemMissionToken = useCallback(async () => {
    if (!account || !address) {
      console.error('No account or address available')
      return
    }
    if (!primaryTerminalContract) {
      console.error('Primary terminal contract not initialized')
      return
    }

    if (tokenBalance <= 0) {
      toast.error('You have no tokens to redeem.', {
        style: toastStyle,
      })
      return
    }

    try {
      const tokenAmountWei = jbTokenBalance
        ? BigInt(jbTokenBalance.toString())
        : BigInt(tokenCredit.toString())

      const expectedAmountWei = BigInt(Math.trunc(redeemAmount * 1e18))
      const minAmountWei = (expectedAmountWei * BigInt(95)) / BigInt(100)

      const transaction = prepareContractCall({
        contract: primaryTerminalContract,
        method: 'cashOutTokensOf' as string,
        params: [
          address,
          mission?.projectId,
          tokenAmountWei,
          JB_NATIVE_TOKEN_ADDRESS,
          minAmountWei,
          address,
          '',
        ],
        gas: BigInt(500000),
      })

      const receipt = await sendAndConfirmTransaction({
        transaction,
        account,
      })

      toast.success('Tokens redeemed successfully!', {
        style: toastStyle,
      })
      refreshMissionData()
    } catch (error: any) {
      console.error('Error redeeming tokens:', error)
      if (error.message.includes('Project funding deadline has not passed.')) {
        toast.error('Mission funding deadline has not passed. Refunds are disabled.', {
          style: toastStyle,
        })
      } else {
        toast.error('Failed to redeem tokens.', {
          style: toastStyle,
        })
      }
    }
  }, [
    account,
    primaryTerminalContract,
    address,
    mission?.projectId,
    refreshMissionData,
    tokenBalance,
    jbTokenBalance,
    tokenCredit,
    redeemAmount,
  ])

  //Claim all token credit for the connected wallet
  const claimTokenCredit = useCallback(async () => {
    if (!account || !address) {
      console.error('No account or address available')
      return
    }

    if (tokenCredit <= 0) {
      toast.error('You have no token credit to claim.', {
        style: toastStyle,
      })
      return
    }

    try {
      const transaction = prepareContractCall({
        contract: jbControllerContract,
        method: 'claimTokensFor' as string,
        params: [address, mission?.projectId, tokenCredit, address],
        gas: BigInt(500000),
      })

      const receipt = await sendAndConfirmTransaction({
        transaction,
        account,
      })

      toast.success('Token credit claimed successfully!', {
        style: toastStyle,
      })
      refreshMissionData()
    } catch (error) {
      console.error('Error claiming token credit:', error)
      toast.error('Failed to claim token credit.', {
        style: toastStyle,
      })
    }
  }, [account, address, jbControllerContract, mission?.projectId, tokenCredit, refreshMissionData])

  useEffect(() => {
    if (parseFloat(input) > 0 && ruleset && ruleset[0] && ruleset[1]) {
      getQuote()
    } else if (input === '0' || input === '') {
      setOutput(0)
    }
  }, [input, getQuote, ruleset])

  useEffect(() => {
    if (usdInput && ethUsdPrice) {
      const finalNumericValue = usdInput.replace(/,/g, '')
      if (!isNaN(Number(finalNumericValue))) {
        setInput((Number(finalNumericValue) / ethUsdPrice).toFixed(6))
      }
    }
  }, [usdInput, ethUsdPrice])

  useEffect(() => {
    if (
      Number(stage) === 3 &&
      ((jbTokenBalance && jbTokenBalance > 0) || (tokenCredit && tokenCredit > 0))
    ) {
      getRedeemQuote()
    } else {
      setRedeemAmount(0)
      setIsLoadingRedeemAmount(false)
    }
  }, [jbTokenBalance, tokenCredit, stage, getRedeemQuote])

  if (Number(stage) === 4) return null

  return (
    <>
      {!onlyModal && (
        <>
          {onlyButton && buttonMode === 'fixed' ? (
            <Modal
              id="fixed-contribute-button"
              setEnabled={() => {}}
              showCloseButton={false}
              className={`fixed bottom-0 pb-2 pt-4 z-[100] w-full flex items-center justify-center bg-gradient-to-r from-gray-900/95 via-blue-900/80 to-purple-900/70 backdrop-blur-xl ${
                visibleButton ? 'opacity-100' : 'opacity-0'
              } transition-opacity duration-300 animate-fadeIn`}
            >
              <div className="flex flex-col items-center justify-center">
                <PrivyWeb3Button
                  label={
                    isLoadingEthUsdPrice && usdInput && parseFloat(usdInput) > 0
                      ? 'Loading ETH price...'
                      : 'Contribute'
                  }
                  id="open-contribute-modal"
                  className={`rounded-full gradient-2 rounded-full w-[80vw] py-1 ${buttonClassName}`}
                  action={() => onOpenModal?.(usdInput)}
                  isDisabled={isLoadingEthUsdPrice && parseFloat(usdInput) > 0}
                  showSignInLabel={false}
                />
                <p className="text-sm text-gray-300 italic mt-2">{`Sign In ● Fund ● Contribute`}</p>
              </div>
            </Modal>
          ) : onlyButton && buttonMode === 'standard' ? (
            <div
              className={`${
                visibleButton ? 'opacity-100' : 'opacity-0 hidden'
              } transition-opacity duration-300 animate-fadeIn`}
            >
              <PrivyWeb3Button
                label="Contribute"
                id="open-contribute-modal"
                className={
                  buttonClassName ? buttonClassName : 'rounded-full gradient-2 rounded-full'
                }
                action={() => onOpenModal?.(usdInput)}
                isDisabled={isLoadingEthUsdPrice && parseFloat(usdInput) > 0}
                showSignInLabel={false}
              />
            </div>
          ) : (
            <div className="mt-2">
              <MissionPayRedeemContent
                mission={mission}
                token={token}
                output={output}
                redeem={redeemMissionToken}
                onOpenModal={onOpenModal}
                tokenBalance={tokenBalance}
                tokenCredit={tokenCredit !== undefined ? tokenCredit : 0}
                claimTokenCredit={claimTokenCredit}
                currentStage={currentStage}
                stage={stage}
                deadline={deadline}
                handleUsdInputChange={handleUsdInputChange}
                calculateEthAmount={calculateEthAmount}
                formatTokenAmount={formatTokenAmount}
                redeemAmount={redeemAmount}
                isLoadingRedeemAmount={isLoadingRedeemAmount}
                isLoadingEthUsdPrice={isLoadingEthUsdPrice}
                setUsdInput={setUsdInput}
                usdInput={usdInput}
                address={address}
                contributedEthWei={contributedEthWei}
                isLoadingContributedEth={isLoadingContributedEth}
                ethUsdPrice={ethUsdPrice}
                nativeBalance={nativeBalance}
                nativeBalanceChain={nativeBalanceChain}
                applyMaxContribution={applyMaxContribution}
                hideRecentContributions={hideRecentContributions}
              />
            </div>
          )}
        </>
      )}
    </>
  )
}

export default MissionPayRedeemComponent
