import { XMarkIcon } from '@heroicons/react/20/solid'
import { waitForMessageReceived } from '@layerzerolabs/scan-client'
import { getAccessToken } from '@privy-io/react-auth'
import confetti from 'canvas-confetti'
import MISSION_CROSS_CHAIN_PAY_ABI from 'const/abis/CrossChainPay.json'
import JBV5MultiTerminal from 'const/abis/JBV5MultiTerminal.json'
import {
  DEFAULT_CHAIN_V5,
  MISSION_CROSS_CHAIN_PAY_ADDRESS,
  LAYERZERO_SOURCE_CHAIN_TO_DESTINATION_EID,
  JB_NATIVE_TOKEN_ADDRESS,
  DEPLOYED_ORIGIN,
  LAYERZERO_MAX_CONTRIBUTION_ETH,
  LAYERZERO_MAX_ETH,
  OVERVIEW_FLIGHT_TERMS_AND_CONDITIONS_DOCS_URL,
} from 'const/config'
import { JBRuleset } from 'juice-sdk-core'
import Image from 'next/image'
import Link from 'next/link'
import { useRouter } from 'next/router'
import React, { useMemo, useContext, useEffect, useState, useCallback, useRef } from 'react'
import toast from 'react-hot-toast'
import {
  prepareContractCall,
  sendAndConfirmTransaction,
  ZERO_ADDRESS,
  readContract,
  waitForReceipt,
} from 'thirdweb'
import { useActiveAccount } from 'thirdweb/react'
import { useCitizen } from '@/lib/citizen/useCitizen'
import { getIPFSGateway } from '@/lib/ipfs/gateway'
import { useOnrampAutoTransaction } from '@/lib/coinbase/useOnrampAutoTransaction'
import useOnrampJWT from '@/lib/coinbase/useOnrampJWT'
import useETHPrice from '@/lib/etherscan/useETHPrice'
import { calculateTokensFromPayment } from '@/lib/juicebox/tokenCalculations'
import toastStyle from '@/lib/marketplace/marketplace-utils/toastConfig'
import { isValidContributorEmail } from '@/lib/contribution/validateContributorEmail'
import { formatContributionOutput } from '@/lib/mission'
import { fetchNativeBalanceWei, pickChainWithMaxNativeBalance } from '@/lib/mission/contributeModalDefaultChain'
import { computeContributionMaxUsd } from '@/lib/mission/computeContributionMaxUsd'
import { formatEthFiveSigFigs } from '@/lib/mission/formatEthFiveSigFigs'
import PrivyWalletContext from '@/lib/privy/privy-wallet-context'
import { arbitrum, base, ethereum, sepolia, optimismSepolia } from '@/lib/rpc/chains'
import { useGasPrice } from '@/lib/rpc/useGasPrice'
import { getChainSlug } from '@/lib/thirdweb/chain'
import ChainContextV5 from '@/lib/thirdweb/chain-context-v5'
import client from '@/lib/thirdweb/client'
import useContract from '@/lib/thirdweb/hooks/useContract'
import { useNativeBalance } from '@/lib/thirdweb/hooks/useNativeBalance'
import Modal from '@/components/layout/Modal'
import NetworkSelector from '@/components/thirdweb/NetworkSelector'
import { CBOnramp } from '../coinbase/CBOnramp'
import ConditionCheckbox from '../layout/ConditionCheckbox'
import { LoadingSpinner } from '../layout/LoadingSpinner'
import ProgressBar from '../layout/ProgressBar'
import { PrivyWeb3Button } from '../privy/PrivyWeb3Button'
import { MissionContributeAutoTriggeringView } from './MissionContributeAutoTriggeringView'
import { MissionContributeModalHeader } from './MissionContributeModalHeader'
import { MissionContributeStatusNotices } from './MissionContributeStatusNotices'
import MissionTokenNotice from './MissionTokenNotice'
import { PaymentBreakdown } from './PaymentBreakdown'

type MissionContributeModalProps = {
  mission: any
  token: any
  modalEnabled: boolean
  setModalEnabled: (enabled: boolean) => void
  primaryTerminalAddress: string
  jbControllerContract?: any
  forwardClient?: any
  refreshTotalFunding?: () => void
  ruleset: JBRuleset
  usdInput: string
  setUsdInput: (usdInput: string) => void
}

export default function MissionContributeModal({
  mission,
  token,
  modalEnabled,
  setModalEnabled,
  primaryTerminalAddress,
  forwardClient,
  refreshTotalFunding,
  ruleset,
  usdInput,
  setUsdInput,
}: MissionContributeModalProps) {
  const { selectedChain, setSelectedChain } = useContext(ChainContextV5)
  const { selectedWallet, setSelectedWallet } = useContext(PrivyWalletContext)
  const defaultChainSlug = getChainSlug(DEFAULT_CHAIN_V5)
  const chainSlug = getChainSlug(selectedChain)
  const isCitizen = useCitizen(DEFAULT_CHAIN_V5)
  const router = useRouter()
  const isTestnet = process.env.NEXT_PUBLIC_CHAIN !== 'mainnet'
  const chains = useMemo(
    () => (isTestnet ? [sepolia, optimismSepolia] : [arbitrum, base, ethereum]),
    [isTestnet]
  )
  const chainSlugs = chains.map((chain) => getChainSlug(chain))

  const isOverviewMission = mission?.id === 4 || String(mission?.id) === '4'

  const contributionTermsCheckboxLabel = useMemo(
    () => (
      <p className="text-sm text-gray-300 leading-relaxed">
        {`I acknowledge that any token issued from this contribution is not a security, carries no profit expectation, and I accept all `}
        <Link
          href="https://docs.moondao.com/Launchpad/Launchpad-Disclaimer"
          className="text-blue-400 hover:text-blue-300 underline underline-offset-2"
          target="_blank"
          rel="noopener noreferrer"
        >
          risks
        </Link>
        {` associated with participation in the MoonDAO Launchpad.`}
        {isOverviewMission ? (
          <>
            {` I have read and agree to the `}
            <Link
              href={OVERVIEW_FLIGHT_TERMS_AND_CONDITIONS_DOCS_URL}
              className="text-blue-400 hover:text-blue-300 underline underline-offset-2"
              target="_blank"
              rel="noopener noreferrer"
            >
              Overview Flight Terms and Conditions
            </Link>
            {`.`}
          </>
        ) : null}
      </p>
    ),
    [isOverviewMission]
  )

  const newsletterCheckboxLabel = useMemo(
    () => (
      <p className="text-sm text-gray-300 leading-relaxed">
        Add me to the MoonDAO newsletter. You can unsubscribe anytime.
      </p>
    ),
    []
  )

  const account = useActiveAccount()
  // In test mode (Cypress), use mock address from window if available
  const mockAddress = typeof window !== 'undefined' && (window as any).__CYPRESS_MOCK_ADDRESS__
  const address = account?.address || mockAddress

  const selectedChainIdRef = useRef(selectedChain.id)
  selectedChainIdRef.current = selectedChain.id
  const contributeModalDefaultChainAppliedRef = useRef(false)

  const [input, setInput] = useState('')
  const [output, setOutput] = useState(0)
  const [message, setMessage] = useState(() => {
    const urlMessage = router?.query?.message
    return typeof urlMessage === 'string' ? decodeURIComponent(urlMessage) : ''
  })
  const [estimatedGas, setEstimatedGas] = useState<bigint>(BigInt(0))
  const [isLoadingGasEstimate, setIsLoadingGasEstimate] = useState(false)
  const [crossChainQuote, setCrossChainQuote] = useState<bigint>(BigInt(0))

  const { data: ethUsdPrice, isLoading: isLoadingEthUsdPrice } = useETHPrice(1, 'ETH_TO_USD')

  const [coinbaseEthReceive, setCoinbaseEthReceive] = useState<number | null>(null)
  const [coinbasePaymentSubtotal, setCoinbasePaymentSubtotal] = useState<number>()
  const [coinbasePaymentTotal, setCoinbasePaymentTotal] = useState<number>()
  const [coinbaseTotalFees, setCoinbaseTotalFees] = useState<number>()
  const [coinbaseEthInsufficient, setCoinbaseEthInsufficient] = useState<boolean>(false)

  const {
    generateJWT: generateOnrampJWT,
    clearJWT: clearOnrampJWT,
    getStoredJWT,
    verifyJWT: verifyOnrampJWT,
    isVerifying: isVerifyingJWT,
    error: jwtError,
  } = useOnrampJWT()

  const [showBackPrompt, setShowBackPrompt] = useState(false)
  const [contributorEmail, setContributorEmail] = useState('')
  const [newsletterOptIn, setNewsletterOptIn] = useState(false)
  const [agreedToCondition, setAgreedToCondition] = useState(() => {
    return router?.query?.agreed === 'true'
  })
  const [isAutoTriggering, setIsAutoTriggering] = useState(() => {
    if (typeof window === 'undefined') return false
    const storedJWT = getStoredJWT()
    const isPostOnramp = router?.query?.onrampSuccess === 'true'
    return !!storedJWT || isPostOnramp
  })
  const [jwtVerificationError, setJwtVerificationError] = useState<string | null>(null)
  const [transactionRejected, setTransactionRejected] = useState(false)

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

  const { nativeBalance, walletChain: nativeBalanceChain, refetch: refetchNativeBalance } =
    useNativeBalance()
  const walletConnectedChainSlug = nativeBalanceChain
    ? getChainSlug(nativeBalanceChain)
    : chainSlug
  const { effectiveGasPrice } = useGasPrice(selectedChain)

  useEffect(() => {
    if (!modalEnabled) {
      contributeModalDefaultChainAppliedRef.current = false
      return
    }
    if (!address || contributeModalDefaultChainAppliedRef.current) return

    const startedChainId = selectedChainIdRef.current
    let cancelled = false

    ;(async () => {
      const entries = await Promise.all(
        chains.map(async (chain) => {
          const wei = await fetchNativeBalanceWei(chain, address)
          return { chain, wei }
        })
      )
      if (cancelled) return
      if (selectedChainIdRef.current !== startedChainId) return

      const best = pickChainWithMaxNativeBalance(entries, chains)
      setSelectedChain(best)
      contributeModalDefaultChainAppliedRef.current = true
    })()

    return () => {
      cancelled = true
    }
  }, [modalEnabled, address, chains, setSelectedChain])

  // Check if LayerZero quote exceeds the protocol limit
  const layerZeroLimitExceeded = useMemo(() => {
    const isCrossChain = chainSlug !== defaultChainSlug
    if (!isCrossChain) return false

    if (chainSlug !== 'ethereum' && chainSlug !== 'base') return false

    if (crossChainQuote === BigInt(0)) return false

    const LAYERZERO_MAX_WEI = BigInt(Math.floor(LAYERZERO_MAX_ETH * 1e18))
    return crossChainQuote > LAYERZERO_MAX_WEI
  }, [chainSlug, defaultChainSlug, crossChainQuote])

  // Calculate ETH amount from USD for display
  const calculateEthAmount = useCallback(() => {
    const numericValue = usdInput.replace(/,/g, '')

    if (!usdInput || isNaN(Number(numericValue))) {
      return '0'
    }
    if (!ethUsdPrice) {
      return '0'
    }
    const eth = Number(numericValue) / ethUsdPrice
    return formatEthFiveSigFigs(eth)
  }, [usdInput, ethUsdPrice])

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

  const formattedUsdInput = formatWithCommas(usdInput as string)

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
    [setInput, formatInputWithCommas, setUsdInput]
  )

  // Calculate gas cost in ETH and USD
  // Note: estimatedGas already includes buffers (130-180%), so we use effectiveGasPrice
  // which is baseFee + priorityFee (no additional buffer) to match wallet displays
  const gasCostDisplay = useMemo(() => {
    if (
      !estimatedGas ||
      estimatedGas === BigInt(0) ||
      !effectiveGasPrice ||
      effectiveGasPrice === BigInt(0)
    ) {
      return { eth: '0.0000', usd: '0.00' }
    }

    const gasCostWei = estimatedGas * effectiveGasPrice
    const gasCostEth = Number(gasCostWei) / 1e18

    const gasCostUsd = ethUsdPrice ? gasCostEth * ethUsdPrice : 0

    let formattedGasCostEth
    if (gasCostEth >= 0.01) {
      formattedGasCostEth = gasCostEth.toFixed(4)
    } else if (gasCostEth >= 0.0001) {
      formattedGasCostEth = gasCostEth.toFixed(6)
    } else {
      formattedGasCostEth = gasCostEth.toFixed(8)
    }

    return {
      eth: formattedGasCostEth,
      usd: gasCostUsd.toFixed(2),
    }
  }, [estimatedGas, effectiveGasPrice, ethUsdPrice])

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

  // Estimate gas for the contribution transaction
  const estimateContributionGas = useCallback(async () => {
    if (!account || !address) return

    const inputValue = parseFloat(input) || 0
    if (inputValue <= 0 || !isFinite(inputValue)) {
      setEstimatedGas(BigInt(0))
      setCrossChainQuote(BigInt(0))
      return
    }

    if (!selectedChain?.id || !mission?.projectId) {
      console.warn('Missing required data for gas estimation')
      return
    }

    const isCrossChain = chainSlug !== defaultChainSlug

    if (isCrossChain && (chainSlug === 'ethereum' || chainSlug === 'base') && ethUsdPrice) {
      const cleanUsdInput = usdInput ? usdInput.replace(/,/g, '') : '0'
      const usdValue = parseFloat(cleanUsdInput)
      if (usdValue > 0) {
        const ethAmount = usdValue / ethUsdPrice
        if (ethAmount > LAYERZERO_MAX_CONTRIBUTION_ETH) {
          setCrossChainQuote(BigInt(Math.floor(0.25 * 1e18)))
          setEstimatedGas(BigInt(300000))
          setIsLoadingGasEstimate(false)
          return
        }
      }
    }

    if (isCrossChain && !crossChainPayContract) {
      setIsLoadingGasEstimate(false)
      return
    }
    if (!isCrossChain && !primaryTerminalContract) {
      setIsLoadingGasEstimate(false)
      return
    }

    try {
      let gasEstimate: bigint = BigInt(0)

      if (isCrossChain) {
        if (!output || output <= 0) {
          setIsLoadingGasEstimate(true)
          return
        }

        let quoteCrossChainPay: any
        try {
          const inputValueWei = toWei(inputValue)
          const outputTokens = toWei(output)

          quoteCrossChainPay = await readContract({
            contract: crossChainPayContract,
            method: 'quoteCrossChainPay' as string,
            params: [
              LAYERZERO_SOURCE_CHAIN_TO_DESTINATION_EID[chainSlug].toString(),
              inputValueWei,
              mission?.projectId,
              address || ZERO_ADDRESS,
              outputTokens,
              message,
              '0x00',
            ],
          })

          setCrossChainQuote(BigInt(quoteCrossChainPay))
        } catch (quoteError: any) {
          console.error('❌ LayerZero quote failed:', quoteError)
          throw quoteError
        }

        const transaction = prepareContractCall({
          contract: crossChainPayContract,
          method: 'crossChainPay' as string,
          params: [
            LAYERZERO_SOURCE_CHAIN_TO_DESTINATION_EID[chainSlug].toString(),
            mission?.projectId,
            toWei(inputValue),
            address || ZERO_ADDRESS,
            (toWei(output) * BigInt(95)) / BigInt(100),
            message,
            '0x00',
          ],
          value: BigInt(quoteCrossChainPay),
        })

        try {
          const txData =
            typeof transaction.data === 'function' ? await transaction.data() : transaction.data

          const estimateResponse = await fetch('/api/rpc/estimate-gas', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              chainId: selectedChain.id,
              from: address,
              to: MISSION_CROSS_CHAIN_PAY_ADDRESS,
              data: txData,
              value: `0x${BigInt(quoteCrossChainPay).toString(16)}`,
            }),
          })

          if (!estimateResponse.ok) {
            const errorText = await estimateResponse.text()
            console.error('Gas estimation API error response:', errorText)
            throw new Error(
              `Gas estimation API returned ${estimateResponse.status}: ${estimateResponse.statusText}`
            )
          }

          const contentType = estimateResponse.headers.get('content-type')
          if (!contentType || !contentType.includes('application/json')) {
            const responseText = await estimateResponse.text()
            console.error('Non-JSON response from gas estimation API:', responseText)
            throw new Error('Gas estimation API returned non-JSON response')
          }

          const estimateData = await estimateResponse.json()

          if (estimateData.error) {
            console.error('❌ Gas estimation API error:', estimateData.error)
            throw new Error(estimateData.error)
          }

          gasEstimate = BigInt(estimateData.gasEstimate)
        } catch (estimationError: any) {
          console.error('❌ Gas estimation error:', estimationError)
          gasEstimate = BigInt(300000)
        }
      } else {
        setCrossChainQuote(BigInt(0))

        if (!output || output <= 0) {
          setIsLoadingGasEstimate(true)
          return
        }

        const transaction = prepareContractCall({
          contract: primaryTerminalContract,
          method: 'pay' as string,
          params: [
            mission?.projectId,
            JB_NATIVE_TOKEN_ADDRESS,
            toWei(inputValue),
            address,
            (toWei(output) * BigInt(95)) / BigInt(100),
            message,
            '0x00',
          ],
          value: toWei(inputValue),
        })

        try {
          const txData =
            typeof transaction.data === 'function' ? await transaction.data() : transaction.data

          const estimateResponse = await fetch('/api/rpc/estimate-gas', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              chainId: selectedChain.id,
              from: address,
              to: primaryTerminalAddress,
              data: txData,
              value: `0x${toWei(inputValue).toString(16)}`,
            }),
          })

          if (!estimateResponse.ok) {
            const errorText = await estimateResponse.text()
            console.error('Gas estimation API error response:', errorText)
            throw new Error(
              `Gas estimation API returned ${estimateResponse.status}: ${estimateResponse.statusText}`
            )
          }

          const contentType = estimateResponse.headers.get('content-type')
          if (!contentType || !contentType.includes('application/json')) {
            const responseText = await estimateResponse.text()
            console.error('Non-JSON response from gas estimation API:', responseText)
            throw new Error('Gas estimation API returned non-JSON response')
          }

          const estimateData = await estimateResponse.json()

          if (estimateData.error) {
            console.error('❌ Gas estimation API error:', estimateData.error)
            throw new Error(estimateData.error)
          }

          gasEstimate = BigInt(estimateData.gasEstimate)
        } catch (estimationError: any) {
          console.error('❌ Gas estimation error:', estimationError)
          gasEstimate = BigInt(180000)
        }
      }

      const bufferPercent = isCrossChain ? 180 : 130
      const gasWithBuffer = (gasEstimate * BigInt(bufferPercent)) / BigInt(100)
      setEstimatedGas(gasWithBuffer)
      setIsLoadingGasEstimate(false)
    } catch (error) {
      console.error(
        `Error estimating gas for ${chainSlug}:`,
        error instanceof Error ? error.message : error
      )
      setEstimatedGas(BigInt(300000))
      setIsLoadingGasEstimate(false)
    }
  }, [
    account,
    address,
    primaryTerminalContract,
    crossChainPayContract,
    input,
    chainSlug,
    defaultChainSlug,
    mission?.projectId,
    output,
    message,
    primaryTerminalAddress,
    selectedChain,
    ethUsdPrice,
    usdInput,
  ])

  // Calculate required ETH amount
  // Add a small safety buffer (3-5%) to ensure users have enough after onramp
  const requiredEth = useMemo(() => {
    const cleanUsdInput = usdInput ? usdInput.replace(/,/g, '') : '0'
    const isCrossChain = chainSlug !== defaultChainSlug

    let transactionValueEth: number
    if (isCrossChain && crossChainQuote > BigInt(0) && !layerZeroLimitExceeded) {
      transactionValueEth = Number(crossChainQuote) / 1e18
    } else {
      transactionValueEth = usdInput && ethUsdPrice ? Number(cleanUsdInput) / ethUsdPrice : 0
    }

    // Calculate base gas cost (estimatedGas already has buffers, effectiveGasPrice is baseFee+priorityFee)
    const baseGasCostWei = effectiveGasPrice ? estimatedGas * effectiveGasPrice : BigInt(0)

    // Add small safety buffer (3%) for requiredEth to account for base fee fluctuations
    // This ensures users have enough after onramp, but is much smaller than previous estimates
    const safetyBuffer = BigInt(103) // 3%
    const gasCostWei = (baseGasCostWei * safetyBuffer) / BigInt(100)
    const gasCostEth = Number(gasCostWei) / 1e18

    const total = transactionValueEth + gasCostEth

    return total
  }, [
    usdInput,
    ethUsdPrice,
    estimatedGas,
    effectiveGasPrice,
    crossChainQuote,
    chainSlug,
    defaultChainSlug,
    layerZeroLimitExceeded,
  ])

  const hasEnoughBalance = useMemo(() => {
    const hasEnough = nativeBalance && Number(nativeBalance) >= requiredEth && requiredEth > 0
    return hasEnough
  }, [nativeBalance, requiredEth])

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
    setUsdInput(formatInputWithCommas(maxUsd.toFixed(2)))
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

  // Calculate LayerZero cross-chain fee
  const layerZeroFeeDisplay = useMemo(() => {
    const cleanUsdInput = usdInput ? usdInput.replace(/,/g, '') : '0'
    const isCrossChain = chainSlug !== defaultChainSlug

    if (!isCrossChain || crossChainQuote === BigInt(0)) {
      return { eth: '0', usd: '0.00' }
    }

    if (layerZeroLimitExceeded) {
      return { eth: '0', usd: '0.00' }
    }

    const contributionEth = usdInput && ethUsdPrice ? Number(cleanUsdInput) / ethUsdPrice : 0
    const quoteEth = Number(crossChainQuote) / 1e18
    const layerZeroFeeEth = quoteEth - contributionEth
    const layerZeroFeeUsd = ethUsdPrice ? layerZeroFeeEth * ethUsdPrice : 0

    return {
      eth: layerZeroFeeEth.toFixed(6),
      usd: layerZeroFeeUsd.toFixed(2),
    }
  }, [crossChainQuote, usdInput, ethUsdPrice, chainSlug, defaultChainSlug, layerZeroLimitExceeded])

  // Calculate how much ETH the user needs to buy
  const ethDeficit = useMemo(() => {
    if (!nativeBalance || !requiredEth) return 0

    return Math.max(0, requiredEth - Number(nativeBalance))
  }, [nativeBalance, requiredEth])

  // Calculate USD equivalent
  const usdDeficit = useMemo(() => {
    if (!ethUsdPrice || ethDeficit === 0) return '0.00'

    const usdAmount = ethDeficit * ethUsdPrice

    if (usdAmount > 0 && usdAmount < 2) {
      return '2.00'
    }

    return usdAmount.toFixed(2)
  }, [ethDeficit, ethUsdPrice])

  const isAdjustedForMinimum = useMemo(() => {
    return parseFloat(usdDeficit) === 2.0 && ethDeficit > 0 && ethDeficit * ethUsdPrice < 2
  }, [usdDeficit, ethDeficit, ethUsdPrice])

  const adjustedEthDeficit = useMemo(() => {
    if (!ethUsdPrice || ethDeficit === 0) return 0

    const usdAmount = ethDeficit * ethUsdPrice

    if (usdAmount > 0 && usdAmount < 2) {
      return 2 / ethUsdPrice
    }

    return ethDeficit
  }, [ethDeficit, ethUsdPrice])

  const refreshMissionData = useCallback(() => {
    refreshTotalFunding?.()
  }, [refreshTotalFunding])

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

    if (isLoadingEthUsdPrice || !ethUsdPrice) {
      toast.error('Please wait for ETH price to load.', {
        style: toastStyle,
      })
      return
    }

    const inputValue = parseFloat(input) || 0
    const usdValue = parseFloat(usdInput.replace(/,/g, '')) || 0

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

    const emailTrim = contributorEmail.trim()
    if (!isValidContributorEmail(emailTrim)) {
      toast.error('Please enter a valid email address.', {
        style: toastStyle,
      })
      return
    }

    // Reset rejection state when attempting a new transaction
    setTransactionRejected(false)

    try {
      let receipt: any
      if (chainSlug !== defaultChainSlug) {
        const quoteCrossChainPay: any = await readContract({
          contract: crossChainPayContract,
          method: 'quoteCrossChainPay' as string,
          params: [
            LAYERZERO_SOURCE_CHAIN_TO_DESTINATION_EID[chainSlug].toString(),
            toWei(inputValue),
            mission?.projectId,
            address || ZERO_ADDRESS,
            toWei(output),
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
            toWei(inputValue),
            address || ZERO_ADDRESS,
            (toWei(output) * BigInt(95)) / BigInt(100),
            message,
            '0x00',
          ],
          value: BigInt(quoteCrossChainPay),
        })

        const originReceipt: any = await sendAndConfirmTransaction({
          transaction,
          account,
        })
        toast.success('Payment recieved! Please wait a minute or two for settlement.', {
          style: toastStyle,
        })
        const destinationMessage = await waitForMessageReceived(
          isTestnet ? 19999 : 1,
          originReceipt.transactionHash
        )
        receipt = await waitForReceipt({
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
            toWei(inputValue),
            address,
            (toWei(output) * BigInt(95)) / BigInt(100),
            message,
            '0x00',
          ],
          value: toWei(inputValue),
        })

        receipt = await sendAndConfirmTransaction({
          transaction,
          account,
        })
      }

      const accessToken = await getAccessToken()

      const contributionNotification: any = await fetch('/api/mission/contribution-notification', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          txHash: receipt.transactionHash,
          accessToken: accessToken,
          txChainSlug: defaultChainSlug,
          projectId: mission?.projectId,
          contributorEmail: emailTrim,
          newsletterOptIn,
        }),
      })
      const contributionNotificationData = await contributionNotification.json()

      if (contributionNotificationData?.message) {
        console.log(contributionNotificationData.message)
      }

      setInput('0')
      setUsdInput('0')

      // Show back-a-candidate prompt only for mission 4 (Overview flight on Arbitrum)
      if (isOverviewMission) {
        setShowBackPrompt(true)
      } else {
        setModalEnabled?.(false)
      }

      // Clean up onramp URL params after successful transaction
      if (router?.query?.onrampSuccess === 'true') {
        const { onrampSuccess: _, ...restQuery } = router.query
        router.replace(
          {
            pathname: router.pathname,
            query: restQuery,
          },
          undefined,
          { shallow: true }
        )
      }

      confetti({
        particleCount: 150,
        spread: 100,
        origin: { y: 0.6 },
        shapes: ['circle', 'star'],
        colors: ['#ffffff', '#FFD700', '#00FFFF', '#ff69b4', '#8A2BE2'],
      })

      if (!isCitizen) {
        // Check free mint eligibility via the API (uses Bendystraw participants data)
        try {
          const eligibilityRes = await fetch(
            `/api/mission/freeMint?address=${address}`
          )
          const eligibilityData = await eligibilityRes.json()
          if (eligibilityData?.data?.eligible) {
            toast.success(
              <div>
                <Link href={'/citizen?freeMint=true'}>
                  Mission token purchased! Click to claim free citizenship!
                </Link>
              </div>,
              {
                style: toastStyle,
              }
            )
          }
        } catch (err) {
          console.error('Error checking free mint eligibility:', err)
        }
      } else {
        toast.success('Mission token purchased!', {
          style: toastStyle,
        })
        refreshMissionData()
      }
    } catch (error) {
      console.error('Error purchasing tokens:', error)
      toast.error('Failed to purchase tokens', {
        style: toastStyle,
      })
      throw error
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
    isCitizen,
    router,
    setUsdInput,
    contributorEmail,
    newsletterOptIn,
    isOverviewMission,
  ])

  // Calculate quote when input changes
  useEffect(() => {
    if (parseFloat(input) > 0 && ruleset && ruleset[0] && ruleset[1]) {
      getQuote()
    } else if (input === '0' || input === '') {
      setOutput(0)
    }
  }, [input, getQuote, ruleset])

  // Update ETH input when USD changes
  useEffect(() => {
    if (usdInput && ethUsdPrice) {
      const finalNumericValue = usdInput.replace(/,/g, '')
      if (!isNaN(Number(finalNumericValue))) {
        setInput((Number(finalNumericValue) / ethUsdPrice).toFixed(6))
      }
    }
  }, [usdInput, ethUsdPrice])

  // Estimate gas on input change
  useEffect(() => {
    const cleanUsdInput = usdInput ? usdInput.replace(/,/g, '') : '0'
    const usdValue = parseFloat(cleanUsdInput)

    if (usdValue > 0 && input && parseFloat(input) > 0) {
      setIsLoadingGasEstimate(true)
    }

    const timeoutId = setTimeout(() => {
      if (usdValue > 0 && input && parseFloat(input) > 0) {
        estimateContributionGas()
      } else {
        setIsLoadingGasEstimate(false)
        setEstimatedGas(BigInt(0))
        setCrossChainQuote(BigInt(0))
      }
    }, 2000)

    return () => clearTimeout(timeoutId)
  }, [usdInput, input, selectedChain, estimateContributionGas])

  // Use the onramp auto-transaction hook for handling post-onramp flow
  useOnrampAutoTransaction({
    address,
    context: mission?.id?.toString() || 'mission',
    expectedChainSlug: chainSlug,
    refetchNativeBalance: async () => {
      await refetchNativeBalance()
    },
    onTransaction: async () => {
      try {
        await buyMissionToken()
      } catch (error) {
        setTransactionRejected(true)
        setIsAutoTriggering(false)
        throw error
      }
    },
    onFormRestore: (restored: any) => {
      const fd = restored?.formData ?? restored
      if (fd?.usdAmount) {
        setUsdInput(fd.usdAmount)
      }
      if (typeof fd?.agreed === 'boolean') {
        setAgreedToCondition(fd.agreed)
      }
      if (fd?.message) {
        setMessage(fd.message)
      }
      if (typeof fd?.contributorEmail === 'string') {
        setContributorEmail(fd.contributorEmail)
      }
      if (typeof fd?.newsletterOptIn === 'boolean') {
        setNewsletterOptIn(fd.newsletterOptIn)
      }
      setIsAutoTriggering(true)
    },
    checkBalanceSufficient: async () => {
      return !!hasEnoughBalance
    },
    shouldProceed: (restored: any) => {
      const fd = restored?.formData ?? restored
      const agreed = fd?.agreed ?? agreedToCondition
      const amount = fd?.usdAmount || usdInput
      return agreed && amount && parseFloat(amount.replace(/,/g, '')) > 0
    },
    restoreCache: () => {
      // For mission flow, the "cache" is the JWT payload
      // We decode it here to get the form data
      const storedJWT = getStoredJWT()
      if (!storedJWT) return null
      try {
        const parts = storedJWT.split('.')
        if (parts.length !== 3) return null
        const payload = JSON.parse(atob(parts[1]))
        return {
          formData: {
            usdAmount: payload.usdAmount,
            agreed: payload.agreed,
            message: payload.message,
            selectedWallet: payload.selectedWallet,
            chainSlug: payload.chainSlug,
            contributorEmail: payload.contributorEmail,
            newsletterOptIn: payload.newsletterOptIn,
          },
        }
      } catch {
        return null
      }
    },
    getChainSlugFromCache: (restored: any) =>
      restored?.formData?.chainSlug ?? restored?.chainSlug,
    setSelectedWallet,
    waitForReady: () => {
      return !isLoadingGasEstimate && estimatedGas > BigInt(0) && effectiveGasPrice > BigInt(0)
    },
    waitForReadyMaxAttempts: 60,
    waitForReadyDelayMs: 500,
  })

  // Refresh balance immediately when returning from Coinbase onramp
  useEffect(() => {
    const isPostOnramp = router?.query?.onrampSuccess === 'true'
    // Check address instead of account to support E2E tests with mock addresses
    if (isPostOnramp && address) {
      // Immediately refresh balance when returning from onramp
      refetchNativeBalance()
      const timeoutId = setTimeout(() => {
        refetchNativeBalance()
      }, 2000)

      // In dev mode, also refresh more aggressively to catch balance updates
      if (process.env.NEXT_PUBLIC_ENV === 'dev') {
        const devRefreshInterval = setInterval(() => {
          refetchNativeBalance()
        }, 1000)

        // Stop refreshing after 10 seconds in dev mode
        const devTimeout = setTimeout(() => {
          clearInterval(devRefreshInterval)
        }, 10000)

        return () => {
          clearTimeout(timeoutId)
          clearInterval(devRefreshInterval)
          clearTimeout(devTimeout)
        }
      }

      return () => clearTimeout(timeoutId)
    }
  }, [router?.query?.onrampSuccess, account, address, refetchNativeBalance])


  // Callback to receive quote data from CBOnramp
  const handleCoinbaseQuote = useCallback(
    (ethAmount: number, paymentSubtotal: number, paymentTotal: number, totalFees: number) => {
      setCoinbaseEthReceive(ethAmount)
      setCoinbasePaymentSubtotal(paymentSubtotal)
      setCoinbasePaymentTotal(paymentTotal)
      setCoinbaseTotalFees(totalFees)

      const currentBalance = nativeBalance ? Number(nativeBalance) : 0
      const totalAfterPurchase = ethAmount + currentBalance
      const isInsufficient = totalAfterPurchase < requiredEth

      setCoinbaseEthInsufficient(isInsufficient)
    },
    [nativeBalance, requiredEth]
  )

  // Clear Coinbase fee state when user no longer needs onramp
  useEffect(() => {
    if (hasEnoughBalance || ethDeficit === 0) {
      setCoinbaseEthReceive(null)
      setCoinbasePaymentSubtotal(undefined)
      setCoinbasePaymentTotal(undefined)
      setCoinbaseTotalFees(undefined)
      setCoinbaseEthInsufficient(false)
    }
  }, [hasEnoughBalance, ethDeficit])

  // Clear parameter when modal is closed
  const handleModalClose = useCallback(() => {
    setShowBackPrompt(false)
    if (setModalEnabled) {
      setModalEnabled(false)
    }

    // Reset all auto-trigger states
    setTransactionRejected(false)
    setIsAutoTriggering(false)
    setJwtVerificationError(null)

    // Clear Coinbase fee state
    setCoinbaseEthReceive(null)
    setCoinbasePaymentSubtotal(undefined)
    setCoinbasePaymentTotal(undefined)
    setCoinbaseTotalFees(undefined)
    setCoinbaseEthInsufficient(false)

    clearOnrampJWT()
    setContributorEmail('')
    setNewsletterOptIn(false)

    // Clean up onramp URL params when modal closes
    if (router?.query?.onrampSuccess === 'true') {
      const { onrampSuccess: _, ...restQuery } = router.query
      router.replace(
        {
          pathname: router.pathname,
          query: restQuery,
        },
        undefined,
        { shallow: true }
      )
    }
  }, [setModalEnabled, router, clearOnrampJWT])

  const showEstimatedGas = useMemo(() => {
    return usdInput && parseFloat(usdInput) > 0
  }, [usdInput])

  if (!modalEnabled) return null

  return (
    <Modal
      id="mission-contribute-modal"
      setEnabled={handleModalClose}
      size="xl"
      showCloseButton={false}
    >
      <div className="p-8 bg-gradient-to-br from-gray-900/95 via-blue-900/20 to-purple-900/15 backdrop-blur-2xl rounded-2xl border border-white/10 shadow-2xl">
        <MissionContributeModalHeader
          missionName={mission?.metadata?.name}
          onClose={handleModalClose}
        />

        <div className="space-y-5">
          {showBackPrompt ? (
            <div className="space-y-6 py-4">
              <div className="text-center">
                <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-gradient-to-br from-green-500/30 to-emerald-500/20 flex items-center justify-center border border-green-500/30">
                  <span className="text-3xl">✓</span>
                </div>
                <h3 className="text-xl font-semibold text-white mb-2">You contributed!</h3>
                <p className="text-gray-400 text-sm max-w-md mx-auto">
                  Your support helps build the future of space. Back a candidate on the leaderboard to amplify your impact in the community.
                </p>
              </div>
              <div className="flex flex-col sm:flex-row gap-3">
                <Link
                  href={`/overview-vote?from=mission&missionId=${mission?.id ?? ''}`}
                  className="flex-1 flex justify-center items-center px-6 py-3.5 bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-500 hover:to-purple-500 text-white font-semibold rounded-xl transition-all duration-300 shadow-lg hover:shadow-purple-500/20"
                >
                  Back a Candidate
                </Link>
                <button
                  type="button"
                  onClick={handleModalClose}
                  className="flex-1 px-6 py-3.5 bg-slate-800/60 hover:bg-slate-700/60 border border-white/10 text-white font-medium rounded-xl transition-all duration-300"
                >
                  Done for now
                </button>
              </div>
            </div>
          ) : isAutoTriggering ? (
            <MissionContributeAutoTriggeringView
              account={account}
              isVerifyingJWT={isVerifyingJWT}
              onrampJWTPayload={null}
              getStoredJWT={getStoredJWT}
              jwtVerificationError={jwtVerificationError}
              hasEnoughBalance={hasEnoughBalance}
              isLoadingGasEstimate={isLoadingGasEstimate}
              usdInput={usdInput}
              missionName={mission?.metadata?.name}
              onDismissError={() => {
                setJwtVerificationError(null)
                setIsAutoTriggering(false)
                clearOnrampJWT()
              }}
              router={router}
              formatWithCommas={formatWithCommas}
            />
          ) : (
            <>
              <MissionContributeStatusNotices
                onrampSuccess={router?.query?.onrampSuccess === 'true'}
                transactionRejected={transactionRejected}
                hasEnoughBalance={hasEnoughBalance}
                ethDeficit={ethDeficit}
              />

              <div className="space-y-3">
                <label className="text-gray-300 font-medium text-sm uppercase tracking-wider">
                  Network
                </label>
                <NetworkSelector chains={chains} align="left" />
              </div>

              {/* Contribution amount — primary input */}
              <div className="space-y-3">
                <label
                  htmlFor="payment-input"
                  className="text-white font-semibold text-sm uppercase tracking-wider"
                >
                  You contribute
                </label>
                <div className="bg-slate-950/90 border border-cyan-500/25 ring-1 ring-cyan-500/10 shadow-lg shadow-black/30 rounded-xl p-4">
                  <div className="flex items-center justify-between gap-4">
                    <div className="flex items-center space-x-4">
                      <div className="w-10 h-10 rounded-full bg-slate-800 flex items-center justify-center border border-white/15">
                        <Image
                          src="/coins/ETH.svg"
                          alt="ETH"
                          width={24}
                          height={24}
                          className="w-6 h-6"
                        />
                      </div>
                      <div>
                        <p className="font-semibold text-white text-lg">
                          {calculateEthAmount()}
                        </p>
                        <p className="text-gray-500 text-xs">ETH (estimated)</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2 rounded-xl px-3 py-2 border border-white/15 bg-black/50 shadow-inner">
                      <span className="text-cyan-200/80 text-lg font-bold shrink-0">$</span>
                      <input
                        id="payment-input"
                        type="text"
                        inputMode="decimal"
                        className="min-w-0 w-24 sm:w-28 bg-transparent border-none outline-none text-white text-right text-lg font-bold placeholder-gray-600 focus:placeholder-gray-500 focus:ring-0 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                        value={usdInput}
                        onChange={handleUsdInputChange}
                        placeholder="0"
                        maxLength={15}
                      />
                      <span className="text-gray-300 text-lg font-bold shrink-0">USD</span>
                    </div>
                  </div>
                  <div className="mt-3 pt-3 border-t border-white/10 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
                    <p className="text-gray-400 text-xs sm:text-sm">
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
                      className="self-start sm:self-auto px-3 py-1.5 rounded-lg text-xs font-semibold uppercase tracking-wide bg-white/10 hover:bg-white/15 border border-white/15 text-white disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                    >
                      Max
                    </button>
                  </div>
                </div>
              </div>

              {/* Token quote — read-only output (not a second input) */}
              <div className="space-y-3">
                <p className="text-gray-500 font-medium text-sm uppercase tracking-wider">
                  You receive
                </p>
                <div className="bg-slate-900/50 border border-white/[0.07] rounded-xl p-4">
                  <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                    <div className="flex items-center space-x-4 min-w-0">
                      <div className="w-12 h-12 rounded-full overflow-hidden border border-white/10 shrink-0">
                        <Image
                          src={getIPFSGateway(mission?.metadata.logoUri)}
                          width={48}
                          height={48}
                          className="w-full h-full object-cover"
                          alt={`${token?.tokenSymbol || 'Token'} logo`}
                        />
                      </div>
                      <div className="min-w-0">
                        <p className="font-semibold text-white text-lg">{token?.tokenSymbol || 'Tokens'}</p>
                        {(() => {
                          const sym = (token?.tokenSymbol || '').trim()
                          const name = (token?.tokenName || '').trim()
                          if (!name || name.toLowerCase() === sym.toLowerCase()) return null
                          return <p className="text-gray-500 text-xs">{name}</p>
                        })()}
                      </div>
                    </div>
                    <div
                      className="text-left sm:text-right border-t sm:border-t-0 border-white/[0.08] pt-3 sm:pt-0 sm:border-l sm:pl-4 sm:min-w-[10rem]"
                      role="status"
                      aria-live="polite"
                      aria-label={`${token?.tokenSymbol || 'Tokens'}: ${formatContributionOutput(output)}`}
                    >
                      <p className="font-bold text-emerald-200/95 text-xl sm:text-2xl tabular-nums tracking-tight sm:text-right">
                        {formatContributionOutput(output)}
                      </p>
                    </div>
                  </div>
                </div>
              </div>

              {/* Conditional Content Based on Balance */}
              {layerZeroLimitExceeded ? (
                // LayerZero limit exceeded
                <div className="space-y-6 pt-2">
                  <div className="bg-gradient-to-r from-blue-500/15 to-purple-500/10 backdrop-blur-sm border border-blue-500/30 rounded-xl p-6">
                    <div className="flex items-start gap-4">
                      <div className="flex-shrink-0 w-12 h-12 bg-gradient-to-br from-blue-500/30 to-purple-500/20 rounded-xl flex items-center justify-center border border-blue-500/20">
                        <span className="text-2xl">💡</span>
                      </div>
                      <div className="flex-1">
                        <h4 className="text-white font-semibold text-lg mb-3">How to Proceed</h4>
                        <div className="space-y-3 text-sm text-gray-300">
                          <p>
                            <strong className="text-blue-300">Option 1:</strong> Reduce your
                            contribution to under $
                            {(LAYERZERO_MAX_CONTRIBUTION_ETH * (ethUsdPrice || 0)).toFixed(0)} USD (
                            + fees)
                          </p>
                          <p>
                            <strong className="text-blue-300">Option 2:</strong> Switch to Arbitrum
                            network and contribute any amount without limits
                          </p>
                          <p>
                            <strong className="text-blue-300">Option 3:</strong> Split your
                            contribution into multiple transactions
                          </p>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              ) : hasEnoughBalance ? (
                // User has enough balance
                <>
                  {/* Message Input */}
                  <div className="space-y-3">
                    <label className="text-gray-300 font-medium text-sm uppercase tracking-wider">
                      Message (Optional)
                    </label>
                    <input
                      id="payment-message-input"
                      type="text"
                      className="w-full bg-black/30 border border-white/10 rounded-xl p-4 text-white placeholder-gray-500 hover:bg-black/40 hover:border-white/20 transition-all duration-300 focus:outline-none focus:ring-2 focus:ring-blue-500/30 focus:border-blue-500/30"
                      placeholder="Attach an on-chain message to this payment"
                      value={message}
                      onChange={(e) => setMessage(e.target.value)}
                      maxLength={100}
                    />
                  </div>
                  {/* Payment Breakdown */}
                  {ethUsdPrice && usdInput && (
                    <PaymentBreakdown
                      usdInput={usdInput}
                      chainSlug={chainSlug}
                      defaultChainSlug={defaultChainSlug}
                      layerZeroLimitExceeded={layerZeroLimitExceeded}
                      isLoadingGasEstimate={isLoadingGasEstimate}
                      layerZeroFeeDisplay={layerZeroFeeDisplay}
                      showEstimatedGas={showEstimatedGas as boolean}
                      gasCostDisplay={gasCostDisplay}
                      requiredEth={requiredEth}
                      ethUsdPrice={ethUsdPrice}
                      nativeBalance={nativeBalance}
                      showCurrentBalance={true}
                      showNeedToBuy={true}
                      coinbasePaymentSubtotal={coinbasePaymentSubtotal}
                      coinbaseTotalFees={coinbaseTotalFees}
                      coinbasePaymentTotal={coinbasePaymentTotal}
                      coinbaseEthReceive={coinbaseEthReceive}
                      isAdjustedForMinimum={isAdjustedForMinimum}
                      coinbaseEthInsufficient={coinbaseEthInsufficient}
                    />
                  )}

                  <div className="bg-gradient-to-r from-slate-800/30 to-slate-900/40 backdrop-blur-sm rounded-xl p-5 border border-white/10 flex flex-col gap-3">
                    <div>
                      <label
                        htmlFor="contribution-contributor-email-direct"
                        className="text-gray-300 font-medium text-sm uppercase tracking-wider"
                      >
                        Email
                      </label>
                      <p className="text-sm text-gray-300 leading-relaxed mt-2">
                        We will use this email to send you relevant updates about the mission and
                        contact you for any reward tiers you are eligible for. Thank you for
                        contributing!
                      </p>
                    </div>
                    <input
                      id="contribution-contributor-email-direct"
                      type="email"
                      autoComplete="email"
                      required
                      className="w-full bg-black/30 border border-white/10 rounded-xl p-4 text-white placeholder-gray-500 hover:bg-black/40 hover:border-white/20 transition-all duration-300 focus:outline-none focus:ring-2 focus:ring-blue-500/30 focus:border-blue-500/30"
                      placeholder="you@example.com"
                      value={contributorEmail}
                      onChange={(e) => {
                        const v = e.target.value
                        setContributorEmail(v)
                        if (!v.trim() && newsletterOptIn) setNewsletterOptIn(false)
                      }}
                    />
                    <ConditionCheckbox
                      id="contribution-newsletter-checkbox-direct"
                      label={newsletterCheckboxLabel}
                      agreedToCondition={newsletterOptIn}
                      setAgreedToCondition={setNewsletterOptIn}
                      disabled={!isValidContributorEmail(contributorEmail.trim())}
                    />
                  </div>

                  {/* LayerZero Limit Warning */}
                  {layerZeroLimitExceeded && (
                    <div className="bg-red-500/10 backdrop-blur-sm border border-red-500/30 rounded-xl p-5">
                      <p className="text-red-300 text-sm font-semibold mb-2">
                        Contribution Limit Exceeded
                      </p>
                      <p className="text-red-200/80 text-sm leading-relaxed">
                        Cross-chain contributions from{' '}
                        {chainSlug === 'ethereum'
                          ? 'Ethereum'
                          : chainSlug === 'base'
                          ? 'Base'
                          : 'this network'}{' '}
                        are limited to {LAYERZERO_MAX_ETH} ETH (~$
                        {(LAYERZERO_MAX_CONTRIBUTION_ETH * (ethUsdPrice || 0)).toFixed(0)}) per
                        transaction due to LayerZero protocol limits (0.24 ETH total including
                        fees).
                      </p>
                      <p className="text-red-200/80 text-sm mt-3 leading-relaxed">
                        Please reduce your contribution amount or split it into multiple
                        transactions. Alternatively, you can contribute directly on Arbitrum without
                        limits.
                      </p>
                    </div>
                  )}

                  {/* Terms Checkbox */}
                  <div className="bg-gradient-to-r from-slate-800/30 to-slate-900/40 backdrop-blur-sm rounded-xl p-5 border border-white/10 flex flex-col gap-3">
                    <MissionTokenNotice />
                    <ConditionCheckbox
                      id="contribution-terms-checkbox"
                      label={contributionTermsCheckboxLabel}
                      agreedToCondition={agreedToCondition}
                      setAgreedToCondition={setAgreedToCondition}
                    />
                  </div>

                  {/* Action Buttons */}
                  <div className="flex flex-col md:flex-row gap-4 pt-6">
                    <button
                      type="button"
                      className="flex-1 bg-gradient-to-r from-slate-800/60 to-slate-700/50 backdrop-blur-sm border border-white/10 hover:border-white/20 hover:from-slate-700/60 hover:to-slate-600/50 text-white py-4 px-6 rounded-xl font-medium transition-all duration-300"
                      onClick={handleModalClose}
                    >
                      Cancel
                    </button>
                    <PrivyWeb3Button
                      label={
                        layerZeroLimitExceeded
                          ? 'Contribution Limit Exceeded'
                          : !chainSlugs.includes(chainSlug)
                          ? `Switch Network`
                          : `Contribute $${formattedUsdInput || '0'} USD`
                      }
                      id="contribute-button"
                      className="flex-1 bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-500 hover:to-purple-500 disabled:from-gray-700 disabled:to-gray-600 text-white py-4 px-6 rounded-xl font-semibold transition-all duration-300 transform hover:scale-[1.02] disabled:hover:scale-100 shadow-xl shadow-purple-500/20 hover:shadow-purple-500/30 disabled:opacity-50 disabled:cursor-not-allowed disabled:shadow-none"
                      action={buyMissionToken}
                      isDisabled={
                        !agreedToCondition ||
                        !isValidContributorEmail(contributorEmail.trim()) ||
                        !usdInput ||
                        parseFloat((usdInput as string).replace(/,/g, '')) <= 0 ||
                        !chainSlugs.includes(chainSlug) ||
                        isLoadingGasEstimate ||
                        isLoadingEthUsdPrice ||
                        layerZeroLimitExceeded
                      }
                    />
                  </div>
                </>
              ) : (
                // User needs more ETH - show CBOnramp
                <div className="space-y-5">
                  {/* Terms Checkbox - Required before onramp */}
                  <div className="bg-gradient-to-r from-slate-800/30 to-slate-900/40 backdrop-blur-sm rounded-xl p-5 border border-white/10 flex flex-col gap-3">
                    <MissionTokenNotice />
                    <ConditionCheckbox
                      id="pre-contribution-terms-checkbox"
                      label={contributionTermsCheckboxLabel}
                      agreedToCondition={agreedToCondition}
                      setAgreedToCondition={setAgreedToCondition}
                    />
                  </div>

                  {/* Message Input */}
                  <div className="space-y-3">
                    <label className="text-gray-300 font-medium text-sm uppercase tracking-wider">
                      Message (Optional)
                    </label>
                    <input
                      id="payment-message-input-onramp"
                      type="text"
                      className="w-full bg-black/30 border border-white/10 rounded-xl p-4 text-white placeholder-gray-500 hover:bg-black/40 hover:border-white/20 transition-all duration-300 focus:outline-none focus:ring-2 focus:ring-blue-500/30 focus:border-blue-500/30"
                      placeholder="Attach an on-chain message to this payment"
                      value={message}
                      onChange={(e) => setMessage(e.target.value)}
                      maxLength={100}
                    />
                  </div>

                  {/* Show balance breakdown if user has some ETH */}
                  {usdInput && ethUsdPrice && (
                    <PaymentBreakdown
                      usdInput={usdInput}
                      chainSlug={chainSlug}
                      defaultChainSlug={defaultChainSlug}
                      layerZeroLimitExceeded={layerZeroLimitExceeded}
                      isLoadingGasEstimate={isLoadingGasEstimate}
                      layerZeroFeeDisplay={layerZeroFeeDisplay}
                      showEstimatedGas={showEstimatedGas as boolean}
                      gasCostDisplay={gasCostDisplay}
                      requiredEth={requiredEth}
                      ethUsdPrice={ethUsdPrice}
                      nativeBalance={nativeBalance}
                      showCurrentBalance={true}
                      showNeedToBuy={true}
                      coinbasePaymentSubtotal={coinbasePaymentSubtotal}
                      coinbaseEthReceive={coinbaseEthReceive}
                      isAdjustedForMinimum={isAdjustedForMinimum}
                      coinbaseEthInsufficient={coinbaseEthInsufficient}
                      coinbaseTotalFees={coinbaseTotalFees}
                      coinbasePaymentTotal={coinbasePaymentTotal}
                    />
                  )}

                  <div className="bg-gradient-to-r from-slate-800/30 to-slate-900/40 backdrop-blur-sm rounded-xl p-5 border border-white/10 flex flex-col gap-3">
                    <div>
                      <label
                        htmlFor="contribution-contributor-email-onramp"
                        className="text-gray-300 font-medium text-sm uppercase tracking-wider"
                      >
                        Email
                      </label>
                      <p className="text-sm text-gray-300 leading-relaxed mt-2">
                        We will use this email to send you relevant updates about the mission and
                        contact you for any reward tiers you are eligible for. Thank you for
                        contributing!
                      </p>
                    </div>
                    <input
                      id="contribution-contributor-email-onramp"
                      type="email"
                      autoComplete="email"
                      required
                      className="w-full bg-black/30 border border-white/10 rounded-xl p-4 text-white placeholder-gray-500 hover:bg-black/40 hover:border-white/20 transition-all duration-300 focus:outline-none focus:ring-2 focus:ring-blue-500/30 focus:border-blue-500/30"
                      placeholder="you@example.com"
                      value={contributorEmail}
                      onChange={(e) => {
                        const v = e.target.value
                        setContributorEmail(v)
                        if (!v.trim() && newsletterOptIn) setNewsletterOptIn(false)
                      }}
                    />
                    <ConditionCheckbox
                      id="contribution-newsletter-checkbox-onramp"
                      label={newsletterCheckboxLabel}
                      agreedToCondition={newsletterOptIn}
                      setAgreedToCondition={setNewsletterOptIn}
                      disabled={!isValidContributorEmail(contributorEmail.trim())}
                    />
                  </div>

                  {usdInput &&
                    ethDeficit > 0 &&
                    agreedToCondition &&
                    isValidContributorEmail(contributorEmail.trim()) && (
                    <CBOnramp
                      address={address || ''}
                      selectedChain={selectedChain}
                      ethAmount={adjustedEthDeficit}
                      isWaitingForGasEstimate={isLoadingGasEstimate}
                      onQuoteCalculated={handleCoinbaseQuote}
                      onBeforeNavigate={async () => {
                        await generateOnrampJWT({
                          address: address || '',
                          chainSlug: chainSlug,
                          usdAmount: usdInput.replace(/,/g, ''),
                          agreed: agreedToCondition,
                          message: message || '',
                          selectedWallet: selectedWallet,
                          missionId: mission?.id?.toString(),
                          context: mission?.id?.toString(),
                          contributorEmail: contributorEmail.trim(),
                          newsletterOptIn,
                        })
                      }}
                      redirectUrl={`${DEPLOYED_ORIGIN}/mission/${mission?.id}?onrampSuccess=true`}
                    />
                  )}

                  {/* Show warning if checkbox not agreed */}
                  {usdInput && ethDeficit > 0 && !agreedToCondition && (
                    <div className="bg-orange-500/10 backdrop-blur-sm border border-orange-500/30 rounded-xl p-4">
                      <p className="text-orange-300 text-sm">
                        Please agree to the terms above to continue with your purchase.
                      </p>
                    </div>
                  )}

                  {usdInput &&
                    ethDeficit > 0 &&
                    agreedToCondition &&
                    !isValidContributorEmail(contributorEmail.trim()) && (
                      <div className="bg-orange-500/10 backdrop-blur-sm border border-orange-500/30 rounded-xl p-4">
                        <p className="text-orange-300 text-sm">
                          Please enter a valid email address to continue with your purchase.
                        </p>
                      </div>
                    )}

                  {usdInput && (
                    <>
                      {parseFloat(usdInput.replace(/,/g, '')) > 5000 && (
                        <div className="bg-orange-500/10 backdrop-blur-sm border border-orange-500/20 rounded-xl p-4">
                          <p className="text-orange-300 text-sm leading-relaxed">
                            <span className="font-semibold">Large Amount:</span> Coinbase has
                            purchase limits around $5,000-$7,500. For larger contributions, please
                            contact{' '}
                            <a
                              href="mailto:info@moondao.com"
                              className="text-orange-200 underline underline-offset-2 hover:text-orange-100"
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
                    className="w-full bg-gradient-to-r from-slate-800/60 to-slate-700/50 backdrop-blur-sm border border-white/10 hover:border-white/20 hover:from-slate-700/60 hover:to-slate-600/50 text-white py-4 px-6 rounded-xl font-medium transition-all duration-300"
                    onClick={handleModalClose}
                  >
                    Close
                  </button>
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </Modal>
  )
}
