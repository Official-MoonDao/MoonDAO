import { ArrowDownIcon } from '@heroicons/react/20/solid'
import JBV5MultiTerminal from 'const/abis/JBV5MultiTerminal.json'
import { DEFAULT_CHAIN_V5, JB_NATIVE_TOKEN_ADDRESS } from 'const/config'
import { JBRuleset } from 'juice-sdk-core'
import Image from 'next/image'
import Link from 'next/link'
import React, { useMemo } from 'react'
import { useEffect, useState, useCallback } from 'react'
import toast from 'react-hot-toast'
import { prepareContractCall, sendAndConfirmTransaction, simulateTransaction } from 'thirdweb'
import { TransactionReceipt } from 'thirdweb/dist/types/transaction/types'
import { useActiveAccount } from 'thirdweb/react'
import useETHPrice from '@/lib/etherscan/useETHPrice'
import { calculateTokensFromPayment } from '@/lib/juicebox/tokenCalculations'
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
import MissionTokenExchangeRates from './MissionTokenExchangeRates'

function MissionPayRedeemContent({
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
}: any) {
  const isRefundable = Number(stage) === 3
  const deadlineHasPassed = deadline ? deadline < Date.now() : false
  const shouldShowSwapOnly = deadlineHasPassed && Number(stage) === 2

  if (isRefundable && (!tokenCredit || tokenCredit <= 0) && (!tokenBalance || tokenBalance <= 0)) {
    return null
  }

  return (
    <div
      id="mission-pay-redeem-container"
      className="bg-gradient-to-br from-gray-900 via-blue-900/30 to-purple-900/20 backdrop-blur-xl border border-white/10 rounded-[5vw] md:rounded-[2vw] w-full flex flex-col gap-4 lg:min-w-[430px] xl:items-stretch shadow-2xl"
    >
      {shouldShowSwapOnly ? (
        <MissionTokenSwapV4 token={token} />
      ) : (
        !isRefundable && (
          <div id="mission-pay-container" className="p-4 flex flex-col">
            {/* You pay */}
            <div className="space-y-2">
              <label className="text-gray-300 font-medium text-sm uppercase tracking-wide">
                You pay
              </label>
              <div className="bg-gradient-to-r from-[#121C42] to-[#090D21] border border-white/10 rounded-xl p-4 shadow-lg">
                <div className="flex flex-col md:flex-row gap-4 items-center justify-between">
                  <div className="flex items-center space-x-4">
                    <div className="w-8 h-8 bg-light-cool rounded-full flex items-center justify-center">
                      <Image
                        src="/coins/ETH.svg"
                        alt="ETH"
                        width={16}
                        height={16}
                        className="w-4 h-4"
                      />
                    </div>
                    <div>
                      <p className="font-bold text-white text-lg flex items-center gap-1">
                        {calculateEthAmount()} ETH
                      </p>
                      <p className="text-gray-400 text-xs">Ethereum</p>
                    </div>
                  </div>
                  <div className="bg-[#111C42] rounded-lg px-3 py-2 border border-white/10 w-full md:w-1/2">
                    <div className="flex items-center space-x-2">
                      <span className="text-white font-medium">$</span>
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
              <div className="flex items-center justify-center w-8 h-8 bg-gradient-to-br from-darkest-cool/50 to-dark-cool/50 rounded-full border border-white/10 shadow-lg">
                <ArrowDownIcon className="w-4 h-4 text-gray-300" />
              </div>
            </div>

            {/* You receive */}
            {token?.tokenSymbol && (
              <div className="mt-[-16px] space-y-2">
                <label className="text-gray-300 font-medium text-sm uppercase tracking-wide">
                  You receive
                </label>
                <div className="bg-gradient-to-r from-[#121C42] to-[#090D21] border border-white/10 rounded-xl p-4 shadow-lg">
                  <div className="flex flex-col md:flex-row gap-4 items-center justify-between">
                    <div className="flex items-center space-x-4">
                      <div className="w-8 h-8 bg-gradient-to-br from-orange-400 to-orange-600 rounded-full flex items-center justify-center">
                        <Image
                          src="/assets/icon-star.svg"
                          alt="Token"
                          width={16}
                          height={16}
                          className="w-4 h-4 text-white"
                        />
                      </div>
                      <div>
                        <p className="font-bold text-white text-lg">{token?.tokenSymbol}</p>
                        <p className="text-gray-400 text-xs">{token?.tokenName}</p>
                      </div>
                    </div>
                    <div className="bg-[#111C42] rounded-lg px-3 py-2 border border-white/10 w-full md:w-1/2">
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
            )}

            <div className="flex flex-col items-center justify-center">
              <PrivyWeb3Button
                label={
                  isLoadingEthUsdPrice && usdInput && parseFloat(usdInput) > 0
                    ? 'Loading ETH price...'
                    : 'Contribute'
                }
                id="open-contribute-modal"
                className="mt-4 rounded-full gradient-2 rounded-full w-full py-1"
                action={() => onOpenModal?.(usdInput)}
                isDisabled={isLoadingEthUsdPrice && usdInput && parseFloat(usdInput) > 0}
              />
              <p className="pt-2 text-sm text-gray-300 italic">{`Sign In ● Fund ● Contribute`}</p>
            </div>

            <div className="w-full space-y-2">
              <AcceptedPaymentMethods />
            </div>
            {token?.tokenSymbol && +tokenCredit?.toString() > 0 && (
              <PrivyWeb3Button
                requiredChain={DEFAULT_CHAIN_V5}
                id="claim-button"
                label={`Claim ${formatTokenAmount(tokenCredit.toString() / 1e18, 0)} $${
                  token?.tokenSymbol
                }`}
                className="rounded-full gradient-2 rounded-full w-full py-1"
                action={claimTokenCredit}
              />
            )}
          </div>
        )
      )}
      {/* Token Section - Consolidated */}
      {(token?.tokenSupply > 0 || tokenBalance > 0 || isRefundable) && (
        <div id="mission-token-section" className="px-4 pb-4 space-y-1.5">
          <label className="text-gray-300 font-medium text-xs uppercase tracking-wide">Token</label>
          <div className="bg-black/20 border border-white/10 rounded-lg p-3 space-y-3">
            {/* Your Balance */}
            {tokenBalance > 0 && (
              <div>
                <p className="text-gray-400 text-xs">Your Balance</p>
                <p className="font-semibold text-white text-lg">
                  {formatTokenAmount(tokenBalance, 2)}{' '}
                  <span className="text-gray-400">${token?.tokenSymbol}</span>
                  {token?.tokenSupply > 0 && (
                    <span className="text-gray-500 text-sm ml-2">
                      ({((tokenBalance / (+token?.tokenSupply.toString() / 1e18)) * 100).toFixed(1)}
                      % of Supply)
                    </span>
                  )}
                </p>
              </div>
            )}

            {/* Current Supply and Exchange Rate */}
            {token?.tokenSupply > 0 && !isRefundable && (
              <div className="flex items-start justify-between gap-4">
                <div className="flex-1">
                  <p className="text-gray-400 text-xs">Current Supply</p>
                  <p className="font-semibold text-white">
                    {formatTokenAmount(+token?.tokenSupply.toString() / 1e18, 2)}{' '}
                    <span className="text-gray-400">${token?.tokenSymbol}</span>
                  </p>
                </div>
                <div className="flex-1">
                  <MissionTokenExchangeRates
                    currentStage={currentStage}
                    tokenSymbol={token?.tokenSymbol}
                  />
                </div>
              </div>
            )}

            {/* Refund Section */}
            {isRefundable && (tokenBalance > 0 || tokenCredit > 0) && (
              <div className="space-y-3 pt-2">
                <PrivyWeb3Button
                  requiredChain={DEFAULT_CHAIN_V5}
                  id="redeem-button"
                  className="w-full rounded-lg py-2 bg-gradient-to-r from-red-500/20 to-red-600/20 border border-red-400/30 hover:from-red-500/30 hover:to-red-600/30 text-red-300 hover:text-red-200 transition-all duration-200"
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
                <p className="text-sm text-gray-400 text-center">
                  This mission did not reach its funding goal. You can claim your refund here.
                </p>
              </div>
            )}
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
  refreshBackers?: () => void
  backers: any
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
  refreshBackers,
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
    setTimeout(() => {
      refreshBackers?.()
    }, 3000)
  }, [refreshTotalFunding, refreshBackers, refreshTokenBalances])

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
                <p className="text-sm text-gray-300 italic">{`Sign In ● Fund ● Contribute`}</p>
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
              />
            </div>
          )}
        </>
      )}
    </>
  )
}

export default MissionPayRedeemComponent
