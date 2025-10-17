import { ArrowDownIcon, XMarkIcon } from '@heroicons/react/20/solid'
import { waitForMessageReceived } from '@layerzerolabs/scan-client'
import confetti from 'canvas-confetti'
import MISSION_CROSS_CHAIN_PAY_ABI from 'const/abis/CrossChainPay.json'
import JBV5MultiTerminal from 'const/abis/JBV5MultiTerminal.json'
import {
  DEFAULT_CHAIN_V5,
  MISSION_CROSS_CHAIN_PAY_ADDRESS,
  LAYERZERO_SOURCE_CHAIN_TO_DESTINATION_EID,
  JB_NATIVE_TOKEN_ADDRESS,
  DEPLOYED_ORIGIN,
} from 'const/config'
import { FixedInt } from 'fpnum'
import {
  getTokenAToBQuote,
  JBRuleset,
  ReservedPercent,
  RulesetWeight,
} from 'juice-sdk-core'
import Image from 'next/image'
import Link from 'next/link'
import { useRouter } from 'next/router'
import React, { useMemo } from 'react'
import { useContext, useEffect, useState, useCallback } from 'react'
import toast from 'react-hot-toast'
import {
  prepareContractCall,
  sendAndConfirmTransaction,
  simulateTransaction,
  ZERO_ADDRESS,
  readContract,
  waitForReceipt,
} from 'thirdweb'
import { useActiveAccount } from 'thirdweb/react'
import useETHPrice from '@/lib/etherscan/useETHPrice'
import {
  arbitrum,
  base,
  ethereum,
  sepolia,
  optimismSepolia,
} from '@/lib/infura/infuraChains'
import toastStyle from '@/lib/marketplace/marketplace-utils/toastConfig'
import useMissionFundingStage from '@/lib/mission/useMissionFundingStage'
import useSafe from '@/lib/safe/useSafe'
import { getChainSlug } from '@/lib/thirdweb/chain'
import ChainContextV5 from '@/lib/thirdweb/chain-context-v5'
import client from '@/lib/thirdweb/client'
import useContract from '@/lib/thirdweb/hooks/useContract'
import { useNativeBalance } from '@/lib/thirdweb/hooks/useNativeBalance'
import useRead from '@/lib/thirdweb/hooks/useRead'
import useWatchTokenBalance from '@/lib/tokens/hooks/useWatchTokenBalance'
import NetworkSelector from '@/components/thirdweb/NetworkSelector'
import MissionTokenSwapV4 from '@/components/uniswap/MissionTokenSwapV4'
import { CopyIcon } from '../assets'
import { CBOnramp } from '../coinbase/CBOnramp'
import ConditionCheckbox from '../layout/ConditionCheckbox'
import { LoadingSpinner } from '../layout/LoadingSpinner'
import Modal from '../layout/Modal'
import StandardButton from '../layout/StandardButton'
import AcceptedPaymentMethods from '../privy/AcceptedPaymentMethods'
import { PrivyWeb3Button } from '../privy/PrivyWeb3Button'
import MissionDeployTokenModal from './MissionDeployTokenModal'
import MissionTokenExchangeRates from './MissionTokenExchangeRates'
import MissionTokenNotice from './MissionTokenNotice'

function MissionPayRedeemContent({
  token,
  output,
  redeem,
  setModalEnabled,
  tokenBalance,
  currentStage,
  stage,
  deadline,
  tokenCredit,
  claimTokenCredit,
  handleUsdInputChange,
  calculateEthAmount,
  formattedUsdInput,
  formatTokenAmount,
  redeemAmount,
  isLoadingRedeemAmount,
  isLoadingEthUsdPrice,
  usdInput,
  formatInputWithCommas,
}: any) {
  const isRefundable = stage === 3
  const deadlineHasPassed = deadline ? deadline < Date.now() : false
  const shouldShowSwapOnly = deadlineHasPassed && stage === 2

  if (
    isRefundable &&
    (!tokenCredit || tokenCredit <= 0) &&
    (!tokenBalance || tokenBalance <= 0)
  ) {
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
                      <span className="text-white text-sm font-medium">
                        USD
                      </span>
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
                        <p className="font-bold text-white text-lg">
                          {token?.tokenSymbol}
                        </p>
                        <p className="text-gray-400 text-xs">
                          {token?.tokenName}
                        </p>
                      </div>
                    </div>
                    <div className="bg-[#111C42] rounded-lg px-3 py-2 border border-white/10 w-full md:w-1/2">
                      <div className="flex items-center justify-end gap-2">
                        <p
                          id="token-output"
                          className="w-full bg-transparent border-none outline-none text-lg font-bold text-white text-right w-16 placeholder-gray-500 focus:placeholder-gray-400 transition-colors duration-200"
                        >
                          {formatTokenAmount(output, 2)}
                        </p>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            )}

            <StandardButton
              id="open-contribute-modal"
              className="mt-4 rounded-full gradient-2 rounded-full w-full py-1"
              onClick={() => setModalEnabled && setModalEnabled(true)}
              hoverEffect={false}
              disabled={
                isLoadingEthUsdPrice && usdInput && parseFloat(usdInput) > 0
              }
            >
              {isLoadingEthUsdPrice && usdInput && parseFloat(usdInput) > 0
                ? 'Loading ETH price...'
                : 'Contribute'}
            </StandardButton>
            <div className="w-full space-y-2">
              <AcceptedPaymentMethods />
              <p className="text-xs text-center text-gray-300 leading-relaxed">
                {'Want to contribute by wire transfer?'}
                <br />
                <span className="text-blue-400 hover:text-blue-300 transition-colors">
                  {'Email us at info@moondao.com'}
                </span>
              </p>
            </div>
            {token?.tokenSymbol && +tokenCredit?.toString() > 0 && (
              <PrivyWeb3Button
                requiredChain={DEFAULT_CHAIN_V5}
                id="claim-button"
                label={`Claim ${formatTokenAmount(
                  tokenCredit.toString() / 1e18,
                  0
                )} $${token?.tokenSymbol}`}
                className="rounded-full gradient-2 rounded-full w-full py-1"
                action={claimTokenCredit}
              />
            )}
          </div>
        )
      )}
      {/* Token stats */}
      {token?.tokenSupply > 0 && !isRefundable && (
        <div id="mission-token-stats" className="px-4 space-y-1.5">
          <label className="text-gray-300 font-medium text-xs uppercase tracking-wide">
            Token Stats
          </label>
          <div className="bg-black/20 border border-white/10 rounded-lg p-3">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-gray-400 text-xs">Current Supply</p>
                <p className="font-semibold text-white">
                  {formatTokenAmount(+token?.tokenSupply.toString() / 1e18, 2)}{' '}
                  <span className="text-gray-400">${token?.tokenSymbol}</span>
                </p>
              </div>
              <div>
                <MissionTokenExchangeRates
                  currentStage={currentStage}
                  tokenSymbol={token?.tokenSymbol}
                />
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Your Balance & Redeem */}
      {tokenBalance > 0 || isRefundable ? (
        <div className="px-4 pb-4 space-y-1.5">
          <label className="text-gray-300 font-medium text-xs uppercase tracking-wide">
            {isRefundable ? 'Refund Available' : 'Your Balance'}
          </label>
          <div className="bg-black/20 border border-white/10 rounded-lg p-3 space-y-3">
            {tokenBalance > 0 && (
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-gray-400 text-xs">Token Balance</p>
                  <p className="font-semibold text-white">
                    {formatTokenAmount(tokenBalance, 2)}{' '}
                    <span className="text-gray-400">${token?.tokenSymbol}</span>
                  </p>
                </div>
              </div>
            )}
            {isRefundable && (tokenBalance > 0 || tokenCredit > 0) && (
              <div className="space-y-3">
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
                  This mission did not reach its funding goal. You can claim
                  your refund here.
                </p>
              </div>
            )}
          </div>
        </div>
      ) : null}
    </div>
  )
}

export type MissionPayRedeemProps = {
  mission: any
  token: any
  teamNFT: any
  stage: any
  deadline: number
  onlyModal?: boolean
  modalEnabled?: boolean
  setModalEnabled?: (enabled: boolean) => void
  primaryTerminalAddress: string
  jbControllerContract?: any
  jbTokensContract?: any
  forwardClient?: any
  refreshBackers?: () => void
  refreshTotalFunding?: () => void
  ruleset: JBRuleset
}

function MissionPayRedeemComponent({
  mission,
  token,
  teamNFT,
  stage,
  deadline,
  onlyModal = false,
  modalEnabled = false,
  setModalEnabled,
  primaryTerminalAddress,
  jbControllerContract,
  jbTokensContract,
  forwardClient,
  refreshBackers,
  refreshTotalFunding,
  ruleset,
}: MissionPayRedeemProps) {
  const { selectedChain, setSelectedChain } = useContext(ChainContextV5)
  const defaultChainSlug = getChainSlug(DEFAULT_CHAIN_V5)
  const chainSlug = getChainSlug(selectedChain)
  const router = useRouter()
  const isTestnet = process.env.NEXT_PUBLIC_CHAIN !== 'mainnet'
  const chains = useMemo(
    () => (isTestnet ? [sepolia, optimismSepolia] : [arbitrum, base, ethereum]),
    [isTestnet]
  )
  const chainSlugs = chains.map((chain) => getChainSlug(chain))

  const [deployTokenModalEnabled, setDeployTokenModalEnabled] = useState(false)

  // Payment processing state
  const [isFiatPaymentProcessing, setIsFiatPaymentProcessing] = useState(false)

  const account = useActiveAccount()
  const address = account?.address

  const [input, setInput] = useState('')
  const [output, setOutput] = useState(0)
  const [message, setMessage] = useState('')
  const [redeemAmount, setRedeemAmount] = useState(0)
  const [isLoadingRedeemAmount, setIsLoadingRedeemAmount] = useState(true)

  // USD input state and handlers
  const [usdInput, setUsdInput] = useState(() => {
    const urlAmount = router?.query?.usdAmount
    return typeof urlAmount === 'string' ? urlAmount : ''
  })
  const { data: ethUsdPrice, isLoading: isLoadingEthUsdPrice } = useETHPrice(
    1,
    'ETH_TO_USD'
  )

  // Calculate ETH amount from USD for display
  const calculateEthAmount = useCallback(() => {
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

  // Format number with commas for display
  const formatWithCommas = useCallback((value: string) => {
    if (!value) return ''
    const numericValue = value.replace(/,/g, '')
    const num = parseFloat(numericValue)
    if (isNaN(num)) return value
    return num.toLocaleString('en-US', {
      minimumFractionDigits: 0,
      maximumFractionDigits: 2,
    })
  }, [])

  // Format input with commas in real-time
  const formatInputWithCommas = useCallback((value: string) => {
    if (!value) return ''
    const numericValue = value.replace(/,/g, '')

    // Handle case where user is typing a decimal point at the end
    if (numericValue.endsWith('.')) {
      const integerPart = numericValue.slice(0, -1)
      const formattedInteger = integerPart.replace(/\B(?=(\d{3})+(?!\d))/g, ',')
      return `${formattedInteger}.`
    }

    // Split by decimal point
    const parts = numericValue.split('.')
    const integerPart = parts[0]
    const decimalPart = parts[1] || ''

    // Add commas to integer part
    const formattedInteger = integerPart.replace(/\B(?=(\d{3})+(?!\d))/g, ',')

    // Combine with decimal part
    return decimalPart ? `${formattedInteger}.${decimalPart}` : formattedInteger
  }, [])

  // Format token amount with commas
  const formatTokenAmount = useCallback(
    (value: number, decimals: number = 2) => {
      return value.toLocaleString('en-US', {
        minimumFractionDigits: decimals,
        maximumFractionDigits: decimals,
      })
    },
    []
  )

  // Get formatted display value
  const formattedUsdInput = formatWithCommas(usdInput as string)

  // When USD input changes, update ETH input
  const handleUsdInputChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      let inputValue = e.target.value

      // Allow numbers, decimal point, and commas
      inputValue = inputValue.replace(/[^0-9.,]/g, '')

      // Replace commas with empty string for processing
      const numericValue = inputValue.replace(/,/g, '')

      // Check if it's a valid decimal number with max 2 decimal places
      const decimalParts = numericValue.split('.')
      if (decimalParts.length > 2) {
        // More than one decimal point, keep only the first part
        inputValue = decimalParts[0] + '.' + decimalParts.slice(1).join('')
      } else if (decimalParts.length === 2 && decimalParts[1].length > 2) {
        // More than 2 decimal places, truncate to 2
        inputValue = decimalParts[0] + '.' + decimalParts[1].substring(0, 2)
      }

      // Limit to max 7 digits before decimal
      const finalNumericValue = inputValue.replace(/,/g, '')
      const parts = finalNumericValue.split('.')
      if (parts[0].length > 7) return

      // Format with commas for display
      const formattedValue = formatInputWithCommas(inputValue)
      setUsdInput(formattedValue)

      if (formattedValue === '') {
        setInput('0')
        return
      }
    },
    [ethUsdPrice, setInput, formatInputWithCommas]
  )

  // Use default chain for safe so that cross chain payments don't update safe chain
  const {
    queueSafeTx,
    lastSafeTxExecuted,
    owners: safeOwners,
  } = useSafe(teamNFT?.owner, DEFAULT_CHAIN_V5)
  const [agreedToCondition, setAgreedToCondition] = useState(false)

  const currentStage = useMissionFundingStage(mission?.id)

  const primaryTerminalContract = useContract({
    address: primaryTerminalAddress,
    chain: DEFAULT_CHAIN_V5,
    abi: JBV5MultiTerminal.abi as any,
    forwardClient,
  })

  const crossChainPayContract = useContract({
    address: MISSION_CROSS_CHAIN_PAY_ADDRESS,
    chain: selectedChain,
    abi: MISSION_CROSS_CHAIN_PAY_ABI.abi as any,
    forwardClient,
  })

  const nativeBalance = useNativeBalance()

  // Calculate required ETH amount and determine if user has enough balance
  const requiredEth = useMemo(() => {
    const cleanUsdInput = usdInput ? usdInput.replace(/,/g, '') : '0'
    return usdInput && ethUsdPrice ? Number(cleanUsdInput) / ethUsdPrice : 0
  }, [usdInput, ethUsdPrice])

  const hasEnoughBalance = useMemo(() => {
    return (
      nativeBalance && Number(nativeBalance) >= requiredEth && requiredEth > 0
    )
  }, [nativeBalance, requiredEth])

  // Calculate how much USD the user needs to buy (difference between required and current balance)
  // Account for Coinbase's $2 minimum
  const usdDeficit = useMemo(() => {
    const cleanUsdInput = usdInput ? usdInput.replace(/,/g, '') : '0'
    const inputAmount = parseFloat(cleanUsdInput)

    // If no balance data, use full input amount but enforce $2 minimum
    if (!nativeBalance || !requiredEth || !ethUsdPrice) {
      return inputAmount > 0 && inputAmount < 2 ? '2.00' : cleanUsdInput
    }

    const ethDeficit = Math.max(0, requiredEth - Number(nativeBalance))
    const deficit = ethDeficit * ethUsdPrice

    // If they need any amount less than $2, round up to $2 (Coinbase minimum)
    if (deficit > 0 && deficit < 2) {
      return '2.00'
    }

    return deficit.toFixed(2)
  }, [nativeBalance, requiredEth, ethUsdPrice, usdInput])

  // Check if we had to adjust the amount to meet Coinbase minimum
  const isAdjustedForMinimum = useMemo(() => {
    if (!nativeBalance || !requiredEth || !ethUsdPrice) return false
    const ethDeficit = Math.max(0, requiredEth - Number(nativeBalance))
    const actualDeficit = ethDeficit * ethUsdPrice
    return actualDeficit > 0 && actualDeficit < 2
  }, [nativeBalance, requiredEth, ethUsdPrice])

  const tokenBalance = useWatchTokenBalance(
    selectedChain,
    token?.tokenAddress || JB_NATIVE_TOKEN_ADDRESS
  )

  const [tokenBalanceRefresh, setTokenBalanceRefresh] = useState(0)

  const { data: tokenCredit } = useRead({
    contract: jbTokensContract,
    method: 'creditBalanceOf' as string,
    params: [address, mission?.projectId],
    deps: [tokenBalanceRefresh],
  })

  // Get the proper JB token balance instead of ERC20 balance
  const { data: jbTokenBalance } = useRead({
    contract: jbTokensContract,
    method: 'totalBalanceOf' as string,
    params: [address, mission?.projectId],
    deps: [tokenBalanceRefresh],
  })

  //check if the connected wallet is a signer of the team's multisig
  const isTeamSigner = useMemo(() => {
    if (!address) return false
    return safeOwners.includes(address)
  }, [safeOwners, address])

  const refreshTokenBalances = useCallback(() => {
    setTokenBalanceRefresh((prev) => prev + 1)
  }, [])

  const refreshMissionData = useCallback(() => {
    refreshTotalFunding?.()
    refreshTokenBalances()

    //Wait for terminal subgraph to update
    setTimeout(() => {
      refreshBackers?.()
    }, 3000)
  }, [refreshTotalFunding, refreshBackers, refreshTokenBalances])

  const getQuote = useCallback(async () => {
    const inputValue = parseFloat(input) || 0
    const q = getTokenAToBQuote(
      new FixedInt(BigInt(Math.trunc(inputValue * 1e18)), 18),
      {
        weight: new RulesetWeight(ruleset[0].weight),
        reservedPercent: new ReservedPercent(ruleset[1].reservedPercent),
      }
    )
    setOutput(+q.payerTokens.toString() / 1e18)
  }, [input, ruleset])

  const getRedeemQuote = useCallback(async () => {
    if (!address) return
    if (!primaryTerminalContract) {
      console.error('Primary terminal contract not initialized')
      return
    }
    if (!jbTokenBalance && !tokenCredit) return
    // Don't attempt to get redeem quote if refunds aren't available
    if (stage !== 3) {
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

  const buyMissionToken = useCallback(async () => {
    if (!account || !address) {
      console.error('No account or address available')
      return
    }
    if (!primaryTerminalContract) {
      console.error('Primary terminal contract not initialized')
      return
    }
    if (!agreedToCondition) {
      toast.error('Please agree to the terms.', {
        style: toastStyle,
      })
      return
    }

    // Check if ETH price is still loading
    if (isLoadingEthUsdPrice || !ethUsdPrice) {
      toast.error('Please wait for ETH price to load.', {
        style: toastStyle,
      })
      return
    }

    const inputValue = parseFloat(input) || 0
    const usdValue = parseFloat(usdInput.replace(/,/g, '')) || 0

    // Validate based on USD input if available, otherwise fall back to ETH input
    if (usdInput && usdValue <= 0) {
      toast.error('Please enter a valid amount.', {
        style: toastStyle,
      })
      return
    } else if (!usdInput && inputValue <= 0) {
      toast.error('Please enter a valid amount.', {
        style: toastStyle,
      })
      return
    }

    if (!chainSlugs.includes(chainSlug)) {
      return toast.error('Mission tokens are not supported on this network.', {
        style: toastStyle,
      })
    }

    try {
      if (chainSlug !== defaultChainSlug) {
        const quoteCrossChainPay: any = await readContract({
          contract: crossChainPayContract,
          method: 'quoteCrossChainPay' as string,
          params: [
            LAYERZERO_SOURCE_CHAIN_TO_DESTINATION_EID[chainSlug].toString(),
            BigInt(Math.trunc(inputValue * 1e18)),
            mission?.projectId,
            address || ZERO_ADDRESS,
            output * 1e18,
            message,
            '0x00',
          ],
        })
        const transaction = prepareContractCall({
          contract: crossChainPayContract,
          method: 'crossChainPay' as string,
          params: [
            LAYERZERO_SOURCE_CHAIN_TO_DESTINATION_EID[chainSlug].toString(),
            mission?.projectId,
            BigInt(Math.trunc(inputValue * 1e18)),
            address || ZERO_ADDRESS,
            output * 0, // Don't put in mininum output for cross-chain pay to account for slippage
            message,
            '0x00',
          ],
          value: BigInt(quoteCrossChainPay),
        })

        const originReceipt: any = await sendAndConfirmTransaction({
          transaction,
          account,
        })
        toast.success(
          'Payment recieved! Please wait a minute or two for settlement.',
          {
            style: toastStyle,
          }
        )
        const destinationMessage = await waitForMessageReceived(
          isTestnet ? 19999 : 1, // 19999 resolves to testnet, 1 to mainnet, see https://cdn.jsdelivr.net/npm/@layerzerolabs/scan-client@0.0.8/dist/client.mjs
          originReceipt.transactionHash
        )
        const receipt = await waitForReceipt({
          client: client,
          chain: DEFAULT_CHAIN_V5,
          transactionHash: destinationMessage.dstTxHash as `0x${string}`,
        })
      } else {
        const transaction = prepareContractCall({
          contract: primaryTerminalContract,
          method: 'pay' as string,
          params: [
            mission?.projectId,
            JB_NATIVE_TOKEN_ADDRESS,
            BigInt(Math.trunc(inputValue * 1e18)),
            address,
            (output * 1e18 * 95) / 100,
            message,
            '0x00',
          ],
          value: BigInt(Math.trunc(inputValue * 1e18)),
        })

        const receipt = await sendAndConfirmTransaction({
          transaction,
          account,
        })
      }

      setInput('0')
      setUsdInput('0')

      if (setModalEnabled) {
        setModalEnabled(false)
      }

      toast.success('Mission token purchased!', {
        style: toastStyle,
      })
      confetti({
        particleCount: 150,
        spread: 100,
        origin: { y: 0.6 },
        shapes: ['circle', 'star'],
        colors: ['#ffffff', '#FFD700', '#00FFFF', '#ff69b4', '#8A2BE2'],
      })

      refreshMissionData()
      if (setModalEnabled) {
        setModalEnabled(false)
      }
    } catch (error) {
      console.error('Error purchasing tokens:', error)
      toast.error('Failed to purchase tokens', {
        style: toastStyle,
      })
    }
  }, [
    account,
    primaryTerminalContract,
    mission,
    input,
    address,
    output,
    message,
    refreshMissionData,
    chainSlug,
    chainSlugs,
    agreedToCondition,
    defaultChainSlug,
    crossChainPayContract,
    isTestnet,
    isLoadingEthUsdPrice,
    ethUsdPrice,
    usdInput,
    setModalEnabled,
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

      // Calculate minimum with 5% slippage tolerance (95% of expected)
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
          minAmountWei, // Use 95% of expected amount as minimum
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
        toast.error(
          'Mission funding deadline has not passed. Refunds are disabled.',
          {
            style: toastStyle,
          }
        )
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
  }, [
    account,
    address,
    jbControllerContract,
    mission?.projectId,
    tokenCredit,
    refreshMissionData,
  ])

  useEffect(() => {
    if (parseFloat(input) > 0) {
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
    // Only try to get redeem quote when refunds are actually available (stage === 3)
    if (
      stage === 3 &&
      ((jbTokenBalance && jbTokenBalance > 0) ||
        (tokenCredit && tokenCredit > 0))
    ) {
      getRedeemQuote()
    } else {
      setRedeemAmount(0)
      setIsLoadingRedeemAmount(false)
    }
  }, [jbTokenBalance, tokenCredit, stage, getRedeemQuote])

  // Clear parameter when modal is closed
  const handleModalClose = useCallback(() => {
    if (setModalEnabled) {
      setModalEnabled(false)
    }
  }, [setModalEnabled])

  if (stage === 4) return null

  return (
    <>
      {!onlyModal && (
        <>
          {deployTokenModalEnabled && isTeamSigner && (
            <MissionDeployTokenModal
              setEnabled={setDeployTokenModalEnabled}
              isTeamSigner={isTeamSigner}
              queueSafeTx={queueSafeTx}
              mission={mission}
              chainSlug={chainSlug}
              teamMutlisigAddress={teamNFT?.owner}
              lastSafeTxExecuted={lastSafeTxExecuted}
            />
          )}
          {token &&
            (!token?.tokenAddress || token.tokenAddress === ZERO_ADDRESS) &&
            isTeamSigner &&
            stage < 3 && (
              <div className="p-8 md:p-0 flex md:block justify-center">
                <StandardButton
                  id="deploy-token-button"
                  className="gradient-2 rounded-full w-full max-w-[300px]"
                  hoverEffect={false}
                  onClick={() => setDeployTokenModalEnabled(true)}
                >
                  Deploy Token
                </StandardButton>
              </div>
            )}

          <div className="mt-2">
            <MissionPayRedeemContent
              token={token}
              output={output}
              redeem={redeemMissionToken}
              setModalEnabled={setModalEnabled}
              tokenBalance={tokenBalance}
              tokenCredit={tokenCredit !== undefined ? tokenCredit : 0}
              claimTokenCredit={claimTokenCredit}
              currentStage={currentStage}
              stage={stage}
              deadline={deadline}
              handleUsdInputChange={handleUsdInputChange}
              calculateEthAmount={calculateEthAmount}
              formattedUsdInput={formattedUsdInput}
              formatTokenAmount={formatTokenAmount}
              redeemAmount={redeemAmount}
              isLoadingRedeemAmount={isLoadingRedeemAmount}
              isLoadingEthUsdPrice={isLoadingEthUsdPrice}
              usdInput={usdInput}
              formatInputWithCommas={formatInputWithCommas}
            />
          </div>
        </>
      )}
      {modalEnabled && (
        <Modal id="mission-pay-modal" setEnabled={handleModalClose}>
          <div className="w-screen md:w-[550px] mx-auto bg-gradient-to-br from-gray-900 via-blue-900/30 to-purple-900/20 backdrop-blur-xl border border-white/10 rounded-2xl shadow-2xl text-white">
            {/* Header */}
            <div className="flex items-center justify-between p-6 border-b border-white/10">
              <div className="flex items-center space-x-3">
                <div className="w-10 h-10 rounded-full bg-gradient-to-r from-blue-500 to-purple-600 flex items-center justify-center">
                  <Image
                    src="/assets/icon-star.svg"
                    alt="Contribute"
                    width={20}
                    height={20}
                    className="text-white"
                  />
                </div>
                <div>
                  <h2 className="text-xl font-semibold text-white">
                    Contribute to Mission
                  </h2>
                  <p className="text-gray-300 text-sm">
                    {mission?.metadata?.name}
                  </p>
                </div>
              </div>
              <button
                type="button"
                className="p-2 hover:bg-white/10 rounded-full transition-colors duration-200"
                onClick={handleModalClose}
              >
                <XMarkIcon className="h-5 w-5 text-gray-300 hover:text-white" />
              </button>
            </div>

            <div className="p-4 space-y-4">
              {/* Total Amount Section */}
              <div className="space-y-2">
                <label className="text-gray-300 font-medium text-sm uppercase tracking-wide">
                  Total Amount
                </label>
                <div className="bg-black/20 border border-white/10 rounded-lg p-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center space-x-3">
                      <Image
                        src="/coins/ETH.svg"
                        alt="ETH"
                        width={20}
                        height={20}
                        className="w-6 h-6 bg-light-cool rounded-full"
                      />
                      <div>
                        <p className="font-medium text-white flex items-center gap-1">
                          {calculateEthAmount()} ETH
                        </p>
                        <p className="text-gray-400 text-xs">Ethereum</p>
                      </div>
                    </div>
                    <div className="flex items-center space-x-2">
                      <span className="text-white">$</span>
                      <input
                        id="payment-input"
                        type="text"
                        className="bg-black/20 border border-white/10 rounded-lg p-2 text-white text-right w-24 placeholder-gray-400 hover:bg-black/30 hover:border-white/20 transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500/50 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                        value={usdInput}
                        onChange={handleUsdInputChange}
                        placeholder="0"
                        maxLength={15}
                        disabled={isFiatPaymentProcessing}
                      />
                      <span className="text-white">USD</span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Token Receive Section */}
              {token?.tokenSymbol && (
                <div className="space-y-2">
                  <label className="text-gray-300 font-medium text-sm uppercase tracking-wide">
                    You Receive
                  </label>
                  <div className="bg-black/20 border border-white/10 rounded-lg p-3">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center space-x-3">
                        <Image
                          src="/assets/icon-star.svg"
                          alt="Token"
                          width={20}
                          height={20}
                          className="bg-orange-500 rounded-full p-1 w-6 h-6"
                        />
                        <div>
                          <p className="font-medium text-white">
                            {token?.tokenSymbol}
                          </p>
                          <p className="text-gray-400 text-xs">
                            {token?.tokenName}
                          </p>
                        </div>
                      </div>
                      <div className="text-right">
                        <p className="font-semibold text-white">
                          {formatTokenAmount(output, 2)}
                        </p>
                        <p className="text-gray-400 text-xs">
                          {token?.tokenSymbol}
                        </p>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* Recipient Address */}
              <div className="space-y-2">
                <label className="text-gray-300 font-medium text-sm uppercase tracking-wide">
                  Recipient Address
                </label>
                <div className="flex items-center justify-between w-full gap-2">
                  <div className="bg-black/20 border border-white/10 rounded-lg p-3 w-full">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center space-x-2">
                        <div className="w-2 h-2 bg-green-500 rounded-full"></div>
                        <p className="text-white font-mono text-sm">
                          {address?.slice(0, 6)}...{address?.slice(-4)}
                        </p>
                      </div>
                      <button
                        className="p-1 hover:bg-white/10 rounded transition-colors duration-200 group"
                        onClick={() => {
                          navigator.clipboard.writeText(address || '')
                          toast.success('Address copied to clipboard.', {
                            style: toastStyle,
                          })
                        }}
                      >
                        <CopyIcon />
                      </button>
                    </div>
                  </div>
                  <div className="">
                    <NetworkSelector
                      chains={chains}
                      compact={true}
                      align="right"
                      iconsOnly={true}
                    />
                  </div>
                </div>
              </div>

              {/* Token Info */}
              {token?.tokenSymbol && token?.tokenName && (
                <div className="bg-black/20 border border-white/10 rounded-lg p-3">
                  <div className="flex items-center space-x-3">
                    <Image
                      src={mission?.metadata.logoUri}
                      width={40}
                      height={40}
                      className="rounded-full"
                      alt={`${token?.tokenSymbol} logo`}
                    />
                    <div>
                      <p className="font-medium text-white">
                        {token?.tokenSymbol}
                      </p>
                      <p className="text-gray-400 text-sm">
                        {token?.tokenName}
                      </p>
                    </div>
                  </div>
                </div>
              )}

              {/* Conditional Content Based on Balance */}
              {hasEnoughBalance ? (
                // User has enough balance - show crypto pay form
                <>
                  {/* Message Input */}
                  <div className="space-y-2">
                    <label className="text-gray-300 font-medium text-sm uppercase tracking-wide">
                      Message (Optional)
                    </label>
                    <input
                      id="payment-message-input"
                      type="text"
                      className="w-full bg-black/20 border border-white/10 rounded-lg p-4 text-white placeholder-gray-400 hover:bg-black/30 hover:border-white/20 transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500/50"
                      placeholder="Attach an on-chain message to this payment"
                      value={message}
                      onChange={(e) => setMessage(e.target.value)}
                      maxLength={100}
                    />
                  </div>

                  <MissionTokenNotice />

                  {/* Terms Checkbox */}
                  <div className="bg-black/10 rounded-lg p-4 border border-white/5">
                    <ConditionCheckbox
                      id="contribution-terms-checkbox"
                      label={
                        <>
                          <p className="text-sm text-gray-300">
                            {`I acknowledge that any token issued from this contribution is not a security, carries no profit expectation, and I accept all `}
                          </p>
                          <Link
                            href="https://docs.moondao.com/Launchpad/Launchpad-Disclaimer"
                            className="text-blue-400 hover:text-blue-300"
                            target="_blank"
                            rel="noopener noreferrer"
                          >
                            risks
                          </Link>{' '}
                          <p className="text-sm text-gray-300">
                            {`associated with participation in the MoonDAO Launchpad.`}
                          </p>
                        </>
                      }
                      agreedToCondition={agreedToCondition}
                      setAgreedToCondition={setAgreedToCondition}
                    />
                  </div>

                  {/* Action Buttons */}
                  <div className="flex flex-col md:flex-row gap-3 pt-4">
                    <button
                      type="button"
                      className="flex-1 bg-black/20 border border-white/10 hover:bg-black/30 hover:border-white/20 text-white py-4 px-6 rounded-lg font-medium transition-all duration-200"
                      onClick={handleModalClose}
                    >
                      Cancel
                    </button>
                    <PrivyWeb3Button
                      id="contribute-button"
                      className="flex-1 bg-gradient-to-r from-blue-500 to-purple-600 hover:from-blue-600 hover:to-purple-700 disabled:from-gray-600 disabled:to-gray-700 text-white py-4 px-6 rounded-lg font-semibold transition-all duration-200 transform hover:scale-105 disabled:hover:scale-100 shadow-lg disabled:opacity-50"
                      label={
                        !chainSlugs.includes(chainSlug)
                          ? `Switch Network`
                          : `Contribute $${formattedUsdInput || '0'} USD`
                      }
                      action={buyMissionToken}
                      isDisabled={
                        !agreedToCondition ||
                        !usdInput ||
                        parseFloat((usdInput as string).replace(/,/g, '')) <=
                          0 ||
                        !chainSlugs.includes(chainSlug)
                      }
                    />
                  </div>
                </>
              ) : (
                // User needs more ETH - show CBOnramp
                <div className="space-y-4">
                  {/* Show balance info if user has some ETH */}
                  {usdInput &&
                    usdDeficit &&
                    nativeBalance &&
                    Number(nativeBalance) > 0 &&
                    ethUsdPrice && (
                      <div className="bg-blue-500/10 border border-blue-500/20 rounded-lg p-4 space-y-2">
                        <p className="text-blue-300 text-sm">
                          <span className="font-semibold">
                            Current Balance:
                          </span>{' '}
                          {Number(nativeBalance).toFixed(4)} ETH ($
                          {(Number(nativeBalance) * ethUsdPrice).toFixed(2)})
                          <br />
                          <span className="font-semibold">
                            Need to Buy:
                          </span>{' '}
                          {isAdjustedForMinimum ? (
                            <>
                              ${usdDeficit} (adjusted to meet Coinbase's $2
                              minimum)
                            </>
                          ) : (
                            <>
                              ${usdDeficit} more of ETH to complete your $
                              {usdInput} contribution
                            </>
                          )}
                        </p>
                        {isAdjustedForMinimum && (
                          <p className="text-blue-200 text-xs">
                            Note: You'll receive a bit more ETH than needed for
                            this contribution, which you can use for future
                            transactions.
                          </p>
                        )}
                      </div>
                    )}

                  {usdInput && usdDeficit && (
                    <CBOnramp
                      address={address || ''}
                      selectedChain={selectedChain}
                      usdInput={usdDeficit}
                      onSuccess={() => {
                        setIsFiatPaymentProcessing(false)
                        toast.success(
                          'ETH purchase completed! You can now contribute to the mission.',
                          {
                            style: toastStyle,
                          }
                        )
                      }}
                      onBeforeNavigate={() => {
                        // No cleanup needed - using React state instead of sessionStorage
                      }}
                      redirectUrl={`${DEPLOYED_ORIGIN}/mission/${
                        mission?.id
                      }?onrampSuccess=true&chain=${chainSlug}&usdAmount=${usdInput.replace(
                        /,/g,
                        ''
                      )}`}
                    />
                  )}

                  {/* Show minimum adjustment warning for users with no balance */}
                  {(!nativeBalance || Number(nativeBalance) === 0) &&
                    usdInput &&
                    parseFloat(usdInput.replace(/,/g, '')) > 0 &&
                    parseFloat(usdInput.replace(/,/g, '')) < 2 && (
                      <div className="bg-blue-500/10 border border-blue-500/20 rounded-lg p-4">
                        <p className="text-blue-300 text-sm">
                          <span className="font-semibold">Note:</span> Coinbase
                          requires a minimum purchase of $2. You'll receive ${' '}
                          {(2 - parseFloat(usdInput.replace(/,/g, ''))).toFixed(
                            2
                          )}{' '}
                          extra in ETH that you can use for future transactions.
                        </p>
                      </div>
                    )}

                  {usdInput && (
                    <>
                      {parseFloat(usdInput.replace(/,/g, '')) > 5000 && (
                        <div className="bg-orange-500/10 border border-orange-500/20 rounded-lg p-4">
                          <p className="text-orange-300 text-sm">
                            <span className="font-semibold">Large Amount:</span>{' '}
                            Coinbase has purchase limits around $5,000-$7,500.
                            For larger contributions, please contact{' '}
                            <a
                              href="mailto:info@moondao.com"
                              className="text-orange-200 underline hover:text-orange-100"
                            >
                              info@moondao.com
                            </a>{' '}
                            about wire transfer options.
                          </p>
                        </div>
                      )}
                    </>
                  )}

                  <button
                    type="button"
                    className="w-full bg-black/20 border border-white/10 hover:bg-black/30 hover:border-white/20 text-white py-4 px-6 rounded-lg font-medium transition-all duration-200"
                    onClick={handleModalClose}
                  >
                    Close
                  </button>
                </div>
              )}

              {/* Processing State */}
              {isFiatPaymentProcessing && (
                <div className="bg-blue-500/10 border border-blue-500/20 rounded-lg p-4">
                  <div className="flex items-center space-x-2">
                    <LoadingSpinner />
                    <p className="text-blue-400 text-sm">
                      Processing your payment...
                    </p>
                  </div>
                </div>
              )}
            </div>
          </div>
        </Modal>
      )}
    </>
  )
}

export default MissionPayRedeemComponent
