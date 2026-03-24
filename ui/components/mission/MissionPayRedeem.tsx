import { ArrowDownIcon } from '@heroicons/react/20/solid'
import JBV5MultiTerminal from 'const/abis/JBV5MultiTerminal.json'
import { DEFAULT_CHAIN_V5, JB_NATIVE_TOKEN_ADDRESS } from 'const/config'
import { JBRuleset } from 'juice-sdk-core'
import Image from 'next/image'
import Link from 'next/link'
import React from 'react'
import { useEffect, useState, useCallback } from 'react'
import toast from 'react-hot-toast'
import { prepareContractCall, sendAndConfirmTransaction, simulateTransaction } from 'thirdweb'
import { TransactionReceipt } from 'thirdweb/dist/types/transaction/types'
import { useActiveAccount } from 'thirdweb/react'
import useETHPrice from '@/lib/etherscan/useETHPrice'
import { calculateTokensFromPayment } from '@/lib/juicebox/tokenCalculations'
import { useMissionParticipantVolume } from '@/lib/juicebox/useMissionParticipantVolume'
import toastStyle from '@/lib/marketplace/marketplace-utils/toastConfig'
import { formatContributionOutput } from '@/lib/mission'
import useMissionFundingStage from '@/lib/mission/useMissionFundingStage'
import useContract from '@/lib/thirdweb/hooks/useContract'
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
      className="bg-gradient-to-br from-slate-900/90 via-slate-900/70 to-indigo-950/40 backdrop-blur-xl border border-white/[0.08] rounded-2xl w-full flex flex-col gap-4 xl:items-stretch shadow-2xl"
    >
      {shouldShowSwapOnly ? (
        <MissionTokenSwapV4 token={token} />
      ) : (
        !isRefundable && (
          <div id="mission-pay-container" className="p-5 flex flex-col">
            {/* You pay */}
            <div className="space-y-2">
              <label className="text-gray-500 font-medium text-xs uppercase tracking-wider">
                You pay
              </label>
              <div className="bg-white/[0.03] border border-white/[0.06] rounded-xl p-4">
                <div className="flex flex-col md:flex-row gap-4 items-center justify-between">
                  <div className="flex items-center space-x-3">
                    <div className="w-9 h-9 bg-slate-700 rounded-full flex items-center justify-center ring-1 ring-white/10">
                      <Image
                        src="/coins/ETH.svg"
                        alt="ETH"
                        width={18}
                        height={18}
                      />
                    </div>
                    <div>
                      <p className="font-bold text-white text-lg leading-tight">
                        {calculateEthAmount()} ETH
                      </p>
                      <p className="text-gray-500 text-xs">Ethereum</p>
                    </div>
                  </div>
                  <div className="bg-white/[0.04] rounded-lg px-3 py-2 border border-white/[0.06] w-full md:w-1/2">
                    <div className="flex items-center space-x-2">
                      <span className="text-gray-400 font-medium">$</span>
                      <input
                        id="usd-contribution-input"
                        type="text"
                        className="w-full bg-transparent border-none outline-none text-lg font-bold text-white text-right w-16 placeholder-gray-500 focus:placeholder-gray-400 transition-colors duration-200 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                        value={usdInput}
                        onChange={handleUsdInputChange}
                        placeholder="0"
                        maxLength={15}
                      />
                      <span className="text-white text-sm font-medium">USD</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Connecting element */}
            <div className="mt-4 flex justify-center">
              <div className="flex items-center justify-center w-7 h-7 bg-white/[0.04] rounded-lg border border-white/[0.06]">
                <ArrowDownIcon className="w-3.5 h-3.5 text-gray-500" />
              </div>
            </div>

            {/* You receive */}
            <div className="mt-[-10px] space-y-2">
              <label className="text-gray-500 font-medium text-xs uppercase tracking-wider">
                You receive
              </label>
              <div className="bg-white/[0.03] border border-white/[0.06] rounded-xl p-4">
                <div className="flex flex-col md:flex-row gap-4 items-center justify-between">
                  <div className="flex items-center space-x-3">
                    <div className="w-9 h-9 bg-gradient-to-br from-orange-500/20 to-amber-600/20 rounded-full flex items-center justify-center ring-1 ring-orange-500/20">
                      <Image
                        src="/assets/icon-star.svg"
                        alt="Token"
                        width={16}
                        height={16}
                      />
                    </div>
                    <div>
                      <p className="font-bold text-white text-lg leading-tight">{token?.tokenSymbol || 'Tokens'}</p>
                      <p className="text-gray-500 text-xs">{token?.tokenName || 'Mission Tokens'}</p>
                    </div>
                  </div>
                  <div className="bg-white/[0.04] rounded-lg px-3 py-2 border border-white/[0.06] w-full md:w-1/2">
                    <div className="flex items-center justify-end gap-2">
                      <p
                        id="token-output"
                        className="w-full bg-transparent border-none outline-none text-lg font-bold text-white text-right w-16 placeholder-gray-500 focus:placeholder-gray-400 transition-colors duration-200"
                      >
                        {formatContributionOutput(output)}
                      </p>
                    </div>
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

      {mission?.projectId != null && mission?.projectId !== '' && (
        <div className="px-5 pb-5 pt-2 border-t border-white/[0.08] space-y-3">
          <h3 className="text-gray-400 font-medium text-xs uppercase tracking-wider">
            Recent contributions
          </h3>
          <div className="max-h-[min(1600px,calc(100dvh-5.5rem))] overflow-y-auto overflow-x-hidden flex flex-col gap-0 pr-1 -mr-1">
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
}: MissionPayRedeemProps) {
  const account = useActiveAccount()
  const address = account?.address

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
    if (!usdInput) return '0.0000'
    const numericValue = usdInput.replace(/,/g, '')

    if (!usdInput || isNaN(Number(numericValue))) {
      return '0.0000'
    }
    if (isLoadingEthUsdPrice) {
      return <LoadingSpinner className="scale-50" />
    }
    if (!ethUsdPrice) {
      return '0.0000'
    }
    const ethAmount = (Number(numericValue) / ethUsdPrice).toFixed(4)
    return parseFloat(ethAmount).toLocaleString('en-US', {
      minimumFractionDigits: 4,
      maximumFractionDigits: 4,
    })
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
              />
            </div>
          )}
        </>
      )}
    </>
  )
}

export default MissionPayRedeemComponent
