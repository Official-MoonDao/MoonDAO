import { XMarkIcon } from '@heroicons/react/24/outline'
import { Options } from '@layerzerolabs/lz-v2-utilities'
import { waitForMessageReceived } from '@layerzerolabs/scan-client'
import { getAccessToken, usePrivy } from '@privy-io/react-auth'
import confetti from 'canvas-confetti'
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
import CitizenContext from '@/lib/citizen/citizen-context'
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
import useImageGenerator from '@/lib/image-generator/useImageGenerator'
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

// Celebratory confetti burst for the citizen welcome screen (space palette).
function fireCelebrationConfetti() {
  if (typeof window === 'undefined') return
  const colors = ['#ffffff', '#FFD700', '#00FFFF', '#ff69b4', '#8A2BE2']
  const fire = (originY: number, particleCount: number, spread: number) =>
    confetti({
      particleCount,
      spread,
      origin: { y: originY },
      shapes: ['circle', 'star'],
      colors,
    })
  fire(0.6, 160, 100)
  setTimeout(() => fire(0.7, 120, 120), 250)
  setTimeout(() => fire(0.5, 100, 90), 550)
}

export default function CreateCitizen({ selectedChain, setSelectedTier }: any) {
  // ===== Context & Constants =====
  const router = useRouter()
  const { setSelectedChain } = useContext(ChainContextV5)
  const { selectedWallet, setSelectedWallet } = useContext(PrivyWalletContext)
  const { seedCitizen } = useContext(CitizenContext)

  const defaultChainSlug = getChainSlug(DEFAULT_CHAIN_V5)
  const selectedChainSlug = getChainSlug(selectedChain)
  const isTestnet = process.env.NEXT_PUBLIC_CHAIN != 'mainnet'
  const chains = isTestnet ? [sepolia, arbitrumSepolia] : [arbitrum, base, ethereum]
  const destinationChain = isTestnet ? sepolia : arbitrum
  const account = useActiveAccount()
  // In test mode (Cypress), use mock address from window if available
  const mockAddress = typeof window !== 'undefined' && (window as any).__CYPRESS_MOCK_ADDRESS__
  const address = account?.address || mockAddress
  const { authenticated, login } = usePrivy()

  // Form state caching - needs to be defined before useOnrampInitialStage
  const { cache, setCache, clearCache, restoreCache } = useFormCache<{
    stage: number
    citizenData: CitizenData
    citizenImage: SerializedFile | null
    inputImage: SerializedFile | null
    croppedInputImage: SerializedFile | null
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
  // The user's own cropped upload, kept so they can fall back to it on the
  // Review step ("Use my photo instead") without re-cropping.
  const [croppedInputImage, setCroppedInputImage] = useState<File>()
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
    setAgreedToConditionRaw(value)
  }, [])

  // ===== State: Loading State =====
  const [isLoadingMint, setIsLoadingMint] = useState<boolean>(false)
  // Celebration shown after a successful mint, before landing on the dashboard.
  const [mintComplete, setMintComplete] = useState<boolean>(false)
  const [isImageGenerating, setIsImageGenerating] = useState(false)
  const [isLoadingGasEstimate, setIsLoadingGasEstimate] = useState(false)
  const [isSubmittingTypeform, setIsSubmittingTypeform] = useState(false)
  // When a signed-out user submits the profile, we hold the Typeform response
  // here and prompt sign-in; processing the response needs an authenticated
  // Privy session (the /api/typeform/response route is auth-guarded).
  const [pendingTypeform, setPendingTypeform] = useState<{
    formId: string
    responseId: string
  } | null>(null)
  const processingPendingTypeformRef = useRef(false)

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
  const croppedInputImageRef = useRef(croppedInputImage)
  const stageRef = useRef(stage)
  const selectedChainSlugRef = useRef(selectedChainSlug)

  // ===== Utilities =====

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

  // Hook for regenerating AI images from Review step
  const { generateImage: regenerateAIImage, isLoading: isRegenerating } = useImageGenerator(
    '/api/image-gen/citizen-image',
    croppedInputImage,
    (file: File) => {
      setCitizenImage(file)
    },
  )

  // ===== Computed Values =====
  const LAYER_ZERO_TRANSFER_COST = useMemo(() => BigInt('3000000000000000'), [])
  const isCrossChain = useMemo(
    () => selectedChainSlug !== defaultChainSlug,
    [selectedChainSlug, defaultChainSlug],
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
    [LAYER_ZERO_TRANSFER_COST],
  )

  const serializeCacheData = useCallback(async () => {
    const serializedCitizenImage = citizenImage ? await fileToBase64(citizenImage) : null
    const serializedInputImage = inputImage ? await fileToBase64(inputImage) : null
    const serializedCroppedInputImage = croppedInputImage
      ? await fileToBase64(croppedInputImage)
      : null
    return {
      stage,
      citizenData,
      citizenImage: serializedCitizenImage,
      inputImage: serializedInputImage,
      croppedInputImage: serializedCroppedInputImage,
      agreedToCondition,
      selectedChainSlug,
    }
  }, [
    stage,
    citizenData,
    citizenImage,
    inputImage,
    croppedInputImage,
    agreedToCondition,
    selectedChainSlug,
  ])

  const restoreImageFromCache = useCallback(
    (imageData: SerializedFile | string | null, setImage: Function, imageName: string) => {
      if (!imageData) return false
      if (isSerializedFile(imageData)) {
        setImage(base64ToFile(imageData))
        return true
      }
      return false
    },
    [],
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
    [address, citizenData.name, citizenData.formResponseId],
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
        originReceipt.transactionHash,
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
    ],
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
    [account, citizenContract, address, citizenData.name, citizenData.formResponseId],
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

      // Normalize the thirdweb NFT to match the Tableland format before seeding
      const normalizedCitizen = {
        id: typeof citizenNFT.id === 'bigint' ? Number(citizenNFT.id) : citizenNFT.id,
        metadata: {
          id: typeof citizenNFT.id === 'bigint' ? Number(citizenNFT.id) : citizenNFT.id,
          uri: citizenNFT.tokenURI || '',
          name: citizenNFT.metadata?.name || '',
          description: citizenNFT.metadata?.description || '',
          image: citizenNFT.metadata?.image || '',
          animation_url: '',
          external_url: '',
          attributes: [
            { trait_type: 'location', value: JSON.stringify(citizenData.location || '') },
            { trait_type: 'website', value: citizenData.website || '' },
            { trait_type: 'discord', value: citizenData.discord || '' },
            { trait_type: 'twitter', value: citizenData.twitter || '' },
            { trait_type: 'instagram', value: '' },
            { trait_type: 'linkedin', value: '' },
            { trait_type: 'view', value: citizenData.view || '' },
            { trait_type: 'formId', value: citizenData.formResponseId || '' },
          ],
        },
        owner: citizenNFT.owner || address || '',
        tokenURI: citizenNFT.tokenURI || '',
        type: 'ERC721',
      }

      // Seed the citizen into context/cache so the app recognizes them right
      // away. Without this, Tableland indexing lag can land a brand-new citizen
      // on the marketing homepage instead of their dashboard.
      seedCitizen(normalizedCitizen)

      // Celebrate: show the welcome screen and fire confetti.
      setMintComplete(true)
      fireCelebrationConfetti()

      // Fire-and-forget side effects — don't block the celebration on them.
      sendDiscordMessage(
        'networkNotifications',
        `## [**${citizenName}**](${DEPLOYED_ORIGIN}/citizen/${citizenPrettyLink}?_timestamp=123456789) has just become a <@&${DISCORD_CITIZEN_ROLE_ID}> of the Space Acceleration Network!`,
      ).catch((err) => console.error('Failed to send Discord message:', err))

      // Clear the onboarding form cache (the citizen cache was just seeded).
      clearCache()
    },
    [
      tagToNetworkSignup,
      citizenData.email,
      citizenData.name,
      citizenContract,
      address,
      clearCache,
      seedCitizen,
    ],
  )

  // ===== Event Handlers & Callbacks =====

  const calculateCost = useCallback(
    async (formattedCost: string) => {
      const gasPriceToUse = effectiveGasPrice || BigInt(0)
      const baseCost = BigInt(ethers.utils.parseEther(formattedCost).toString())
      return calculateTotalCost(baseCost, estimatedGas, gasPriceToUse, isCrossChain)
    },
    [estimatedGas, effectiveGasPrice, calculateTotalCost, isCrossChain],
  )

  // Gas Estimation Handler. Returns the buffered gas estimate (and also stores
  // it in state) so callers can use the value immediately without waiting for a
  // re-render — important right after sign-in, when the gas-estimation effect
  // may not have run yet.
  const estimateMintGas = useCallback(async (): Promise<bigint | undefined> => {
    if (!account || !address || !citizenData.name) {
      return undefined
    }

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
      setEstimatedGas(gasWithBuffer)
      setIsLoadingGasEstimate(false)
      return gasWithBuffer
    } catch (error) {
      console.error('Error estimating gas:', error instanceof Error ? error.message : error)
      const fallbackGas = isCrossChain ? BigInt(500000) : BigInt(350000)
      const bufferPercent = isCrossChain ? 200 : 150
      const bufferedFallback = applyGasBuffer(fallbackGas, bufferPercent)
      setEstimatedGas(bufferedFallback)
      setIsLoadingGasEstimate(false)
      return bufferedFallback
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
        return
      }

      // Handle both old and new cache formats
      const formData = restored.formData || restored

      if (!formData || !formData.citizenData) {
        console.error('[CreateCitizen] Invalid cache structure, missing formData or citizenData')
        return
      }

      hasRestoredFormDataRef.current = true

      setStage(restored.stage || 2)
      setCitizenData(formData.citizenData)

      // Trigger gas estimation after form restore
      setTimeout(() => {
        if (restored.stage === 2 && formData.citizenData?.name) {
          estimateMintGas()
        }
      }, 100)

      const citizenImageRestored = restoreImageFromCache(
        formData.citizenImage,
        setCitizenImage,
        'citizen image',
      )
      const inputImageRestored = restoreImageFromCache(
        formData.inputImage,
        setInputImage,
        'input image',
      )
      const croppedInputImageRestored = restoreImageFromCache(
        formData.croppedInputImage,
        setCroppedInputImage,
        'cropped input image',
      )

      imagesRestoredRef.current = citizenImageRestored || inputImageRestored

      const agreedValue = formData.agreedToCondition ?? false
      setAgreedToCondition(agreedValue)

      if (formData.selectedChainSlug) {
        const chain = v4SlugToV5Chain(formData.selectedChainSlug)
        if (chain) {
          setSelectedChain(chain)
        }
      }
    },
    [setSelectedChain, setAgreedToCondition, restoreImageFromCache, estimateMintGas],
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

    const jwtAddress = getAddressFromJWT()
    const restored = restoreCache(jwtAddress || undefined)

    if (restored) {
      const formData = restored.formData || restored
      if (formData && formData.citizenData) {
        handleFormRestore(restored)
      }
    }
  }, [
    router.isReady,
    router.query.onrampSuccess,
    restoreCache,
    handleFormRestore,
    getAddressFromJWT,
  ])

  // Mint Handler
  const callMint = useCallback(async () => {
    // Validation
    const imageToUse = citizenImage || croppedInputImage || inputImage
    if (!imageToUse) return toast.error('Please upload an image and complete the previous steps.')

    if (!address) {
      return toast.error('Please connect your wallet to continue.')
    }

    setIsLoadingMint(true)

    // The user may have just signed in at this step (sign-in is deferred until
    // mint to keep the click count low), so the gas-estimation effect may not
    // have run yet. Estimate inline and use the returned value rather than
    // erroring out and forcing a retry.
    let gasToUse = estimatedGas
    if (!gasToUse || gasToUse === BigInt(0)) {
      gasToUse = (await estimateMintGas()) ?? BigInt(0)
    }

    if (
      !gasToUse ||
      gasToUse === BigInt(0) ||
      !effectiveGasPrice ||
      effectiveGasPrice === BigInt(0)
    ) {
      setIsLoadingMint(false)
      return toast.error('Gas estimation is still loading. Please wait a moment and try again.')
    }

    try {
      // Get cost and check balance
      const cost: any = await readContract({
        contract: citizenContract,
        method: 'getRenewalPrice' as string,
        params: [address, 365 * 24 * 60 * 60],
      })

      const totalCost = calculateTotalCost(cost, gasToUse, effectiveGasPrice, isCrossChain)

      if (!freeMint && +(nativeBalance ?? '0') < totalCost) {
        const shortfall = totalCost - +(nativeBalance ?? '0')
        const requiredAmount = shortfall * 1.15

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
        return toast.error('Image upload to IPFS failed. Please try again.')
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
        return toast.error('Mint unverified — check your wallet or contact support.')
      }

      if (mintedTokenId) {
        await handlePostMint(mintedTokenId)
        setIsLoadingMint(false)
      }
    } catch (err: any) {
      console.error(err)
      toast.error(err?.message || 'Something went wrong during minting.')
      setIsLoadingMint(false)
    }
  }, [
    citizenImage,
    croppedInputImage,
    inputImage,
    address,
    estimatedGas,
    estimateMintGas,
    effectiveGasPrice,
    citizenContract,
    calculateTotalCost,
    isCrossChain,
    freeMint,
    nativeBalance,
    citizenData.name,
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
      return +(nativeBalance ?? '0') >= totalCost
    } catch (error) {
      console.error('Error checking balance:', error)
      return false
    }
  }, [address, citizenContract, nativeBalance, calculateCost])

  // Typeform Submission Handler
  const submitTypeform = useCallback(
    async (formResponse: any) => {
      const { formId, responseId } = formResponse

      // Reading back the profile answers requires an authenticated Privy
      // session. Sign-in is deferred until this point, so if the user is still
      // signed out, stash the response and prompt login; an effect re-runs this
      // once they're authenticated.
      if (!authenticated) {
        setPendingTypeform({ formId, responseId })
        login()
        return
      }

      setIsSubmittingTypeform(true)
      try {
        const cleanedData = await handleTypeformSubmission({
          formId,
          responseId,
          formatter: formatCitizenShortFormData,
        })

        // Subscribe to ConvertKit in background - don't block the flow
        subscribeToNetworkSignup(cleanedData.email).catch((err) => {
          console.warn('ConvertKit signup failed (non-blocking):', err)
        })

        setCitizenData(cleanedData as any)
        setStage(2)
      } catch (error: any) {
        console.error('Typeform submission error:', error)
        toast.error(
          error?.message || 'Failed to process your profile. Please try again or contact support.',
          { duration: 8000 },
        )
      } finally {
        setIsSubmittingTypeform(false)
      }
    },
    [subscribeToNetworkSignup, authenticated, login],
  )

  // Once a signed-out user authenticates (prompted at profile submit), process
  // the stashed Typeform response so the flow continues to Review.
  useEffect(() => {
    if (authenticated && pendingTypeform && !processingPendingTypeformRef.current) {
      processingPendingTypeformRef.current = true
      const pending = pendingTypeform
      setPendingTypeform(null)
      submitTypeform(pending).finally(() => {
        processingPendingTypeformRef.current = false
      })
    }
  }, [authenticated, pendingTypeform, submitTypeform])

  // Regenerate Handler for Review step
  const handleRegenerateFromReview = useCallback(async () => {
    if (!croppedInputImage) {
      toast.error('No image to regenerate from. Please upload a photo first.')
      return
    }

    setCitizenImage(undefined)
    setIsImageGenerating(true)

    try {
      await regenerateAIImage(croppedInputImage)
    } catch (error) {
      console.error('Regeneration error:', error)
      toast.error('Failed to regenerate image. Please try again.')
    }
  }, [croppedInputImage, regenerateAIImage])

  // ===== Effect Group: Gas Estimation =====
  useEffect(() => {
    if (stage === 2 && address && citizenData.name) {
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
      const hasImage = formData.citizenImage || formData.inputImage || formData.croppedInputImage
      const isImageValid =
        hasImage &&
        ((formData.citizenImage && isSerializedFile(formData.citizenImage)) ||
          (formData.inputImage && isSerializedFile(formData.inputImage)) ||
          (formData.croppedInputImage && isSerializedFile(formData.croppedInputImage)) ||
          (formData.citizenImage && formData.citizenImage !== 'PENDING_SERIALIZATION') ||
          (formData.inputImage && formData.inputImage !== 'PENDING_SERIALIZATION') ||
          (formData.croppedInputImage && formData.croppedInputImage !== 'PENDING_SERIALIZATION'))
      return formData.agreedToCondition && isImageValid
    },
    restoreCache: getCachedForm,
    getChainSlugFromCache: (restored) => restored?.formData?.selectedChainSlug,
    setStage,
    setSelectedWallet,
    waitForReady: () => {
      const gasEstimateReady = !isLoadingGasEstimate && estimatedGas > BigInt(0)
      const gasPriceReady = effectiveGasPrice !== undefined && effectiveGasPrice > BigInt(0)
      const imagesReady =
        imagesRestoredRef.current || !!citizenImage || !!inputImage || !!croppedInputImage
      return gasEstimateReady && gasPriceReady && imagesReady
    },
  })

  // ===== Effect Group: UI State Sync =====
  useEffect(() => {
    if (isImageGenerating && citizenImage) {
      setIsImageGenerating(false)
    }
  }, [citizenImage, isImageGenerating])

  // Track regeneration state
  useEffect(() => {
    if (isRegenerating) {
      setIsImageGenerating(true)
    } else if (!isRegenerating && isImageGenerating) {
      setIsImageGenerating(false)
    }
  }, [isRegenerating, isImageGenerating])

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
    croppedInputImageRef.current = croppedInputImage
    stageRef.current = stage
    selectedChainSlugRef.current = selectedChainSlug
    imagesRestoredRef.current = !!citizenImage || !!inputImage
  }, [
    agreedToCondition,
    citizenData,
    citizenImage,
    inputImage,
    croppedInputImage,
    stage,
    selectedChainSlug,
  ])

  // ===== Effect Group: Caching =====
  useEffect(() => {
    if (stage === 2 && agreedToCondition && address) {
      const performCache = async () => {
        const cacheData = await serializeCacheData()
        setCache({ ...cacheData, agreedToCondition: true }, stage)
      }
      performCache()
    }
  }, [agreedToCondition, stage, address, serializeCacheData, setCache])

  // beforeunload backup: emergency state saving before page unload
  useEffect(() => {
    const handleBeforeUnload = () => {
      if (stage === 2 && agreedToConditionRef.current && address) {
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
        const hasSerializedCroppedInputImage =
          existingFormData?.croppedInputImage &&
          isSerializedFile(existingFormData.croppedInputImage)

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
            croppedInputImage: hasSerializedCroppedInputImage
              ? existingFormData.croppedInputImage
              : croppedInputImageRef.current
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
  }, [stage, address])

  // Cache form state continuously (removed onrampModalOpen guard for more aggressive caching)
  useEffect(() => {
    if (
      stage >= 0 &&
      address &&
      (citizenData.name || citizenImage || inputImage) &&
      !mintComplete
    ) {
      const performCache = async () => {
        const cacheData = await serializeCacheData()
        setCache(cacheData, stage)
      }
      performCache()
    }
  }, [
    stage,
    address,
    serializeCacheData,
    setCache,
    citizenData.name,
    citizenImage,
    inputImage,
    agreedToCondition,
    selectedChainSlug,
    mintComplete,
  ])

  // Listen for Typeform submit via postMessage (raw iframe approach)
  useEffect(() => {
    if (stage !== 1) return
    const handler = (e: MessageEvent) => {
      if (e.data && e.data.type === 'form-submit') {
        submitTypeform({
          formId: e.data.formId,
          responseId: e.data.responseId,
        })
      }
    }
    window.addEventListener('message', handler)
    return () => window.removeEventListener('message', handler)
  }, [stage, submitTypeform])

  // Navigate to the citizen dashboard (context is already seeded, so it renders
  // immediately instead of bouncing to the marketing homepage).
  const goToDashboard = useCallback(() => {
    router.push('/dashboard')
  }, [router])

  // Memoize the welcome image object URL so the overlay doesn't allocate a new
  // one on every render, and revoke it when the source changes / on unmount.
  const welcomeImageFile = citizenImage || inputImage
  const welcomeImageUrl = useMemo(
    () => (welcomeImageFile ? URL.createObjectURL(welcomeImageFile) : null),
    [welcomeImageFile],
  )
  useEffect(() => {
    return () => {
      if (welcomeImageUrl) URL.revokeObjectURL(welcomeImageUrl)
    }
  }, [welcomeImageUrl])

  const welcomeButtonRef = useRef<HTMLButtonElement>(null)

  // ===== Effect Group: Post-Mint Celebration =====
  // Auto-advance to the dashboard a few seconds after the welcome screen so the
  // user lands there even if they don't click the button. Move keyboard focus to
  // the primary action so keyboard users can proceed without extra tabbing.
  useEffect(() => {
    if (!mintComplete) return
    welcomeButtonRef.current?.focus()
    const timer = setTimeout(goToDashboard, 6000)
    return () => clearTimeout(timer)
  }, [mintComplete, goToDashboard])

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
        <div className="flex justify-center w-full px-4 md:px-0">
          <div className="w-full max-w-[720px]">
            {/* Header bar with steps + close */}
            <div className="flex items-center justify-between mb-6">
              <Steps
                className="w-full max-w-[480px]"
                steps={['Design', 'Profile', 'Checkout']}
                currStep={stage}
                lastStep={lastStage}
                setStep={(step: number) => {
                  if (step === 0 && stage !== 0) {
                    setCitizenImage(undefined)
                  }
                  setStage(step)
                }}
              />
              <button
                onClick={() => setSelectedTier(null)}
                className="ml-4 p-2 rounded-xl hover:bg-white/5 transition-colors flex-shrink-0"
                aria-label="Close"
              >
                <XMarkIcon width={28} height={28} className="text-slate-400" />
              </button>
            </div>

            {/* Card container */}
            <div className="bg-gradient-to-b from-slate-800/40 to-slate-900/60 backdrop-blur-md border border-white/[0.08] rounded-2xl p-5 sm:p-8">
              {/* Stage 0: Design / Image */}
              {stage === 0 && (
                <div className="animate-fadeIn">
                  <div className="mb-6">
                    <h2 className="text-2xl font-GoodTimes text-white mb-2">Design</h2>
                    <p className="text-slate-400 text-sm leading-relaxed">
                      Upload a photo with a clear face — yourself or an avatar — position the crop,
                      and we&apos;ll generate your AI passport photo. It renders in the background
                      (~30–60s) while you keep going; you can regenerate or switch back to your own
                      photo on the review step.
                    </p>
                  </div>
                  <ImageGenerator
                    image={citizenImage}
                    setImage={setCitizenImage}
                    inputImage={inputImage}
                    setInputImage={setInputImage}
                    nextStage={() => setStage(1)}
                    stage={stage}
                    generateInBG
                    onGenerationStateChange={setIsImageGenerating}
                    onCrop={setCroppedInputImage}
                    authenticated={authenticated}
                  />
                  {process.env.NEXT_PUBLIC_ENV === 'dev' && (
                    <button
                      className="mt-4 text-xs text-slate-500 hover:text-slate-300 transition-colors"
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
                        const file = new File([''], 'test.png', { type: 'image/png' })
                        setCitizenImage(file)
                        setStage(2)
                      }}
                    >
                      Use Testing Data
                    </button>
                  )}
                </div>
              )}

              {/* Stage 1: Profile / Typeform */}
              {stage === 1 && (
                <div className="animate-fadeIn">
                  <div className="mb-6">
                    <h2 className="text-2xl font-GoodTimes text-white mb-2">Profile</h2>
                    <p className="text-slate-400 text-sm">Complete your citizen profile below.</p>
                  </div>
                  {isSubmittingTypeform ? (
                    <div className="flex flex-col items-center gap-4 py-12">
                      <Image
                        src="/assets/MoonDAO-Loading-Animation.svg"
                        alt="Processing"
                        width={80}
                        height={80}
                        className="animate-pulse"
                      />
                      <p className="text-white font-medium">Processing your profile...</p>
                    </div>
                  ) : pendingTypeform && !authenticated ? (
                    <div className="flex flex-col items-center gap-4 py-12 px-6 text-center">
                      <h3 className="font-GoodTimes text-lg text-white">
                        One last step — sign in to finish
                      </h3>
                      <p className="text-slate-400 text-sm max-w-[420px]">
                        Your profile is saved. Sign in or create your wallet to finalize your
                        details and continue to mint your citizenship.
                      </p>
                      <button
                        onClick={() => login()}
                        className="mt-2 py-3 px-6 gradient-2 hover:scale-[1.02] active:scale-[0.98] transition-all duration-200 rounded-2xl font-semibold text-white text-sm"
                      >
                        Sign in to continue
                      </button>
                    </div>
                  ) : (
                    <div className="w-full rounded-xl overflow-hidden border border-white/[0.06]">
                      <iframe
                        src={`https://form.typeform.com/to/${process.env.NEXT_PUBLIC_TYPEFORM_CITIZEN_SHORT_FORM_ID}`}
                        style={{ width: '100%', height: '700px', border: 'none' }}
                        allow="microphone; camera"
                      />
                    </div>
                  )}
                </div>
              )}

              {/* Stage 2: Review & Mint */}
              {stage === 2 && (
                <div className="animate-fadeIn flex flex-col gap-8">
                  <div>
                    <h2 className="text-2xl font-GoodTimes text-white mb-2">Review & Mint</h2>
                    <p className="text-slate-400 text-sm">
                      Review your profile before finalizing your registration on-chain.
                    </p>
                  </div>

                  {/* Image preview */}
                  <div className="flex flex-col items-center gap-4">
                    <div className="relative w-full max-w-[400px] aspect-square rounded-2xl border border-white/[0.08] bg-slate-900/60 overflow-hidden">
                      <Image
                        src={
                          citizenImage
                            ? URL.createObjectURL(citizenImage)
                            : croppedInputImage
                              ? URL.createObjectURL(croppedInputImage)
                              : inputImage
                                ? URL.createObjectURL(inputImage)
                                : '/assets/MoonDAO-Loading-Animation.svg'
                        }
                        alt="citizen-image"
                        fill
                        style={{ objectFit: 'cover' }}
                        className="rounded-2xl"
                      />
                      {isImageGenerating && !citizenImage && (
                        <div className="absolute inset-0 flex items-center justify-center bg-black/50 backdrop-blur-sm">
                          <Image
                            src="/assets/MoonDAO-Loading-Animation.svg"
                            alt="generating"
                            width={100}
                            height={100}
                            className="animate-pulse"
                          />
                        </div>
                      )}
                      {!citizenImage && !inputImage && (
                        <div className="absolute inset-0 flex items-center justify-center bg-slate-800/60">
                          <p className="text-slate-400 text-center text-sm px-6">
                            Complete previous steps to generate your citizen image
                          </p>
                        </div>
                      )}
                    </div>
                    {isImageGenerating && !citizenImage && (
                      <p className="text-center text-xs text-slate-400 max-w-[400px] px-4">
                        Your AI portrait is still generating in the background — keep reviewing your
                        details below and it&apos;ll appear here automatically when it&apos;s ready.
                      </p>
                    )}
                    {(citizenImage || inputImage) && (
                      <div className="flex flex-col items-center gap-3 w-full max-w-[400px]">
                        <div className="flex flex-col sm:flex-row gap-3 w-full">
                          <button
                            onClick={handleRegenerateFromReview}
                            disabled={isImageGenerating || !croppedInputImage}
                            className="flex-1 py-2.5 px-5 gradient-2 hover:scale-[1.02] active:scale-[0.98] transition-all duration-200 rounded-2xl font-semibold text-white text-sm flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:scale-100"
                          >
                            <svg
                              className="w-4 h-4"
                              fill="none"
                              stroke="currentColor"
                              viewBox="0 0 24 24"
                            >
                              <path
                                strokeLinecap="round"
                                strokeLinejoin="round"
                                strokeWidth="2"
                                d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
                              />
                            </svg>
                            Regenerate
                          </button>
                          {(croppedInputImage || inputImage) && (
                            <button
                              onClick={() => {
                                setCitizenImage(croppedInputImage || inputImage)
                              }}
                              className="flex-1 py-2.5 px-5 bg-white/[0.06] hover:bg-white/[0.1] border border-white/[0.1] hover:border-white/[0.2] transition-all duration-200 rounded-2xl font-semibold text-white text-sm"
                            >
                              Use my photo instead
                            </button>
                          )}
                        </div>
                        <button
                          onClick={() => {
                            setCitizenImage(undefined)
                            setInputImage(undefined)
                            setCroppedInputImage(undefined)
                            setStage(0)
                          }}
                          className="text-xs text-slate-500 hover:text-slate-300 transition-colors underline underline-offset-2"
                        >
                          Change photo
                        </button>
                      </div>
                    )}
                  </div>

                  {/* Data overview */}
                  <DataOverview
                    data={citizenData}
                    title="Citizen Overview"
                    excludeKeys={['newsletterSub', 'formResponseId']}
                  />

                  {/* Info box */}
                  <div className="bg-slate-800/30 border border-white/[0.06] rounded-2xl p-5">
                    <h3 className="font-GoodTimes text-base mb-3 text-white">Citizenship</h3>
                    <p className="text-slate-400 text-sm leading-relaxed">
                      Citizenship lasts for one year and can be renewed at any time. Wallet funds
                      are self-custodied and not dependent on registration.
                    </p>
                    <p className="mt-4 text-slate-500 text-xs text-center">
                      Welcome to the future of on-chain, off-world coordination with MoonDAO.
                    </p>
                  </div>

                  {/* Terms + Network + Mint */}
                  <TermsCheckbox
                    checked={agreedToCondition}
                    onChange={(newValue) => setAgreedToCondition(newValue)}
                  />
                  <NetworkSelector chains={chains} />
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
                    className="w-full py-3 gradient-2 hover:scale-[1.02] active:scale-[0.98] transition-all duration-200 rounded-2xl font-semibold text-base disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:scale-100"
                    isDisabled={
                      !agreedToCondition ||
                      isLoadingMint ||
                      isLoadingGasEstimate ||
                      isImageGenerating
                    }
                    action={callMint}
                  />
                  {isLoadingMint && (
                    <div className="flex flex-col items-center gap-3 py-6 px-4 bg-slate-800/30 border border-white/[0.06] rounded-2xl">
                      <Image
                        src="/assets/MoonDAO-Loading-Animation.svg"
                        alt="loading"
                        width={48}
                        height={48}
                        className="animate-pulse"
                      />
                      <p className="text-slate-300 text-sm text-center">
                        Creating your citizen profile on the blockchain...
                      </p>
                      <p className="text-slate-500 text-xs text-center">
                        This can take up to a minute. Please don't close this page.
                      </p>
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Dev Buttons */}
            {process.env.NEXT_PUBLIC_ENV === 'dev' && (
              <div className="flex justify-center gap-4 mt-4">
                <button
                  id="citizen-back-button"
                  className="text-xs text-slate-500 hover:text-white transition-colors"
                  onClick={() => setStage(stage - 1)}
                >
                  ← BACK
                </button>
                <button
                  id="citizen-next-button"
                  className="text-xs text-slate-500 hover:text-white transition-colors"
                  onClick={() => setStage(stage + 1)}
                >
                  NEXT →
                </button>
              </div>
            )}
          </div>
        </div>
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
            const currentStage = stageRef.current
            const cacheData = await serializeCacheData()
            setCache(cacheData, currentStage)
          }}
        />
      )}

      {/* Post-mint celebration / welcome screen */}
      {mintComplete && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-950/80 backdrop-blur-md px-4 animate-fadeIn">
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="citizen-welcome-heading"
            className="relative w-full max-w-md rounded-3xl border border-white/10 bg-gradient-to-b from-slate-800/80 to-slate-900/95 p-8 text-center shadow-2xl"
          >
            {welcomeImageUrl && (
              <div className="mx-auto mb-6 h-28 w-28 overflow-hidden rounded-2xl border border-white/15 shadow-lg">
                <Image
                  src={welcomeImageUrl}
                  alt={citizenData.name || 'Your citizen'}
                  width={112}
                  height={112}
                  className="h-full w-full object-cover"
                  unoptimized
                />
              </div>
            )}
            <p className="text-xs uppercase tracking-[0.2em] text-amber-300/80 mb-2">
              Welcome to MoonDAO
            </p>
            <h2
              id="citizen-welcome-heading"
              className="font-GoodTimes text-2xl sm:text-3xl text-white mb-3"
            >
              You&apos;re a Citizen!
            </h2>
            <p className="text-slate-300 text-sm leading-relaxed mb-7">
              {citizenData.name ? `Welcome aboard, ${citizenData.name}. ` : 'Welcome aboard. '}
              You&apos;re now part of the Space Acceleration Network. Your dashboard is ready with
              everything you can do next.
            </p>
            <button
              ref={welcomeButtonRef}
              onClick={goToDashboard}
              className="w-full py-3 gradient-2 hover:scale-[1.02] active:scale-[0.98] transition-all duration-200 rounded-2xl font-semibold text-white flex items-center justify-center gap-2"
            >
              Enter your Dashboard
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth="2"
                  d="M9 5l7 7-7 7"
                />
              </svg>
            </button>
            <p className="mt-3 text-xs text-slate-500">Taking you there automatically…</p>
          </div>
        </div>
      )}
    </Container>
  )
}
