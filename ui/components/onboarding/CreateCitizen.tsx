import { XMarkIcon } from '@heroicons/react/24/outline'
import { Options } from '@layerzerolabs/lz-v2-utilities'
import { waitForMessageReceived } from '@layerzerolabs/scan-client'
import { getAccessToken } from '@privy-io/react-auth'
import { Widget } from '@typeform/embed-react'
import {
  CITIZEN_ADDRESSES,
  CITIZEN_CROSS_CHAIN_MINT_ADDRESSES,
  LAYERZERO_SOURCE_CHAIN_TO_DESTINATION_EID,
  CK_NETWORK_SIGNUP_FORM_ID,
  CK_NETWORK_SIGNUP_TAG_ID,
  DEPLOYED_ORIGIN,
  DEFAULT_CHAIN_V5,
  DISCORD_CITIZEN_ROLE_ID,
} from 'const/config'
import { ethers } from 'ethers'
import Image from 'next/image'
import Link from 'next/link'
import { useRouter } from 'next/router'
import { useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react'
import toast from 'react-hot-toast'
import {
  prepareContractCall,
  readContract,
  sendAndConfirmTransaction,
  waitForReceipt,
} from 'thirdweb'
import { useActiveAccount } from 'thirdweb/react'
import useWindowSize from '../../lib/team/use-window-size'
import { useOnrampAutoTransaction } from '@/lib/coinbase/useOnrampAutoTransaction'
import { useOnrampInitialStage } from '@/lib/coinbase/useOnrampInitialStage'
import useOnrampJWT from '@/lib/coinbase/useOnrampJWT'
import useSubscribe from '@/lib/convert-kit/useSubscribe'
import useTag from '@/lib/convert-kit/useTag'
import sendDiscordMessage from '@/lib/discord/sendDiscordMessage'
import { pinBlobOrFile } from '@/lib/ipfs/pinBlobOrFile'
import {
  estimateGasWithAPI,
  applyGasBuffer,
  extractTokenIdFromReceipt,
  handleTypeformSubmission,
} from '@/lib/onboarding/shared-utils'
import PrivyWalletContext from '@/lib/privy/privy-wallet-context'
import { arbitrum, base, ethereum, sepolia, arbitrumSepolia } from '@/lib/rpc/chains'
import { useGasPrice } from '@/lib/rpc/useGasPrice'
import { generatePrettyLinkWithId } from '@/lib/subscription/pretty-links'
import cleanData from '@/lib/tableland/cleanData'
import { getChainSlug, v4SlugToV5Chain } from '@/lib/thirdweb/chain'
import ChainContextV5 from '@/lib/thirdweb/chain-context-v5'
import client from '@/lib/thirdweb/client'
import useContract from '@/lib/thirdweb/hooks/useContract'
import { useNativeBalance } from '@/lib/thirdweb/hooks/useNativeBalance'
import waitForERC721 from '@/lib/thirdweb/waitForERC721'
import { CitizenData, formatCitizenShortFormData } from '@/lib/typeform/citizenFormData'
import waitForResponse from '@/lib/typeform/waitForResponse'
import {
  renameFile,
  fileToBase64,
  base64ToFile,
  isSerializedFile,
  SerializedFile,
} from '@/lib/utils/files'
import { useFormCache } from '@/lib/utils/hooks/useFormCache'
import NetworkSelector from '@/components/thirdweb/NetworkSelector'
import CitizenABI from '../../const/abis/Citizen.json'
import CrossChainMinterABI from '../../const/abis/CrossChainMinter.json'
import { CBOnrampModal } from '../coinbase/CBOnrampModal'
import Container from '../layout/Container'
import ContentLayout from '../layout/ContentLayout'
import { ExpandedFooter } from '../layout/ExpandedFooter'
import { Steps } from '../layout/Steps'
import { PrivyWeb3Button } from '../privy/PrivyWeb3Button'
import { ImageGenerator } from './CitizenImageGenerator'
import { DataOverview } from './DataOverview'
import { StageContainer } from './StageContainer'
import { TermsCheckbox } from './TermsCheckbox'

/**
 * CreateCitizen Component
 *
 * Component Structure:
 * 1. Context & Constants
 * 2. State Declarations (Form, Loading, Onramp, Gas)
 * 3. Refs
 * 4. Utilities & Custom Hooks
 * 5. Computed Values (useMemo)
 * 6. Internal Helper Functions
 * 7. Event Handlers & Callbacks
 * 8. Side Effects (grouped by purpose)
 * 9. JSX Render
 */
export default function CreateCitizen({ selectedChain, setSelectedTier }: any) {
  // ===== Context & Constants =====
  const router = useRouter()
  const { setSelectedChain } = useContext(ChainContextV5)
  const { selectedWallet, setSelectedWallet } = useContext(PrivyWalletContext)

  const defaultChainSlug = getChainSlug(DEFAULT_CHAIN_V5)
  const selectedChainSlug = getChainSlug(selectedChain)
  const isTestnet = process.env.NEXT_PUBLIC_CHAIN != 'mainnet'
  const chains = isTestnet ? [sepolia, arbitrumSepolia] : [arbitrum, base, ethereum]
  const destinationChain = isTestnet ? sepolia : arbitrum
  const account = useActiveAccount()
  // In test mode (Cypress), use mock address from window if available
  const mockAddress = typeof window !== 'undefined' && (window as any).__CYPRESS_MOCK_ADDRESS__
  const address = account?.address || mockAddress

  // Form state caching - needs to be defined before useOnrampInitialStage
  const { cache, setCache, clearCache, restoreCache } = useFormCache<{
    stage: number
    citizenData: CitizenData
    citizenImage: SerializedFile | null
    inputImage: SerializedFile | null
    agreedToCondition: boolean
    selectedChainSlug: string
  }>('CreateCitizenCacheV1', address)

  // Import JWT utilities to get original address
  const { getAddressFromJWT } = useOnrampJWT()

  const restoreCacheRef = useRef(restoreCache)
  useEffect(() => {
    restoreCacheRef.current = restoreCache
  }, [restoreCache])

  const getCachedForm = useCallback((addressOverride?: string) => {
    return restoreCacheRef.current(addressOverride)
  }, [])

  const restoredStage = useOnrampInitialStage(address, getCachedForm, 0, 2, getAddressFromJWT)
  useEffect(() => {
    if (restoredStage !== 0) {
      setStage(restoredStage)
    }
  }, [restoredStage])

  // ===== State: Form State =====
  const [stage, setStage] = useState<number>(0)
  const [lastStage, setLastStage] = useState<number>(0)
  const [inputImage, setInputImage] = useState<File>()
  const [citizenImage, setCitizenImage] = useState<any>()
  const [citizenData, setCitizenData] = useState<CitizenData>({
    name: '',
    email: '',
    description: '',
    location: '',
    view: '',
    discord: '',
    website: '',
    twitter: '',
    formResponseId: '',
  })
  const [agreedToCondition, setAgreedToConditionRaw] = useState<boolean>(false)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const setAgreedToCondition = useCallback((value: boolean) => {
    console.log(
      '[CreateCitizen] setAgreedToCondition called:',
      value,
      'stack:',
      new Error().stack?.split('\n').slice(2, 4).join('\n')
    )
    setAgreedToConditionRaw(value)
  }, [])

  // ===== State: Loading State =====
  const [isLoadingMint, setIsLoadingMint] = useState<boolean>(false)
  const [isImageGenerating, setIsImageGenerating] = useState(false)
  const [isLoadingGasEstimate, setIsLoadingGasEstimate] = useState(false)

  // ===== State: Onramp State =====
  const [onrampModalOpen, setOnrampModalOpen] = useState(false)
  const [requiredEthAmount, setRequiredEthAmount] = useState(0)
  const [freeMint, setFreeMint] = useState(false)

  // ===== State: Gas Estimation =====
  const [estimatedGas, setEstimatedGas] = useState<bigint>(BigInt(0))

  // ===== Refs =====
  const hasRestoredFormDataRef = useRef(false)
  const imagesRestoredRef = useRef(false)
  const agreedToConditionRef = useRef(agreedToCondition)
  const citizenDataRef = useRef(citizenData)
  const citizenImageRef = useRef(citizenImage)
  const inputImageRef = useRef(inputImage)
  const stageRef = useRef(stage)
  const selectedChainSlugRef = useRef(selectedChainSlug)

  // ===== Utilities =====
  const logToSession = useCallback((message: string, data?: any) => {
    try {
      const logs = JSON.parse(sessionStorage.getItem('citizenFlowDebug') || '[]')
      logs.push({
        timestamp: Date.now(),
        message,
        data,
        url: window.location.href,
      })
      // Keep last 50 logs
      if (logs.length > 50) logs.shift()
      sessionStorage.setItem('citizenFlowDebug', JSON.stringify(logs))
      console.log(message, data)
    } catch (e) {
      console.log(message, data) // Fallback to console only
    }
  }, [])

  // ===== Custom Hooks =====
  const { effectiveGasPrice } = useGasPrice(selectedChain)

  const citizenContract = useContract({
    address: CITIZEN_ADDRESSES[defaultChainSlug],
    abi: CitizenABI,
    chain: DEFAULT_CHAIN_V5,
  })
  const crossChainMintContract = useContract({
    address: CITIZEN_CROSS_CHAIN_MINT_ADDRESSES[selectedChainSlug],
    abi: CrossChainMinterABI,
    chain: selectedChain,
  })

  const { isMobile } = useWindowSize()

  const subscribeToNetworkSignup = useSubscribe(CK_NETWORK_SIGNUP_FORM_ID)
  const tagToNetworkSignup = useTag(CK_NETWORK_SIGNUP_TAG_ID)

  const { nativeBalance, refetch: refetchNativeBalance } = useNativeBalance()

  // ===== Computed Values =====
  const LAYER_ZERO_TRANSFER_COST = useMemo(() => BigInt('3000000000000000'), [])
  const isCrossChain = useMemo(
    () => selectedChainSlug !== defaultChainSlug,
    [selectedChainSlug, defaultChainSlug]
  )

  // ===== Internal Helper Functions =====

  const calculateTotalCost = useCallback(
    (baseCost: bigint, gasEstimate: bigint, gasPrice: bigint, crossChain: boolean) => {
      const gasCostWei = gasEstimate * gasPrice
      const gasCostEth = Number(gasCostWei) / 1e18
      let totalCost = Number(ethers.utils.formatEther(baseCost)) + gasCostEth
      if (crossChain) {
        totalCost += Number(LAYER_ZERO_TRANSFER_COST) / 1e18
      }
      return totalCost
    },
    [LAYER_ZERO_TRANSFER_COST]
  )

  const serializeCacheData = useCallback(async () => {
    const serializedCitizenImage = citizenImage ? await fileToBase64(citizenImage) : null
    const serializedInputImage = inputImage ? await fileToBase64(inputImage) : null
    return {
      stage,
      citizenData,
      citizenImage: serializedCitizenImage,
      inputImage: serializedInputImage,
      agreedToCondition,
      selectedChainSlug,
    }
  }, [stage, citizenData, citizenImage, inputImage, agreedToCondition, selectedChainSlug])

  const restoreImageFromCache = useCallback(
    (imageData: SerializedFile | string | null, setImage: Function, imageName: string) => {
      if (!imageData) return false
      if (isSerializedFile(imageData)) {
        setImage(base64ToFile(imageData))
        console.log(`[CreateCitizen] Restored ${imageName}`)
        return true
      }
      if (imageData === 'PENDING_SERIALIZATION') {
        console.warn(
          `[CreateCitizen] ${imageName} marked as PENDING_SERIALIZATION, skipping restore. Continuous caching should have proper serialization.`
        )
        logToSession(`[CreateCitizen] ${imageName} PENDING_SERIALIZATION detected during restore`)
      }
      return false
    },
    [logToSession]
  )

  const executeFreeMint = useCallback(
    async (imageIpfsHash: string) => {
      const res = await fetch(`/api/mission/freeMint`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          address: address,
          name: citizenData.name,
          image: `ipfs://${imageIpfsHash}`,
          privacy: 'public',
          formId: citizenData.formResponseId,
        }),
      })
      if (!res.ok) {
        const errorData = await res.json().catch(() => ({ error: 'Mint failed' }))
        console.error(errorData)
        throw new Error(errorData.error || 'Failed to mint citizen')
      }
      return await res.json()
    },
    [address, citizenData.name, citizenData.formResponseId]
  )

  const executeCrossChainMint = useCallback(
    async (imageIpfsHash: string, cost: bigint) => {
      if (!account) {
        throw new Error('Please connect your wallet to continue.')
      }

      const GAS_LIMIT = 300000
      const MSG_VALUE = cost

      const _options = Options.newOptions().addExecutorLzReceiveOption(GAS_LIMIT, MSG_VALUE)

      const transaction = await prepareContractCall({
        contract: crossChainMintContract,
        method: 'crossChainMint' as string,
        params: [
          LAYERZERO_SOURCE_CHAIN_TO_DESTINATION_EID[selectedChainSlug].toString(),
          _options.toHex(),
          address,
          citizenData.name,
          '',
          `ipfs://${imageIpfsHash}`,
          '',
          '',
          '',
          '',
          'public',
          citizenData.formResponseId,
        ],
        value: MSG_VALUE + LAYER_ZERO_TRANSFER_COST,
      })
      const originReceipt: any = await sendAndConfirmTransaction({
        transaction,
        account,
      })
      const message = await waitForMessageReceived(
        isTestnet ? 19999 : 1,
        originReceipt.transactionHash
      )
      return await waitForReceipt({
        client: client,
        chain: destinationChain,
        transactionHash: message.dstTxHash as `0x${string}`,
      })
    },
    [
      account,
      crossChainMintContract,
      selectedChainSlug,
      address,
      citizenData.name,
      citizenData.formResponseId,
      LAYER_ZERO_TRANSFER_COST,
      isTestnet,
      destinationChain,
    ]
  )

  const executeDirectMint = useCallback(
    async (imageIpfsHash: string, cost: bigint) => {
      if (!account) {
        throw new Error('Please connect your wallet to continue.')
      }

      const transaction = await prepareContractCall({
        contract: citizenContract,
        method: 'mintTo' as string,
        params: [
          address,
          citizenData.name,
          '',
          `ipfs://${imageIpfsHash}`,
          '',
          '',
          '',
          '',
          'public',
          citizenData.formResponseId,
        ],
        value: cost,
      })

      return await sendAndConfirmTransaction({
        transaction,
        account,
      })
    },
    [account, citizenContract, address, citizenData.name, citizenData.formResponseId]
  )

  const handlePostMint = useCallback(
    async (mintedTokenId: string) => {
      await tagToNetworkSignup(citizenData.email)

      const citizenNFT = await waitForERC721(citizenContract, +mintedTokenId)
      const citizenName = citizenData.name
      const citizenPrettyLink = generatePrettyLinkWithId(citizenName, mintedTokenId)

      // Record referral
      try {
        const accessToken = await getAccessToken()
        const urlParams = new URLSearchParams(window.location.search)
        const referredBy = urlParams.get('referredBy')

        if (referredBy && referredBy !== address) {
          const referralResponse = await fetch('/api/xp/citizen-referred', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              Authorization: `Bearer ${accessToken}`,
            },
            body: JSON.stringify({
              referrerAddress: referredBy,
              accessToken: accessToken,
            }),
          })

          if (referralResponse.ok) {
            toast.success('Referral recorded successfully!')
          } else {
            const error = await referralResponse.json()
            console.error('Failed to record referral:', error)
          }
        }
      } catch (error) {
        console.error('Error recording referral:', error)
      }

      // Send Discord notification and cleanup
      setTimeout(async () => {
        await sendDiscordMessage(
          'networkNotifications',
          `## [**${citizenName}**](${DEPLOYED_ORIGIN}/citizen/${citizenPrettyLink}?_timestamp=123456789) has just become a <@&${DISCORD_CITIZEN_ROLE_ID}> of the Space Acceleration Network!`
        )

        const cacheKey = `moondao_citizen_${address?.toLowerCase()}_${DEFAULT_CHAIN_V5.id}`
        if (typeof window !== 'undefined') {
          localStorage.removeItem(cacheKey)
        }
        clearCache()
        router.push('/')
      }, 10000)
    },
    [
      tagToNetworkSignup,
      citizenData.email,
      citizenData.name,
      citizenContract,
      address,
      clearCache,
      router,
    ]
  )

  // ===== Event Handlers & Callbacks =====

  const calculateCost = useCallback(
    async (formattedCost: string) => {
      const gasPriceToUse = effectiveGasPrice || BigInt(0)
      const baseCost = BigInt(ethers.utils.parseEther(formattedCost).toString())
      return calculateTotalCost(baseCost, estimatedGas, gasPriceToUse, isCrossChain)
    },
    [estimatedGas, effectiveGasPrice, calculateTotalCost, isCrossChain]
  )

  // Gas Estimation Handler
  const estimateMintGas = useCallback(async () => {
    console.log('[CreateCitizen] estimateMintGas called:', {
      hasAccount: !!account,
      hasAddress: !!address,
      hasName: !!citizenData.name,
    })

    if (!account || !address || !citizenData.name) {
      console.log('[CreateCitizen] estimateMintGas exiting early - missing required data')
      return
    }

    console.log('[CreateCitizen] Starting gas estimation...')
    setIsLoadingGasEstimate(true)

    try {
      const cost: any = await readContract({
        contract: citizenContract,
        method: 'getRenewalPrice' as string,
        params: [address, 365 * 24 * 60 * 60],
      })

      let gasEstimate: bigint = BigInt(0)

      if (isCrossChain) {
        const GAS_LIMIT = 300000
        const MSG_VALUE = cost

        const _options = Options.newOptions().addExecutorLzReceiveOption(GAS_LIMIT, MSG_VALUE)

        const transaction = await prepareContractCall({
          contract: crossChainMintContract,
          method: 'crossChainMint' as string,
          params: [
            LAYERZERO_SOURCE_CHAIN_TO_DESTINATION_EID[selectedChainSlug].toString(),
            _options.toHex(),
            address,
            citizenData.name,
            '',
            'ipfs://placeholder',
            '',
            '',
            '',
            '',
            'public',
            citizenData.formResponseId || '0000',
          ],
          value: MSG_VALUE + LAYER_ZERO_TRANSFER_COST,
        })

        try {
          const txData =
            typeof transaction.data === 'function' ? await transaction.data() : transaction.data

          if (!txData) {
            throw new Error('Transaction data is undefined')
          }

          gasEstimate = await estimateGasWithAPI({
            chainId: selectedChain.id,
            from: address,
            to: CITIZEN_CROSS_CHAIN_MINT_ADDRESSES[selectedChainSlug],
            data: txData,
            value: `0x${(MSG_VALUE + LAYER_ZERO_TRANSFER_COST).toString(16)}`,
          })
        } catch (estimationError: any) {
          console.error('Gas estimation error (cross-chain):', estimationError)
          gasEstimate = BigInt(500000)
        }
      } else {
        const transaction = await prepareContractCall({
          contract: citizenContract,
          method: 'mintTo' as string,
          params: [
            address,
            citizenData.name,
            '',
            'ipfs://placeholder',
            '',
            '',
            '',
            '',
            'public',
            citizenData.formResponseId || '0000',
          ],
          value: cost,
        })

        try {
          const txData =
            typeof transaction.data === 'function' ? await transaction.data() : transaction.data

          if (!txData) {
            throw new Error('Transaction data is undefined')
          }

          gasEstimate = await estimateGasWithAPI({
            chainId: selectedChain.id,
            from: address,
            to: CITIZEN_ADDRESSES[defaultChainSlug],
            data: txData,
            value: `0x${cost.toString(16)}`,
          })
        } catch (estimationError: any) {
          console.error('Gas estimation error (same-chain):', estimationError)
          gasEstimate = BigInt(350000)
        }
      }

      const bufferPercent = isCrossChain ? 200 : 150
      const gasWithBuffer = applyGasBuffer(gasEstimate, bufferPercent)
      console.log('[CreateCitizen] Gas estimation complete:', {
        rawEstimate: gasEstimate.toString(),
        withBuffer: gasWithBuffer.toString(),
        bufferPercent,
        isCrossChain,
      })
      setEstimatedGas(gasWithBuffer)
      setIsLoadingGasEstimate(false)
    } catch (error) {
      console.error('Error estimating gas:', error instanceof Error ? error.message : error)
      const fallbackGas = isCrossChain ? BigInt(500000) : BigInt(350000)
      const bufferPercent = isCrossChain ? 200 : 150
      const bufferedFallback = applyGasBuffer(fallbackGas, bufferPercent)
      console.log('[CreateCitizen] Using buffered fallback gas estimate:', {
        raw: fallbackGas.toString(),
        buffered: bufferedFallback.toString(),
        bufferPercent,
      })
      setEstimatedGas(bufferedFallback)
      setIsLoadingGasEstimate(false)
    }
  }, [
    account,
    address,
    citizenData.name,
    citizenData.formResponseId,
    citizenContract,
    crossChainMintContract,
    selectedChain,
    isCrossChain,
    LAYER_ZERO_TRANSFER_COST,
    selectedChainSlug,
    defaultChainSlug,
  ])

  // Form Restoration Handler
  const handleFormRestore = useCallback(
    (restored: any) => {
      if (hasRestoredFormDataRef.current) {
        console.log('[CreateCitizen] Form already restored, skipping')
        return
      }

      // Handle both old and new cache formats
      const formData = restored.formData || restored

      if (!formData || !formData.citizenData) {
        console.error(
          '[CreateCitizen] Invalid cache structure, missing formData or citizenData',
          restored
        )
        return
      }

      console.log('[CreateCitizen] Restoring form data:', {
        stage: restored.stage,
        hasCitizenData: !!formData.citizenData,
        citizenDataName: formData.citizenData?.name,
        hasCitizenImage: !!formData.citizenImage,
        hasInputImage: !!formData.inputImage,
        agreedToCondition: formData.agreedToCondition,
        selectedChainSlug: formData.selectedChainSlug,
      })
      console.log('[CreateCitizen] Full restored object:', restored)

      // Cache verification
      if (router.query.onrampSuccess === 'true') {
        const cacheAge = restored.timestamp ? Date.now() - restored.timestamp : null
        logToSession('[CreateCitizen] Cache verification after onramp redirect', {
          hasImage: !!formData.citizenImage,
          hasName: !!formData.citizenData?.name,
          stage: restored.stage,
          agreedToCondition: formData.agreedToCondition,
          cacheAge,
        })

        // If cache looks wrong (stage 0 after onramp), log debug info
        if (restored.stage === 0 || !formData.citizenImage) {
          console.warn('[CreateCitizen] Cache appears stale, checking sessionStorage debug logs')
          try {
            const debugLogs = sessionStorage.getItem('citizenFlowDebug')
            console.log('[CreateCitizen] Debug logs:', debugLogs)
            logToSession('[CreateCitizen] WARNING: Stale cache detected', {
              stage: restored.stage,
              hasImage: !!formData.citizenImage,
              timestamp: restored.timestamp,
            })
          } catch (e) {
            console.error('[CreateCitizen] Error reading debug logs:', e)
          }
        }
      }

      hasRestoredFormDataRef.current = true

      setStage(restored.stage || 2)
      setCitizenData(formData.citizenData)

      // Trigger gas estimation after form restore
      // Use setTimeout to ensure state updates have propagated
      setTimeout(() => {
        if (restored.stage === 2 && formData.citizenData?.name) {
          console.log('[CreateCitizen] Triggering gas estimation after form restore')
          estimateMintGas()
        }
      }, 100)

      const citizenImageRestored = restoreImageFromCache(
        formData.citizenImage,
        setCitizenImage,
        'citizen image'
      )
      const inputImageRestored = restoreImageFromCache(
        formData.inputImage,
        setInputImage,
        'input image'
      )

      imagesRestoredRef.current = citizenImageRestored || inputImageRestored

      const agreedValue = formData.agreedToCondition ?? false
      setAgreedToCondition(agreedValue)
      console.log('[CreateCitizen] Restored agreedToCondition:', agreedValue)

      if (formData.selectedChainSlug) {
        const chain = v4SlugToV5Chain(formData.selectedChainSlug)
        if (chain) {
          setSelectedChain(chain)
          console.log('[CreateCitizen] Restored chain:', formData.selectedChainSlug)
        }
      }

      console.log('[CreateCitizen] Form restoration completed')
    },
    [
      setSelectedChain,
      router.query.onrampSuccess,
      logToSession,
      setAgreedToCondition,
      restoreImageFromCache,
      estimateMintGas,
    ]
  )

  // ===== Side Effects =====

  // ===== Effect Group: Form Restoration =====
  useEffect(() => {
    if (router.isReady && router.query.onrampSuccess !== 'true') {
      hasRestoredFormDataRef.current = false
    }
  }, [router.isReady, router.query.onrampSuccess])

  useEffect(() => {
    if (
      !router.isReady ||
      router.query.onrampSuccess !== 'true' ||
      hasRestoredFormDataRef.current
    ) {
      return
    }

    console.log(
      '[CreateCitizen] Attempting manual form restoration after onramp redirect, current address:',
      address
    )

    const jwtAddress = getAddressFromJWT()
    console.log(
      '[CreateCitizen] JWT address:',
      jwtAddress,
      'will use for cache lookup:',
      jwtAddress || address
    )
    const restored = restoreCache(jwtAddress || undefined)

    if (restored) {
      // Ensure cache has formData structure
      const formData = restored.formData || restored
      if (formData && formData.citizenData) {
        console.log('[CreateCitizen] Found cached form data, calling handleFormRestore')
        handleFormRestore(restored)
      } else {
        console.log('[CreateCitizen] Cached data found but missing citizenData:', restored)
      }
    } else {
      console.log('[CreateCitizen] No cached form data found for address:', jwtAddress || address)
    }
  }, [
    router.isReady,
    router.query.onrampSuccess,
    getCachedForm,
    handleFormRestore,
    getAddressFromJWT,
    address,
  ])

  // Mint Handler
  const callMint = useCallback(async () => {
    // Validation
    const imageToUse = citizenImage || inputImage
    if (!imageToUse) return toast.error('Please upload an image and complete the previous steps.')

    if (!address) {
      return toast.error('Please connect your wallet to continue.')
    }

    if (
      !estimatedGas ||
      estimatedGas === BigInt(0) ||
      !effectiveGasPrice ||
      effectiveGasPrice === BigInt(0)
    ) {
      setIsLoadingMint(false)
      return toast.error('Gas estimation is still loading. Please wait a moment and try again.')
    }

    setIsLoadingMint(true)

    try {
      // Get cost and check balance
      const cost: any = await readContract({
        contract: citizenContract,
        method: 'getRenewalPrice' as string,
        params: [address, 365 * 24 * 60 * 60],
      })

      const totalCost = calculateTotalCost(cost, estimatedGas, effectiveGasPrice, isCrossChain)

      if (!freeMint && +nativeBalance < totalCost) {
        const shortfall = totalCost - +nativeBalance
        const requiredAmount = shortfall * 1.15

        logToSession('[CreateCitizen] About to open onramp modal', {
          agreedToCondition,
          agreedToConditionRef: agreedToConditionRef.current,
          citizenDataName: citizenData.name,
          stage,
          stageRef: stageRef.current,
          selectedChainSlug,
          selectedChainSlugRef: selectedChainSlugRef.current,
        })

        setRequiredEthAmount(requiredAmount)
        setOnrampModalOpen(true)
        setIsLoadingMint(false)
        return
      }

      // Upload to IPFS
      const renamedCitizenImage = renameFile(imageToUse, `${citizenData.name} Citizen Image`)
      const { cid: newImageIpfsHash } = await pinBlobOrFile(renamedCitizenImage)

      if (!newImageIpfsHash) {
        setIsLoadingMint(false)
        return toast.error('Error pinning image to IPFS.')
      }

      // Execute mint based on type
      let receipt: any
      if (freeMint) {
        receipt = await executeFreeMint(newImageIpfsHash)
      } else if (isCrossChain) {
        receipt = await executeCrossChainMint(newImageIpfsHash, cost)
      } else {
        receipt = await executeDirectMint(newImageIpfsHash, cost)
      }

      // Verify receipt and extract token ID
      const mintedTokenId = extractTokenIdFromReceipt(receipt)

      if (!mintedTokenId) {
        setIsLoadingMint(false)
        return toast.error('Could not find mint event in transaction.')
      }

      if (mintedTokenId) {
        await handlePostMint(mintedTokenId)
        setIsLoadingMint(false)
      }
    } catch (err) {
      console.error(err)
      setIsLoadingMint(false)
    }
  }, [
    citizenImage,
    inputImage,
    address,
    estimatedGas,
    effectiveGasPrice,
    citizenContract,
    calculateTotalCost,
    isCrossChain,
    freeMint,
    nativeBalance,
    citizenData.name,
    logToSession,
    agreedToCondition,
    stage,
    selectedChainSlug,
    executeFreeMint,
    executeCrossChainMint,
    executeDirectMint,
    handlePostMint,
  ])

  // Balance Check Handler
  const checkBalanceSufficient = useCallback(async () => {
    try {
      const cost: any = await readContract({
        contract: citizenContract,
        method: 'getRenewalPrice' as string,
        params: [address, 365 * 24 * 60 * 60],
      })
      const formattedCost = ethers.utils.formatEther(cost.toString()).toString()
      const totalCost = await calculateCost(formattedCost)
      return +nativeBalance >= totalCost
    } catch (error) {
      console.error('Error checking balance:', error)
      return false
    }
  }, [address, citizenContract, nativeBalance, calculateCost])

  // Typeform Submission Handler
  const submitTypeform = useCallback(
    async (formResponse: any) => {
      const { formId, responseId } = formResponse

      const cleanedData = await handleTypeformSubmission({
        formId,
        responseId,
        formatter: formatCitizenShortFormData,
      })

      await subscribeToNetworkSignup(cleanedData.email)
      setCitizenData(cleanedData as any)
      setStage(2)
    },
    [subscribeToNetworkSignup]
  )

  // ===== Effect Group: Gas Estimation =====
  useEffect(() => {
    console.log('[CreateCitizen] Gas estimation useEffect triggered:', {
      stage,
      hasAddress: !!address,
      hasName: !!citizenData.name,
      selectedChainSlug,
      shouldEstimate: stage === 2 && address && citizenData.name,
    })
    if (stage === 2 && address && citizenData.name) {
      console.log('[CreateCitizen] Calling estimateMintGas()')
      estimateMintGas()
    }
  }, [stage, address, citizenData.name, selectedChainSlug, estimateMintGas])

  useOnrampAutoTransaction({
    address,
    context: 'citizen',
    expectedChainSlug: selectedChainSlug,
    refetchNativeBalance,
    onTransaction: callMint,
    onFormRestore: handleFormRestore,
    checkBalanceSufficient,
    shouldProceed: (restored) => {
      const formData = restored.formData || restored
      const hasImage = formData.citizenImage || formData.inputImage
      const isImageValid =
        hasImage &&
        ((formData.citizenImage && isSerializedFile(formData.citizenImage)) ||
          (formData.inputImage && isSerializedFile(formData.inputImage)) ||
          (formData.citizenImage && formData.citizenImage !== 'PENDING_SERIALIZATION') ||
          (formData.inputImage && formData.inputImage !== 'PENDING_SERIALIZATION'))
      return formData.agreedToCondition && isImageValid
    },
    restoreCache: getCachedForm,
    getChainSlugFromCache: (restored) => restored?.formData?.selectedChainSlug,
    setStage,
    setSelectedWallet,
    waitForReady: () => {
      const gasEstimateReady = !isLoadingGasEstimate && estimatedGas > BigInt(0)
      const gasPriceReady = effectiveGasPrice !== undefined && effectiveGasPrice > BigInt(0)
      const imagesReady = imagesRestoredRef.current || !!citizenImage || !!inputImage
      const isReady = gasEstimateReady && gasPriceReady && imagesReady

      console.log('[CreateCitizen] waitForReady check:', {
        gasEstimateReady,
        isLoadingGasEstimate,
        estimatedGas: estimatedGas.toString(),
        gasPriceReady,
        effectiveGasPrice: effectiveGasPrice?.toString(),
        imagesReady,
        imagesRestoredRef: imagesRestoredRef.current,
        hasCitizenImage: !!citizenImage,
        hasInputImage: !!inputImage,
        isReady,
      })

      return isReady
    },
  })

  // ===== Effect Group: UI State Sync =====
  useEffect(() => {
    if (isImageGenerating && citizenImage) {
      setIsImageGenerating(false)
    }
  }, [citizenImage, isImageGenerating])

  useEffect(() => {
    if (stage > lastStage) {
      setLastStage(stage)
    }
  }, [stage, lastStage])

  // Sync refs with state for callback access
  useEffect(() => {
    agreedToConditionRef.current = agreedToCondition
    citizenDataRef.current = citizenData
    citizenImageRef.current = citizenImage
    inputImageRef.current = inputImage
    stageRef.current = stage
    selectedChainSlugRef.current = selectedChainSlug
    imagesRestoredRef.current = !!citizenImage || !!inputImage
  }, [agreedToCondition, citizenData, citizenImage, inputImage, stage, selectedChainSlug])

  // ===== Effect Group: Caching =====
  useEffect(() => {
    if (stage === 2 && agreedToCondition && address) {
      logToSession('[CreateCitizen] Checkbox checked - immediately caching state', {
        stage,
        agreedToCondition,
        citizenDataName: citizenData?.name,
        selectedChainSlug,
      })

      const performCache = async () => {
        const cacheData = await serializeCacheData()
        setCache({ ...cacheData, agreedToCondition: true }, stage)
      }
      performCache()
    }
  }, [
    agreedToCondition,
    stage,
    address,
    logToSession,
    serializeCacheData,
    setCache,
    citizenData?.name,
    selectedChainSlug,
  ])

  // beforeunload backup: emergency state saving before page unload
  useEffect(() => {
    const handleBeforeUnload = () => {
      if (stage === 2 && agreedToConditionRef.current && address) {
        logToSession('[CreateCitizen] beforeunload - emergency cache save', {
          stage: stageRef.current,
          agreedToCondition: agreedToConditionRef.current,
        })

        // Use synchronous localStorage directly since beforeunload timing is critical
        // Check existing cache to avoid overwriting properly serialized images
        const cacheKey = `CreateCitizenCacheV1_${address.toLowerCase()}`
        let existingCache: any = null
        try {
          const existing = localStorage.getItem(cacheKey)
          if (existing) {
            existingCache = JSON.parse(existing)
          }
        } catch (e) {
          // Ignore parse errors
        }

        // Only use PENDING_SERIALIZATION if we don't have properly serialized images
        const existingFormData = existingCache?.formData || existingCache
        const hasSerializedCitizenImage =
          existingFormData?.citizenImage && isSerializedFile(existingFormData.citizenImage)
        const hasSerializedInputImage =
          existingFormData?.inputImage && isSerializedFile(existingFormData.inputImage)

        const cacheData = {
          stage: stageRef.current,
          formData: {
            citizenData: citizenDataRef.current,
            citizenImage: hasSerializedCitizenImage
              ? existingFormData.citizenImage
              : citizenImageRef.current
              ? 'PENDING_SERIALIZATION'
              : null,
            inputImage: hasSerializedInputImage
              ? existingFormData.inputImage
              : inputImageRef.current
              ? 'PENDING_SERIALIZATION'
              : null,
            agreedToCondition: agreedToConditionRef.current,
            selectedChainSlug: selectedChainSlugRef.current,
          },
          timestamp: Date.now(),
        }
        try {
          localStorage.setItem(cacheKey, JSON.stringify(cacheData))
        } catch (e) {
          console.error('[CreateCitizen] beforeunload cache save failed:', e)
        }
      }
    }

    window.addEventListener('beforeunload', handleBeforeUnload)
    return () => window.removeEventListener('beforeunload', handleBeforeUnload)
  }, [stage, address, logToSession])

  // Cache form state continuously (removed onrampModalOpen guard for more aggressive caching)
  useEffect(() => {
    if (stage >= 0 && address && (citizenData.name || citizenImage || inputImage)) {
      const performCache = async () => {
        logToSession('[CreateCitizen] Continuous caching form data', {
          stage,
          citizenDataName: citizenData?.name,
          agreedToCondition,
          selectedChainSlug,
        })
        const cacheData = await serializeCacheData()
        setCache(cacheData, stage)
      }
      performCache()
    }
  }, [
    stage,
    address,
    logToSession,
    serializeCacheData,
    setCache,
    citizenData.name,
    citizenImage,
    inputImage,
    agreedToCondition,
    selectedChainSlug,
  ])

  // ===== Effect Group: Data Fetching =====
  useEffect(() => {
    if (!address) return

    const getTotalPaid = async () => {
      const res = await fetch(`/api/mission/freeMint?address=${address}`, {
        method: 'GET',
      })
      if (!res.ok) {
        const errorText = await res.text() // Or response.json()
        console.error(errorText)
      } else {
        const { data } = await res.json()
        if (data.eligible) {
          setFreeMint(true)
        }
      }
    }
    getTotalPaid()
  }, [address])

  // ===== JSX Render =====
  return (
    <Container>
      <ContentLayout
        isProfile
        mode="compact"
        header="Join The Network"
        mainPadding
        headerSize="max(20px, 3vw)"
        preFooter={
          <>
            <ExpandedFooter
              callToActionImage="/assets/MoonDAO-Logo-White.svg"
              callToActionTitle="Join the Network"
              callToActionButtonText="Learn More"
              callToActionButtonLink="/join"
              hasCallToAction={true}
              darkBackground={true}
              isFullwidth={false}
            />
          </>
        }
        description=""
      >
        <div className="flex flex-row w-full">
          <div className="px-8 bg-black/20 backdrop-blur-sm border border-white/10 lg:p-8 rounded-[2vmax] md:m-5 mb-0 md:mb-0 w-full flex flex-col lg:max-w-[1000px]">
            <div className="flex p-2 pb-0 flex-row w-full justify-between max-w-[600px] items-start">
              <Steps
                className="mb-4 w-[300px] sm:w-[600px] lg:max-w-[900px] md:-ml-16 -ml-10"
                steps={['Design', 'Profile', 'Checkout']}
                currStep={stage}
                lastStep={lastStage}
                setStep={setStage}
              />
              <button
                onClick={() => setSelectedTier(null)}
                className="hover:scale-110 transition-transform"
              >
                <XMarkIcon width={50} height={50} className="text-white" />
              </button>
            </div>

            {/* Typeform form */}
            {stage === 0 && (
              <StageContainer
                className={`mb-10`}
                title="Design"
                description={
                  <>
                    <b>Create your unique and personalized AI passport photo.</b> The uploaded photo{' '}
                    <u>MUST</u> contain a face, but it can be a photo of yourself or an avatar that
                    represents you well. Image generation may take up to a minute, so please
                    continue to the next step to fill out your profile.
                  </>
                }
              >
                <ImageGenerator
                  image={citizenImage}
                  setImage={setCitizenImage}
                  inputImage={inputImage}
                  setInputImage={setInputImage}
                  nextStage={() => setStage(1)}
                  stage={stage}
                  generateInBG
                  onGenerationStateChange={setIsImageGenerating}
                />
                {process.env.NEXT_PUBLIC_ENV === 'dev' && (
                  <button
                    onClick={() => {
                      setCitizenData({
                        name: 'Test',
                        description: 'Testing',
                        email: 'test@test.com',
                        discord: '',
                        website: 'https://moondao.com',
                        twitter: '',
                        location: 'Earth',
                        view: 'public',
                        formResponseId: '0000',
                      })

                      const file = new File([''], 'test.png', {
                        type: 'image/png',
                      })

                      setCitizenImage(file)
                      setStage(2)
                    }}
                  >
                    Use Testing Data
                  </button>
                )}
              </StageContainer>
            )}
            {/* Upload & Create Image */}
            {stage === 1 && (
              <StageContainer
                title="Citizen Profile"
                description="Please complete your citizen profile."
              >
                <div className="w-full max-w-[900px] bg-black/20 backdrop-blur-sm border border-white/10 rounded-2xl overflow-hidden relative">
                  <Widget
                    className="w-full"
                    id={process.env.NEXT_PUBLIC_TYPEFORM_CITIZEN_SHORT_FORM_ID as string}
                    onSubmit={submitTypeform}
                    height={700}
                  />
                </div>
              </StageContainer>
            )}
            {/* Pin Image and Metadata to IPFS, Mint NFT to Gnosis Safe */}
            {stage === 2 && (
              <StageContainer
                title="Mint Citizen"
                description="Please review your onchain profile before finalizing your registration"
              >
                {/* <p className="mt-6 w-[400px] font-[Lato] text-base xl:text-lg lg:text-left text-left text-[#071732] dark:text-white text-opacity-70 dark:text-opacity-60">
                  {`Make sure all your information is displayed correcly.`}
                </p>
                <p className="mt-6 w-[400px] font-[Lato] text-base xl:text-lg lg:text-left text-left text-[#071732] dark:text-white text-opacity-70 dark:text-opacity-60">
                  {`Welcome to the future of off-world coordination with MoonDAO.`}
                </p> */}
                <div className="flex flex-col items-center">
                  <div className="relative w-[600px] h-[600px] rounded-2xl border border-slate-600/30 bg-slate-900/40 overflow-hidden">
                    <Image
                      src={
                        citizenImage
                          ? URL.createObjectURL(citizenImage)
                          : inputImage
                          ? URL.createObjectURL(inputImage)
                          : '/assets/MoonDAO-Loading-Animation.svg'
                      }
                      alt="citizen-image"
                      width={600}
                      height={600}
                      className="rounded-2xl"
                    />
                    {isImageGenerating && !citizenImage && (
                      <div className="absolute inset-0 flex items-center justify-center bg-black/40">
                        <Image
                          src="/assets/MoonDAO-Loading-Animation.svg"
                          alt="generating"
                          width={160}
                          height={160}
                          className="w-40 h-40 opacity-90"
                        />
                      </div>
                    )}
                    {!citizenImage && !inputImage && (
                      <div className="absolute inset-0 flex items-center justify-center bg-slate-800/50 rounded-2xl">
                        <p className="text-white text-center px-4">
                          Please complete the previous steps to generate your citizen image
                        </p>
                      </div>
                    )}
                  </div>
                  {citizenImage && (
                    <div className="mt-4 text-center">
                      <p className="text-slate-300">Your personalized citizen passport photo</p>
                      <button
                        onClick={() => setStage(0)}
                        className="mt-2 text-sky-400 hover:text-sky-300 text-sm underline transition-colors"
                      >
                        Edit Image
                      </button>
                    </div>
                  )}
                  {!citizenImage && inputImage && (
                    <div className="mt-4 text-center">
                      <p className="text-slate-300 opacity-75">
                        {isImageGenerating
                          ? 'Image generation in progress...'
                          : 'Using uploaded image'}
                      </p>
                      <button
                        onClick={() => setStage(0)}
                        className="mt-2 text-sky-400 hover:text-sky-300 text-sm underline transition-colors"
                      >
                        Edit Image
                      </button>
                    </div>
                  )}
                </div>

                <div className="flex flex-col w-full md:p-5 mt-10 max-w-[600px]">
                  <DataOverview
                    data={citizenData}
                    title="Citizen Overview"
                    excludeKeys={['newsletterSub', 'formResponseId']}
                  />
                </div>
                <div className="flex flex-col w-full md:p-5 mt-8 max-w-[600px]">
                  <div className="bg-black/20 backdrop-blur-sm border border-white/10 rounded-2xl p-6">
                    <h2 className="font-GoodTimes text-xl mb-6 text-white">
                      Important Information
                    </h2>
                    <div className="flex flex-col rounded-[20px] bg-slate-800/50 border border-slate-600/30 p-5 pb-10 md:p-5">
                      <h3 className="font-GoodTimes text-lg mb-3 text-white">Citizenship</h3>
                      <p className="text-slate-300 leading-relaxed">
                        Citizenship lasts for one year and can be renewed at any time. Any wallet
                        funds are self-custodied and are not dependent on registration.
                      </p>
                    </div>
                    <p className="mt-6 text-center text-slate-300 font-medium">
                      Welcome to the future of on-chain, off-world coordination with MoonDAO!
                    </p>
                  </div>
                </div>
                <TermsCheckbox
                  checked={agreedToCondition}
                  onChange={(newValue) => {
                    logToSession('[CreateCitizen] Checkbox changed', {
                      newValue,
                      stage,
                      address,
                    })
                    setAgreedToCondition(newValue)
                  }}
                />
                <div className="mt-6">
                  <NetworkSelector chains={chains} />
                </div>
                <PrivyWeb3Button
                  id="citizen-checkout-button"
                  skipNetworkCheck={true}
                  label={
                    isLoadingMint
                      ? 'Creating Citizen...'
                      : isLoadingGasEstimate
                      ? 'Estimating Gas...'
                      : 'Become a Citizen'
                  }
                  className="mt-6 w-auto px-8 py-2 gradient-2 hover:scale-105 transition-transform rounded-xl font-medium text-base disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:scale-100"
                  isDisabled={!agreedToCondition || isLoadingMint || isLoadingGasEstimate}
                  action={callMint}
                />
                {isLoadingMint && (
                  <div className="mt-4 p-4 bg-black/20 backdrop-blur-sm border border-white/10 rounded-2xl">
                    <p className="text-slate-300 text-center">
                      Creating your citizen profile on the blockchain...
                    </p>
                    <p className="text-slate-400 text-sm text-center mt-2">
                      This process can take up to a minute. Please wait while the transaction is
                      processed.
                    </p>
                  </div>
                )}
              </StageContainer>
            )}
          </div>
        </div>
        {/* Dev Buttons */}
        {process.env.NEXT_PUBLIC_ENV === 'dev' && (
          <div className="flex flex-row justify-center gap-4">
            <button id="citizen-back-button" onClick={() => setStage(stage - 1)}>
              BACK
            </button>
            <button id="citizen-next-button" onClick={() => setStage(stage + 1)}>
              NEXT
            </button>
          </div>
        )}
      </ContentLayout>
      {address && (
        <CBOnrampModal
          enabled={onrampModalOpen}
          setEnabled={setOnrampModalOpen}
          address={address}
          selectedChain={selectedChain}
          ethAmount={requiredEthAmount}
          context="citizen"
          agreed={agreedToCondition}
          selectedWallet={selectedWallet}
          onExit={() => {
            setIsLoadingMint(false)
          }}
          onBeforeNavigate={async () => {
            // Use refs to get the absolute latest values
            const currentStage = stageRef.current
            const currentChainSlug = selectedChainSlugRef.current

            logToSession('[CreateCitizen] onBeforeNavigate - capturing current state', {
              currentStage,
              citizenDataName: citizenDataRef.current?.name,
              currentAgreed: agreedToConditionRef.current,
              currentChainSlug,
              address,
            })

            const cacheData = await serializeCacheData()
            logToSession(
              '[CreateCitizen] Caching before onramp navigation with agreedToCondition:',
              agreedToConditionRef.current
            )
            setCache(cacheData, currentStage)
          }}
        />
      )}
    </Container>
  )
}
