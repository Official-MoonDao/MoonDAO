import { getOnrampBuyUrl } from '@coinbase/onchainkit/fund'
import { ArrowDownIcon, XMarkIcon } from '@heroicons/react/20/solid'
import { waitForMessageReceived } from '@layerzerolabs/scan-client'
import { useFundWallet } from '@privy-io/react-auth'
import MISSION_CROSS_CHAIN_PAY_ABI from 'const/abis/CrossChainPay.json'
import JBMultiTerminalABI from 'const/abis/JBV4MultiTerminal.json'
import {
  DEFAULT_CHAIN_V5,
  MISSION_CROSS_CHAIN_PAY_ADDRESS,
  LAYERZERO_SOURCE_CHAIN_TO_DESTINATION_EID,
  JB_NATIVE_TOKEN_ADDRESS,
  DEPLOYED_ORIGIN,
} from 'const/config'
import Image from 'next/image'
import Link from 'next/link'
import { useRouter } from 'next/router'
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
import viemChains from '@/lib/viem/viemChains'
import NetworkSelector from '@/components/thirdweb/NetworkSelector'
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
  setMissionPayModalEnabled,
  tokenBalance,
  currentStage,
  stage,
  tokenCredit,
  claimTokenCredit,
  handleUsdInputChange,
  calculateEthAmount,
  formattedUsdInput,
  formatTokenAmount,
  redeemAmount,
  isLoadingRedeemAmount,
}: any) {
  const isRefundable = stage === 3

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
      className="z-50 bg-[#020617] rounded-[5vw] md:rounded-[2vw] w-full flex flex-col gap-4 lg:min-w-[430px] xl:items-stretch"
    >
      {!isRefundable && (
        <div
          id="mission-pay-container"
          className="lg:rounded-lg w-full flex-1 p-5 xl:p-5 flex flex-col gap-4 rounded-2xl justify-between"
        >
          {/* You pay */}
          <div className="relative flex flex-col gap-4">
            {/* You pay - USD input with ETH display */}
            <div className="relative">
              <div className="p-4 pb-12 flex flex-col gap-3 bg-gradient-to-r from-[#121C42] to-[#090D21] rounded-t-2xl">
                <div className="flex justify-between items-start">
                  <h3 className="text-sm opacity-60">You pay</h3>
                </div>

                <div className="flex justify-between sm:items-center flex-col sm:flex-row ">
                  <div className="flex items-center gap-1">
                    <span className="text-xl font-bold">$</span>
                    <input
                      id="usd-contribution-input"
                      type="text"
                      className="bg-transparent border-none outline-none text-xl font-bold min-w-[1ch] w-auto [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                      value={formattedUsdInput}
                      onChange={handleUsdInputChange}
                      placeholder="0"
                      maxLength={9}
                      style={{
                        width: `${Math.max(
                          formattedUsdInput.length || 1,
                          1
                        )}ch`,
                      }}
                    />
                    <span className="text-xl font-bold">USD</span>
                  </div>
                  <div className="flex mt-2 sm:mt-0 gap-2 items-center sm:bg-[#111C42] rounded-full sm:px-3 py-1">
                    <Image
                      src="/coins/ETH.svg"
                      alt="ETH"
                      width={16}
                      height={16}
                      className="w-5 h-5 bg-light-cool rounded-full"
                    />
                    <span className="text-base">
                      {calculateEthAmount()} ETH
                    </span>
                  </div>
                </div>
              </div>

              {token?.tokenSymbol && (
                <div className="absolute -bottom-6 left-1/2 -translate-x-1/2 flex items-center justify-center">
                  <ArrowDownIcon
                    className="p-2 w-12 h-12 bg-darkest-cool rounded-full"
                    color={'#121C42'}
                  />
                </div>
              )}
            </div>

            {/* You receive */}
            {token?.tokenSymbol && (
              <div className="p-4 pb-12 flex flex-col gap-3 bg-gradient-to-r from-[#121C42] to-[#090D21] rounded-b-2xl">
                <div className="flex justify-between items-start">
                  <h3 className="text-sm opacity-60">You receive</h3>
                </div>

                <div className="sm:flex justify-between items-center">
                  <p id="token-output" className="text-xl font-bold">
                    {formatTokenAmount(output, 2)}
                  </p>
                  <div className="relative flex mt-2 sm:mt-0 gap-2 items-center sm:bg-[#111C42] rounded-full p-1 sm:px-2">
                    <Image
                      src="/assets/icon-star.svg"
                      alt="Token"
                      width={20}
                      height={20}
                      className="bg-orange-500 rounded-full p-1 w-5 h-5"
                    />
                    {token?.tokenSymbol}
                  </div>
                </div>
              </div>
            )}
          </div>

          <StandardButton
            id="open-contribute-modal"
            className="rounded-full gradient-2 rounded-full w-full py-1"
            onClick={() => setMissionPayModalEnabled(true)}
            hoverEffect={false}
          >
            Contribute
          </StandardButton>
          <div className="w-full">
            <AcceptedPaymentMethods />
            <p className="xl:text-sm text-center">
              {'Want to contribute by wire transfer?'}
              <br />
              {'Email us at info@moondao.com'}
            </p>
          </div>
          {token?.tokenSymbol && +tokenCredit?.toString() > 0 && (
            <StandardButton
              id="claim-button"
              className="rounded-full gradient-2 rounded-full w-full py-1"
              onClick={claimTokenCredit}
              hoverEffect={false}
            >
              Claim {formatTokenAmount(tokenCredit.toString() / 1e18, 0)} $
              {token?.tokenSymbol}
            </StandardButton>
          )}
        </div>
      )}
      {/* Token stats and redeem container */}
      <div className="xl:pt-4 flex flex-row justify-between gap-4 w-full">
        {token?.tokenSupply > 0 && !isRefundable && (
          <div id="mission-token-stats" className="w-full px-2 rounded-2xl">
            <div className="p-5 pt-0 flex gap-5 items-start justify-center md:justify-start xl:justify-center">
              <div className="text-lg">
                <h3 className="opacity-60 text-sm">Current Supply</h3>
                <p>
                  {formatTokenAmount(
                    Math.floor(token?.tokenSupply.toString() / 1e18),
                    0
                  )}{' '}
                  ${token?.tokenSymbol}
                </p>
              </div>
              <div className="">
                <MissionTokenExchangeRates
                  currentStage={currentStage}
                  tokenSymbol={token?.tokenSymbol}
                />
              </div>
            </div>
          </div>
        )}

        {tokenBalance > 0 || isRefundable ? (
          <div
            id="mission-redeem-container"
            className="p-2 bg-darkest-cool rounded-2xl flex flex-col gap-4"
          >
            {tokenBalance > 0 && (
              <div>
                <h3 className="opacity-60 text-sm">Your Balance</h3>
                <p className="text-xl">{`${formatTokenAmount(
                  tokenBalance,
                  2
                )} $${token?.tokenSymbol}`}</p>
              </div>
            )}
            {isRefundable && (tokenBalance > 0 || tokenCredit > 0) && (
              <>
                <PrivyWeb3Button
                  id="redeem-button"
                  className="w-full rounded-full py-2"
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
                <p className="mt-2 text-sm opacity-60">
                  This mission did not reach its funding goal. You can claim
                  your refund here.
                </p>
              </>
            )}
          </div>
        ) : (
          <></>
        )}
      </div>
    </div>
  )
}

export type MissionPayRedeemProps = {
  mission: any
  token: any
  teamNFT: any
  stage: any
  onlyModal?: boolean
  modalEnabled?: boolean
  setModalEnabled?: (enabled: boolean) => void
  primaryTerminalAddress: string
  jbControllerContract?: any
  jbTokensContract?: any
  forwardClient?: any
  refreshBackers?: () => void
  onrampSuccess?: boolean
}

export default function MissionPayRedeem({
  mission,
  token,
  teamNFT,
  stage,
  onlyModal = false,
  modalEnabled = false,
  setModalEnabled,
  primaryTerminalAddress,
  jbControllerContract,
  jbTokensContract,
  forwardClient,
  refreshBackers,
  onrampSuccess = false,
}: MissionPayRedeemProps) {
  const { selectedChain } = useContext(ChainContextV5)
  const defaultChainSlug = getChainSlug(DEFAULT_CHAIN_V5)
  const chainSlug = getChainSlug(selectedChain)
  const router = useRouter()
  const isTestnet = process.env.NEXT_PUBLIC_CHAIN !== 'mainnet'
  const chains = isTestnet
    ? [sepolia, optimismSepolia]
    : [arbitrum, base, ethereum]

  const [missionPayModalEnabled, setMissionPayModalEnabled] = useState(false)
  const [deployTokenModalEnabled, setDeployTokenModalEnabled] = useState(false)

  // Remove payment method state - we'll determine this automatically
  const [justCompletedFiatPurchase, setJustCompletedFiatPurchase] =
    useState(false)
  const [isFiatPaymentProcessing, setIsFiatPaymentProcessing] = useState(false)
  const [isWaitingForBalance, setIsWaitingForBalance] = useState(false)
  const [initialBalance, setInitialBalance] = useState<number | null>(null)

  // Add state to track if we've processed the onramp success
  const [hasProcessedOnrampSuccess, setHasProcessedOnrampSuccess] =
    useState(false)

  // Add state to track if we're waiting for balance after onramp
  const [isWaitingForBalanceUpdate, setIsWaitingForBalanceUpdate] =
    useState(false)

  const account = useActiveAccount()
  const address = account?.address

  const [input, setInput] = useState('')
  const [output, setOutput] = useState(0)
  const [message, setMessage] = useState('')
  const [redeemAmount, setRedeemAmount] = useState(0)
  const [isLoadingRedeemAmount, setIsLoadingRedeemAmount] = useState(true)

  // USD input state and handlers
  const [usdInput, setUsdInput] = useState(() => {
    const urlAmount = router.query.usdAmount
    return typeof urlAmount === 'string' ? urlAmount : ''
  })
  const { data: ethUsdPrice, isLoading: isLoadingEthUsdPrice } = useETHPrice(
    1,
    'ETH_TO_USD'
  )

  // Available payment methods detection
  const availablePaymentMethods = {
    applePay: typeof window !== 'undefined' && 'ApplePaySession' in window,
    googlePay: typeof window !== 'undefined' && 'google' in window,
  }

  // Payment handler functions
  const handleApplePaySuccess = useCallback(
    async (paymentResult: any): Promise<boolean> => {
      try {
        console.log('Apple Pay success:', paymentResult)
        setIsFiatPaymentProcessing(true)
        setJustCompletedFiatPurchase(true)
        toast.success('Payment processed successfully!', { style: toastStyle })
        return true
      } catch (error) {
        console.error('Error processing Apple Pay success:', error)
        toast.error('Payment processing failed. Please try again.', {
          style: toastStyle,
        })
        return false
      } finally {
        setIsFiatPaymentProcessing(false)
      }
    },
    []
  )

  const handleApplePayError = useCallback(
    async (error: any): Promise<boolean> => {
      console.error('Apple Pay error:', error)
      toast.error('Payment failed. Please try again.', { style: toastStyle })
      setIsFiatPaymentProcessing(false)
      return false
    },
    []
  )

  const handleApplePayCancel = useCallback(async (): Promise<boolean> => {
    console.log('Apple Pay cancelled')
    setIsFiatPaymentProcessing(false)
    return false
  }, [])

  const handleGooglePaySuccess = useCallback(
    async (paymentResult: any): Promise<boolean> => {
      try {
        console.log('Google Pay success:', paymentResult)
        setIsFiatPaymentProcessing(true)
        setJustCompletedFiatPurchase(true)
        toast.success('Payment processed successfully!', { style: toastStyle })
        return true
      } catch (error) {
        console.error('Error processing Google Pay success:', error)
        toast.error('Payment processing failed. Please try again.', {
          style: toastStyle,
        })
        return false
      } finally {
        setIsFiatPaymentProcessing(false)
      }
    },
    []
  )

  const handleGooglePayError = useCallback(
    async (error: any): Promise<boolean> => {
      console.error('Google Pay error:', error)
      toast.error('Payment failed. Please try again.', { style: toastStyle })
      setIsFiatPaymentProcessing(false)
      return false
    },
    []
  )

  const handleGooglePayCancel = useCallback(async (): Promise<boolean> => {
    console.log('Google Pay cancelled')
    setIsFiatPaymentProcessing(false)
    return false
  }, [])

  // Calculate ETH amount from USD for display
  const calculateEthAmount = useCallback(() => {
    if (!usdInput || !ethUsdPrice || isNaN(Number(usdInput))) {
      return '0.0000'
    }
    const ethAmount = (Number(usdInput) / ethUsdPrice).toFixed(4)
    return parseFloat(ethAmount).toLocaleString('en-US', {
      minimumFractionDigits: 4,
      maximumFractionDigits: 4,
    })
  }, [usdInput, ethUsdPrice])

  // Format number with commas
  const formatWithCommas = useCallback((value: string) => {
    if (!value) return ''
    const num = parseFloat(value)
    if (isNaN(num)) return value
    return num.toLocaleString('en-US')
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
      const inputValue = e.target.value.replace(/[^0-9]/g, '') // Only allow numbers

      // Limit to 7 characters (excluding commas)
      if (inputValue.length > 10) return

      setUsdInput(inputValue)
      if (inputValue === '') {
        setInput('0')
        return
      }
      if (ethUsdPrice && !isNaN(Number(inputValue))) {
        setInput((Number(inputValue) / ethUsdPrice).toFixed(6))
      } else {
        setInput('0')
      }
    },
    [ethUsdPrice, setInput]
  )

  const [isTeamSigner, setIsTeamSigner] = useState(false)
  // Use default chain for safe so that cross chain payments don't update safe chain
  const { safe, queueSafeTx, lastSafeTxExecuted } = useSafe(
    teamNFT?.owner,
    DEFAULT_CHAIN_V5
  )

  const { fundWallet } = useFundWallet()
  const [agreedToCondition, setAgreedToCondition] = useState(false)

  const currentStage = useMissionFundingStage(mission?.id)

  const primaryTerminalContract = useContract({
    address: primaryTerminalAddress,
    chain: DEFAULT_CHAIN_V5,
    abi: JBMultiTerminalABI as any,
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
  const requiredEth =
    usdInput && ethUsdPrice ? Number(usdInput) / ethUsdPrice : 0
  const hasEnoughBalance =
    nativeBalance && Number(nativeBalance) >= requiredEth && requiredEth > 0

  const tokenBalance = useWatchTokenBalance(
    selectedChain,
    token?.tokenAddress || JB_NATIVE_TOKEN_ADDRESS
  )
  const { data: tokenCredit } = useRead({
    contract: jbTokensContract,
    method: 'creditBalanceOf' as string,
    params: [address, mission?.projectId],
  })

  // Get the proper JB token balance instead of ERC20 balance
  const { data: jbTokenBalance } = useRead({
    contract: jbTokensContract,
    method: 'totalBalanceOf' as string,
    params: [address, mission?.projectId],
  })

  //check if the connected wallet is a signer of the team's multisig
  useEffect(() => {
    const isSigner = async () => {
      const isSigner = await safe?.isOwner(address || '')
      setIsTeamSigner(isSigner || false)
    }
    if (safe && address) isSigner()
  }, [safe, address])

  const getQuote = useCallback(async () => {
    if (!address) return
    if (!primaryTerminalContract) {
      console.error('Primary terminal contract not initialized')
      return
    }

    try {
      const inputValue = parseFloat(input) || 0
      const transaction = prepareContractCall({
        contract: primaryTerminalContract,
        method: 'pay' as string,
        params: [
          mission?.projectId,
          JB_NATIVE_TOKEN_ADDRESS,
          BigInt(Math.trunc(inputValue * 1e18)),
          address || ZERO_ADDRESS,
          0,
          message,
          '0x00',
        ],
        value: BigInt(Math.trunc(inputValue * 1e18)),
      })

      const q = await simulateTransaction({
        transaction,
      })
      setOutput(q.toString() / 1e18)
    } catch (error) {
      console.error('Error getting quote:', error)
      setOutput(0)
    }
  }, [primaryTerminalContract, input, address, mission?.projectId, message])

  const getRedeemQuote = useCallback(async () => {
    if (!address) return
    if (!primaryTerminalContract) {
      console.error('Primary terminal contract not initialized')
      return
    }
    if (!jbTokenBalance && !tokenCredit) return

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

    const inputValue = parseFloat(input) || 0
    if (inputValue <= 0) {
      toast.error('Please enter a valid amount.', {
        style: toastStyle,
      })
      return
    }
    if (inputValue > +nativeBalance) {
      return fundWallet(address, {
        amount: (inputValue - +nativeBalance).toString(),
        chain: viemChains[chainSlug],
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
            output * 1e18,
            message,
            '0x00',
          ],
          value: BigInt(Math.trunc(inputValue * 1e18)),
          gas: BigInt(500000),
        })

        const receipt = await sendAndConfirmTransaction({
          transaction,
          account,
        })
      }

      toast.success('Mission token purchased.', {
        style: toastStyle,
      })

      refreshBackers?.()
      setMissionPayModalEnabled(false)
      setJustCompletedFiatPurchase(false)
      router.reload()
    } catch (error) {
      console.error('Error purchasing tokens:', error)
      toast.error('Failed to purchase tokens', {
        style: toastStyle,
      })
    }
  }, [
    account,
    primaryTerminalContract,
    mission?.projectId,
    input,
    address,
    output,
    message,
    router,
    nativeBalance,
    chainSlug,
    agreedToCondition,
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

    if (tokenBalance < 0) {
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
      router.reload()
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
    router,
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
      router.reload()
    } catch (error) {
      console.error('Error claiming token credit:', error)
      toast.error('Failed to claim token credit.', {
        style: toastStyle,
      })
    }
  }, [account, address, jbTokensContract, mission?.projectId, tokenCredit])

  useEffect(() => {
    if (parseFloat(input) > 0) {
      getQuote()
    } else if (input === '0' || input === '') {
      setOutput(0)
    }
  }, [input])

  useEffect(() => {
    if (
      (jbTokenBalance && jbTokenBalance > 0) ||
      (tokenCredit && tokenCredit > 0)
    ) {
      getRedeemQuote()
    } else {
      setRedeemAmount(0)
      setIsLoadingRedeemAmount(false)
    }
  }, [jbTokenBalance, tokenCredit, getRedeemQuote, stage])

  // Add a function to clear the parameter only when needed
  const clearOnrampSuccessParam = useCallback(() => {
    if (router.query.onrampSuccess || router.query.usdAmount) {
      router.replace(
        {
          pathname: router.pathname,
          query: {
            ...router.query,
            onrampSuccess: undefined,
            usdAmount: undefined,
          },
        },
        undefined,
        { shallow: true }
      )
    }
  }, [router])

  // Clear parameter when modal is closed
  const handleModalClose = useCallback(() => {
    setJustCompletedFiatPurchase(false)
    setMissionPayModalEnabled(false)
    clearOnrampSuccessParam() // Only clear when modal closes
  }, [clearOnrampSuccessParam])

  // Main onrampSuccess effect - REMOVE the automatic URL clearing
  useEffect(() => {
    if (onrampSuccess && account?.address && !hasProcessedOnrampSuccess) {
      console.log('✅ Processing onramp success')
      setHasProcessedOnrampSuccess(true)

      setJustCompletedFiatPurchase(true)

      console.log(
        '💰 Onramp success processed with justCompletedFiatPurchase = true'
      )

      // Open modal immediately - NO URL CLEARING HERE
      setTimeout(() => {
        setMissionPayModalEnabled(true)
      }, 500)
    }
  }, [onrampSuccess, account?.address, hasProcessedOnrampSuccess])

  // Watch for input changes to enable form when they have enough for their input
  useEffect(() => {
    if (onrampSuccess && justCompletedFiatPurchase && hasEnoughBalance) {
      setIsWaitingForBalance(false)
      toast.success('You have enough ETH to contribute!', {
        style: toastStyle,
      })
    }
  }, [onrampSuccess, justCompletedFiatPurchase, hasEnoughBalance])

  // Watch for balance updates after onramp
  useEffect(() => {
    if (
      isWaitingForBalance &&
      initialBalance !== null &&
      nativeBalance !== undefined &&
      Number(nativeBalance) > initialBalance &&
      Number(nativeBalance) > 0.001 // Ensure we have a meaningful amount
    ) {
      // Balance has increased, onramp successful
      setIsWaitingForBalance(false)
      setJustCompletedFiatPurchase(true)

      // Set a small delay to ensure state is updated before opening modal
      setTimeout(() => {
        setMissionPayModalEnabled(true)
      }, 500)

      toast.success('Balance updated! You can now contribute to the mission.', {
        style: toastStyle,
      })

      // Clear the URL parameter
      router.replace(
        {
          pathname: router.pathname,
          query: { ...router.query, onrampSuccess: undefined },
        },
        undefined,
        { shallow: true }
      )
    }
  }, [isWaitingForBalance, initialBalance, nativeBalance, router])

  // Cleanup effect when component unmounts or onrampSuccess changes
  useEffect(() => {
    if (!onrampSuccess) {
      setIsWaitingForBalance(false)
      setInitialBalance(null)
    }
  }, [onrampSuccess])

  // Cleanup when component unmounts
  useEffect(() => {
    return () => {
      setHasProcessedOnrampSuccess(false)
    }
  }, [])

  // Enhanced balance checking for onramp success
  useEffect(() => {
    if (usdInput && ethUsdPrice && nativeBalance !== undefined) {
      // If onrampSuccess is true but they don't have enough balance, show waiting message
      if (onrampSuccess && !hasEnoughBalance && usdInput) {
        setIsWaitingForBalanceUpdate(true)
      } else {
        setIsWaitingForBalanceUpdate(false)
      }
    } else {
      if (onrampSuccess && usdInput) {
        setIsWaitingForBalanceUpdate(true)
      } else {
        setIsWaitingForBalanceUpdate(false)
      }
    }
  }, [usdInput, ethUsdPrice, nativeBalance, onrampSuccess, hasEnoughBalance])

  // Add this new useEffect to restore USD input from URL
  useEffect(() => {
    if (
      router.isReady &&
      router.query.usdAmount &&
      typeof router.query.usdAmount === 'string'
    ) {
      const amount = router.query.usdAmount.replace(/[^0-9.]/g, '') // Clean the input, allow decimals

      if (amount && !isNaN(Number(amount))) {
        setUsdInput(amount)
        // Also update the ETH input based on the USD amount
        if (ethUsdPrice) {
          setInput((Number(amount) / ethUsdPrice).toFixed(6))
        }
      }
    }
  }, [router.isReady, router.query.usdAmount, ethUsdPrice])

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

          {/* Waiting for balance update after onramp */}
          {isWaitingForBalanceUpdate && (
            <div className="bg-[#020617] rounded-[5vw] md:rounded-[2vw] p-6 mb-4 border border-blue-500/30">
              <div className="flex items-center gap-3 mb-3">
                <LoadingSpinner />
                <h3 className="text-lg font-semibold text-blue-400">
                  Waiting for ETH Balance Update
                </h3>
              </div>
              <p className="text-sm opacity-80 mb-3">
                Your ETH purchase was successful! We're waiting for your wallet
                balance to update. This usually takes 1-2 minutes.
              </p>
              <p className="text-xs opacity-60 mb-4">
                Once your balance updates, you'll automatically be able to
                contribute to the mission.
              </p>
              <div className="flex gap-3">
                <StandardButton
                  styleOnly
                  className="flex-1 px-4 py-2 text-sm border border-blue-500/50 rounded-lg hover:bg-blue-500/10"
                  onClick={() => {
                    setIsWaitingForBalanceUpdate(false)
                    setMissionPayModalEnabled(true)

                    // Clear the URL parameter
                    router.replace(
                      {
                        pathname: router.pathname,
                        query: { ...router.query, onrampSuccess: undefined },
                      },
                      undefined,
                      { shallow: true }
                    )
                  }}
                  hoverEffect={false}
                >
                  Continue Anyway
                </StandardButton>
                <StandardButton
                  styleOnly
                  className="px-4 py-2 text-sm border border-gray-500/50 rounded-lg hover:bg-gray-500/10"
                  onClick={() => {
                    setIsWaitingForBalanceUpdate(false)
                    setInitialBalance(null)

                    // Clear the URL parameter
                    router.replace(
                      {
                        pathname: router.pathname,
                        query: { ...router.query, onrampSuccess: undefined },
                      },
                      undefined,
                      { shallow: true }
                    )
                  }}
                  hoverEffect={false}
                >
                  Cancel
                </StandardButton>
              </div>
            </div>
          )}

          <div className="mt-2">
            <MissionPayRedeemContent
              token={token}
              output={output}
              redeem={redeemMissionToken}
              setMissionPayModalEnabled={setMissionPayModalEnabled}
              tokenBalance={tokenBalance}
              tokenCredit={tokenCredit !== undefined ? tokenCredit : 0}
              claimTokenCredit={claimTokenCredit}
              currentStage={currentStage}
              stage={stage}
              handleUsdInputChange={handleUsdInputChange}
              calculateEthAmount={calculateEthAmount}
              formattedUsdInput={formattedUsdInput}
              formatTokenAmount={formatTokenAmount}
              redeemAmount={redeemAmount}
              isLoadingRedeemAmount={isLoadingRedeemAmount}
            />
          </div>
        </>
      )}
      {(modalEnabled || missionPayModalEnabled) && (
        <Modal id="mission-pay-modal" setEnabled={setMissionPayModalEnabled}>
          <div className="mt-12 w-screen h-full rounded-[2vmax] max-w-[500px] flex flex-col gap-4 items-start justify-start p-5 bg-gradient-to-b from-dark-cool to-darkest-cool">
            <div className="w-full flex gap-4 items-start justify-between">
              <h3 className="text- font-GoodTimes">{`Contribute to ${mission?.metadata?.name}`}</h3>
              <button
                type="button"
                className="flex h-10 w-10 border-2 items-center justify-center rounded-full focus:outline-none focus:ring-2 focus:ring-inset focus:ring-white"
                onClick={handleModalClose} // Use the new handler
              >
                <XMarkIcon className="h-6 w-6 text-white" aria-hidden="true" />
              </button>
            </div>

            {onrampSuccess ? (
              // Simplified view when returning from Coinbase
              <>
                <div className="w-full flex items-center gap-2">
                  <p>{`NFTs, tokens and rewards will be sent to:`}</p>
                  <button
                    className="p-1 px-4 flex items-center gap-2 bg-moon-indigo rounded-xl"
                    onClick={(e: any) => {
                      navigator.clipboard.writeText(address || '')
                      toast.success('Address copied to clipboard.', {
                        style: toastStyle,
                      })
                    }}
                  >
                    {address?.slice(0, 6)}...{address?.slice(-4)}
                    <CopyIcon />
                  </button>
                </div>

                <div className="w-full flex flex-col gap-4 justify-between">
                  <p>{`Message (optional)`}</p>
                  <input
                    id="payment-message-input"
                    type="text"
                    className="w-full bg-darkest-cool border-moon-indigo border-[1px] rounded-xl p-2"
                    placeholder="Attach an on-chain message to this payment"
                    value={message}
                    onChange={(e) => setMessage(e.target.value)}
                    maxLength={100}
                  />
                </div>

                <MissionTokenNotice />

                <div>
                  <ConditionCheckbox
                    id="contribution-terms-checkbox"
                    label={
                      <p className="text-sm">
                        {`I acknowledge that any token issued from this contribution is not a security, carries no profit expectation, and I accept all `}
                        <Link
                          href="https://docs.moondao.com/Launchpad/Launchpad-Disclaimer"
                          className="text-moon-blue"
                          target="_blank"
                          rel="noopener noreferrer"
                        >
                          risks
                        </Link>{' '}
                        {`associated with participation in the MoonDAO Launchpad.`}
                      </p>
                    }
                    agreedToCondition={agreedToCondition}
                    setAgreedToCondition={setAgreedToCondition}
                  />
                </div>

                <PrivyWeb3Button
                  id="contribute-button"
                  className="w-full bg-moon-indigo rounded-xl py-3"
                  label={`Contribute`}
                  action={buyMissionToken}
                  isDisabled={
                    !agreedToCondition ||
                    !usdInput ||
                    parseFloat(usdInput as string) <= 0
                  }
                />
              </>
            ) : (
              // Full view for normal flow
              <>
                {/* Removed Payment Method Selection - flow is now automatic based on balance */}

                <div className="w-full flex justify-between">
                  <p>{'Total Amount'}</p>
                  <div className="flex gap-2 items-center bg-moon-indigo/20 rounded-full px-3 py-1">
                    <Image
                      src="/coins/ETH.svg"
                      alt="ETH"
                      width={16}
                      height={16}
                      className="w-5 h-5 bg-light-cool rounded-full"
                    />
                    <span className="text-base">
                      {calculateEthAmount()} ETH
                    </span>
                  </div>
                </div>
                <div className="w-full flex justify-end">
                  <div className="flex gap-2 items-center">
                    <span>$</span>
                    <input
                      id="payment-input"
                      type="text"
                      className="text-right bg-transparent w-[100px] rounded-md px-2 outline-none font-bold border-[1px] border-moon-indigo [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                      value={formattedUsdInput}
                      onChange={handleUsdInputChange}
                      maxLength={10}
                      disabled={isFiatPaymentProcessing}
                    />
                    <span>{'USD'}</span>
                  </div>
                </div>
                <hr className="w-full" />
                {token?.tokenSymbol && (
                  <div className="w-full flex justify-between">
                    <p>{'Receive'}</p>
                    <p id="token-output">{`${formatTokenAmount(output, 2)} ${
                      token?.tokenSymbol
                    }`}</p>
                  </div>
                )}

                <div className="w-full flex items-center gap-2">
                  <p>{`NFTs, tokens and rewards will be sent to:`}</p>
                  <button
                    className="p-1 px-4 flex items-center gap-2 bg-moon-indigo rounded-xl"
                    onClick={(e: any) => {
                      navigator.clipboard.writeText(address || '')
                      toast.success('Address copied to clipboard.', {
                        style: toastStyle,
                      })
                    }}
                  >
                    {address?.slice(0, 6)}...{address?.slice(-4)}
                    <CopyIcon />
                  </button>
                </div>

                {token?.tokenSymbol && token?.tokenName && (
                  <div className="flex items-center gap-2">
                    <Image
                      src={mission?.metadata.logoUri}
                      width={100}
                      height={100}
                      className="rounded-full"
                      alt={`${token?.tokenSymbol} logo`}
                    />
                    <p>{`${token?.tokenSymbol} (${token?.tokenName})`}</p>
                  </div>
                )}

                <hr className="w-full" />

                {/* Unified flow: Show crypto form if balance sufficient, otherwise show CBOnramp */}
                {hasEnoughBalance ? (
                  // User has enough balance - show crypto pay form
                  <>
                    <div className="w-full flex flex-col gap-4 justify-between">
                      <p>{`Message (optional)`}</p>
                      <input
                        id="payment-message-input"
                        type="text"
                        className="w-full bg-darkest-cool border-moon-indigo border-[1px] rounded-xl p-2"
                        placeholder="Attach an on-chain message to this payment"
                        value={message}
                        onChange={(e) => setMessage(e.target.value)}
                        maxLength={100}
                      />
                    </div>

                    <MissionTokenNotice />

                    <div>
                      <ConditionCheckbox
                        id="contribution-terms-checkbox"
                        label={
                          <p className="text-sm">
                            {`I acknowledge that any token issued from this contribution is not a security, carries no profit expectation, and I accept all `}
                            <Link
                              href="https://docs.moondao.com/Launchpad/Launchpad-Disclaimer"
                              className="text-moon-blue"
                              target="_blank"
                              rel="noopener noreferrer"
                            >
                              risks
                            </Link>{' '}
                            {`associated with participation in the MoonDAO Launchpad.`}
                          </p>
                        }
                        agreedToCondition={agreedToCondition}
                        setAgreedToCondition={setAgreedToCondition}
                      />
                    </div>

                    <div className="w-full flex justify-between gap-4">
                      <NetworkSelector
                        chains={chains}
                        compact={true}
                        align="left"
                      />
                    </div>

                    <div className="w-full flex justify-between gap-4">
                      <StandardButton
                        styleOnly
                        className="w-1/2 p-2 text-center border-moon-indigo border-[1px] rounded-xl"
                        onClick={handleModalClose}
                        hoverEffect={false}
                      >
                        Cancel
                      </StandardButton>

                      <PrivyWeb3Button
                        id="contribute-button"
                        className="w-1/2 bg-moon-indigo rounded-xl"
                        label={`Contribute $${formattedUsdInput || '0'} USD`}
                        action={buyMissionToken}
                        isDisabled={
                          !agreedToCondition ||
                          !usdInput ||
                          parseFloat(usdInput as string) <= 0
                        }
                      />
                    </div>
                  </>
                ) : (
                  // User needs more ETH - show CBOnramp
                  <div className="w-full flex flex-col gap-4">
                    {isWaitingForBalanceUpdate && (
                      <div className="w-full p-4 bg-blue-500/20 border border-blue-500/50 rounded-lg">
                        <div className="flex items-center gap-3 mb-2">
                          <LoadingSpinner />
                          <h4 className="text-lg font-semibold text-blue-400">
                            Waiting for Balance Update
                          </h4>
                        </div>
                        <p className="text-sm text-blue-300 mb-2">
                          Your ETH purchase was successful! We're waiting for
                          your wallet balance to update.
                        </p>
                        <p className="text-xs text-blue-200 opacity-80">
                          This usually takes 1-2 minutes. Once updated, you'll
                          be able to contribute immediately.
                        </p>
                      </div>
                    )}

                    {!isWaitingForBalanceUpdate && (
                      <>
                        <CBOnramp
                          address={address || ''}
                          selectedChain={selectedChain}
                          usdInput={usdInput as string}
                          onSuccess={() => {
                            setJustCompletedFiatPurchase(true)
                            setIsFiatPaymentProcessing(false)
                            toast.success(
                              'ETH purchase completed! You can now contribute to the mission.',
                              {
                                style: toastStyle,
                              }
                            )
                          }}
                          redirectUrl={`${DEPLOYED_ORIGIN}/mission/${mission?.id}?onrampSuccess=true&usdAmount=${usdInput}`}
                        />

                        {usdInput && (
                          <div className="w-full p-3 bg-yellow-500/20 border border-yellow-500/50 rounded-lg">
                            <p className="text-sm text-yellow-400">
                              You need more ETH to contribute ${usdInput} USD.
                              Use Coinbase above to purchase ETH.
                            </p>
                          </div>
                        )}
                      </>
                    )}

                    <div className="w-full flex gap-3">
                      <StandardButton
                        styleOnly
                        className={`${
                          isWaitingForBalanceUpdate
                            ? 'px-4 py-2 text-sm border border-gray-500/50 rounded-lg hover:bg-gray-500/10'
                            : 'w-full p-2 text-center border-moon-indigo border-[1px] rounded-xl'
                        }`}
                        onClick={handleModalClose}
                        hoverEffect={false}
                      >
                        Close
                      </StandardButton>
                    </div>
                  </div>
                )}

                {isFiatPaymentProcessing && (
                  <div className="w-full p-3 bg-blue-500/20 border border-blue-500/50 rounded-lg">
                    <div className="flex items-center gap-2">
                      <LoadingSpinner />
                      <p className="text-sm">Processing your payment...</p>
                    </div>
                  </div>
                )}
              </>
            )}
          </div>
        </Modal>
      )}
    </>
  )
}
