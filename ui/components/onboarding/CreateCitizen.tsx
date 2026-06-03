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
import {
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  startTransition,
} from 'react'
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
import useETHPrice from '@/lib/etherscan/useETHPrice'
import { generatePrettyLinkWithId } from '@/lib/subscription/pretty-links'
import cleanData from '@/lib/tableland/cleanData'
import { getChainSlug, v4SlugToV5Chain } from '@/lib/thirdweb/chain'
import ChainContextV5 from '@/lib/thirdweb/chain-context-v5'
import client from '@/lib/thirdweb/client'
import useContract from '@/lib/thirdweb/hooks/useContract'
import { useNativeBalance } from '@/lib/thirdweb/hooks/useNativeBalance'
import waitForERC721 from '@/lib/thirdweb/waitForERC721'
import { CitizenData, formatCitizenShortFormData } from '@/lib/typeform/citizenFormData'
import {
  renameFile,
  fileToBase64,
  base64ToFile,
  isSerializedFile,
  SerializedFile,
} from '@/lib/utils/files'
import { compressImageForStorage } from '@/lib/utils/images'
import { useClientHydrated } from '@/lib/utils/hooks/useClientHydrated'
import { useFormCache } from '@/lib/utils/hooks/useFormCache'
import useImageGenerator from '@/lib/image-generator/useImageGenerator'
import {
  clearPendingImageJob,
  isPendingImageJobStale,
  readPendingImageJob,
} from '@/lib/image-generator/pendingImageJob'
import { resumePendingComfyJob } from '@/lib/image-generator/pollComfyImageJob'
import {
  clearAiPortraitReady,
  markAiPortraitReady,
  decideImageResumeAction,
  getGenerationSourceImage,
  getReviewPreviewFile,
  hasAiPortraitImage,
  isAiPortraitReady,
} from '@/lib/image-generator/citizenOnboardingImage'
import NetworkSelector from '@/components/thirdweb/NetworkSelector'
import CitizenABI from '../../const/abis/Citizen.json'
import CrossChainMinterABI from '../../const/abis/CrossChainMinter.json'
import { CBOnrampModal } from '../coinbase/CBOnrampModal'
import Container from '../layout/Container'
import ContentLayout from '../layout/ContentLayout'
import { ExpandedFooter } from '../layout/ExpandedFooter'
import { Steps } from '../layout/Steps'
import { PrivyWeb3Button } from '../privy/PrivyWeb3Button'
import {
  CitizenImageGenerationProgress,
  computeProgressPct,
  PHASE_LABELS,
  type ImageGenProgressSnapshot,
} from './CitizenImageGenerationProgress'
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

const ANONYMOUS_FORM_CACHE_KEY = 'CreateCitizenCacheV1'
const PENDING_TYPEFORM_SESSION_KEY = 'CreateCitizen_pendingTypeform'
const RESUME_STAGE_SESSION_KEY = 'CreateCitizen_resumeStage'
const CROPPED_IMAGE_SESSION_KEY = 'CreateCitizen_croppedImage'
const INPUT_IMAGE_SESSION_KEY = 'CreateCitizen_inputImage'

const ONE_YEAR_SECONDS = 365 * 24 * 60 * 60

/** Format small ETH amounts for display without noisy trailing zeros. */
function formatEthAmount(eth: number): string {
  if (!Number.isFinite(eth) || eth <= 0) return '0'
  if (eth >= 0.01) return eth.toFixed(4).replace(/\.?0+$/, '')
  return eth.toFixed(6).replace(/\.?0+$/, '')
}

type PendingTypeformPayload = { formId: string; responseId: string }

function readPendingTypeformFromSession(): PendingTypeformPayload | null {
  if (typeof window === 'undefined') return null
  try {
    const raw = sessionStorage.getItem(PENDING_TYPEFORM_SESSION_KEY)
    if (!raw) return null
    const parsed = JSON.parse(raw)
    if (parsed?.formId && parsed?.responseId) return parsed
  } catch {
    /* ignore */
  }
  return null
}

function writePendingTypeformToSession(payload: PendingTypeformPayload) {
  if (typeof window === 'undefined') return
  try {
    sessionStorage.setItem(PENDING_TYPEFORM_SESSION_KEY, JSON.stringify(payload))
    sessionStorage.setItem(RESUME_STAGE_SESSION_KEY, '2')
  } catch {
    /* ignore */
  }
}

function clearPendingTypeformSession() {
  if (typeof window === 'undefined') return
  try {
    sessionStorage.removeItem(PENDING_TYPEFORM_SESSION_KEY)
    sessionStorage.removeItem(RESUME_STAGE_SESSION_KEY)
  } catch {
    /* ignore */
  }
}

function readSerializedImageFromSession(key: string): SerializedFile | null {
  if (typeof window === 'undefined') return null
  try {
    const raw = sessionStorage.getItem(key)
    if (!raw) return null
    const parsed = JSON.parse(raw)
    return isSerializedFile(parsed) ? parsed : null
  } catch {
    return null
  }
}

function writeSerializedImageToSession(key: string, serialized: SerializedFile) {
  if (typeof window === 'undefined') return
  const payload = JSON.stringify(serialized)
  try {
    sessionStorage.setItem(key, payload)
  } catch {
    // Quota exceeded: the full-size input image is the least critical thing to
    // keep, so evict it and retry the (critical) cropped image / current write.
    try {
      if (key !== INPUT_IMAGE_SESSION_KEY) {
        sessionStorage.removeItem(INPUT_IMAGE_SESSION_KEY)
        sessionStorage.setItem(key, payload)
      }
    } catch {
      /* give up silently — restore will fall back to resuming the comfy job */
    }
  }
}

function clearSessionImageSnapshots() {
  if (typeof window === 'undefined') return
  try {
    sessionStorage.removeItem(CROPPED_IMAGE_SESSION_KEY)
    sessionStorage.removeItem(INPUT_IMAGE_SESSION_KEY)
  } catch {
    /* ignore */
  }
}

/**
 * Wipe every localStorage key that backs the onboarding wizard so a "Start over"
 * truly survives a reload. Covers the anonymous cache and any wallet-scoped
 * variants (`CreateCitizenCacheV1_<address>`).
 */
function clearAnonymousFormCache() {
  if (typeof window === 'undefined') return
  try {
    Object.keys(localStorage)
      .filter((key) => key.startsWith(ANONYMOUS_FORM_CACHE_KEY))
      .forEach((key) => localStorage.removeItem(key))
  } catch {
    /* ignore */
  }
}

function restoreAnonymousFormCache(): {
  stage?: number
  formData?: any
  timestamp?: number
} | null {
  if (typeof window === 'undefined') return null
  try {
    const stored = localStorage.getItem(ANONYMOUS_FORM_CACHE_KEY)
    if (!stored) return null
    const parsed = JSON.parse(stored)
    if (parsed?.formData) return parsed
    if (parsed?.citizenData || parsed?.stage !== undefined) {
      const { stage, timestamp, ...formData } = parsed
      return { stage, formData, timestamp }
    }
  } catch {
    /* ignore */
  }
  return null
}

/** Client-only: restore wizard step after Privy remount (must not run during SSR). */
function restoreWizardStageFromSession(): number {
  if (readPendingTypeformFromSession()) return 1
  const resume = sessionStorage.getItem(RESUME_STAGE_SESSION_KEY)
  if (resume !== '2') return 0
  const anon = restoreAnonymousFormCache()
  const formData = anon?.formData || anon
  if (formData?.citizenData?.name) return 2
  return 1
}

export default function CreateCitizen({ selectedChain, setSelectedTier, freeMintProp }: any) {
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
  const isClientHydrated = useClientHydrated()

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

  // ===== State: Form State =====
  // Always 0 on first render so SSR markup matches the client (session restore runs in useEffect).
  const [stage, setStage] = useState<number>(0)
  const [lastStage, setLastStage] = useState<number>(0)
  const [inputImage, setInputImage] = useState<File>()
  const [citizenImage, setCitizenImage] = useState<any>()
  // The user's own cropped upload, kept so they can fall back to it on the
  // Review step ("Use my photo instead") without re-cropping.
  const [croppedInputImage, setCroppedInputImage] = useState<File>()
  // Preserves the last completed AI portrait when the user switches to "Use my
  // photo instead" so they can restore it without regenerating.
  const [savedAiImage, setSavedAiImage] = useState<File | undefined>()
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
  const [imageGenProgress, setImageGenProgress] = useState<ImageGenProgressSnapshot | null>(null)
  const [regenElapsedMs, setRegenElapsedMs] = useState(0)
  const wasRegeneratingRef = useRef(false)
  const [isLoadingGasEstimate, setIsLoadingGasEstimate] = useState(false)
  const [isSubmittingTypeform, setIsSubmittingTypeform] = useState(false)
  // Seconds elapsed while we wait on Typeform indexing, so the processing UI
  // can reassure the user during the (sometimes long) wait.
  const [processingElapsedSec, setProcessingElapsedSec] = useState(0)
  // True when polling for the submitted response timed out — lets the user
  // retry without re-filling the form (instead of being dropped back to it).
  const [typeformProcessingFailed, setTypeformProcessingFailed] = useState(false)
  const lastTypeformPayloadRef = useRef<{ formId: string; responseId: string } | null>(null)
  const [hasPendingImageJob, setHasPendingImageJob] = useState(false)
  // When a signed-out user submits the profile, we hold the Typeform response
  // here and prompt sign-in; processing the response needs an authenticated
  // Privy session (the /api/typeform/response route is auth-guarded).
  const [pendingTypeform, setPendingTypeform] = useState<PendingTypeformPayload | null>(null)
  const processingPendingTypeformRef = useRef(false)
  const hasRestoredInProgressFlowRef = useRef(false)
  const hasRestoredFromSessionRef = useRef(false)
  const hasRestoredWizardArtifactsRef = useRef(false)

  useEffect(() => {
    if (!isClientHydrated || restoredStage === 0) return
    startTransition(() => setStage(restoredStage))
  }, [isClientHydrated, restoredStage])

  // ===== State: Onramp State =====
  const [onrampModalOpen, setOnrampModalOpen] = useState(false)
  const [requiredEthAmount, setRequiredEthAmount] = useState(0)
  const [freeMint, setFreeMint] = useState(freeMintProp || false)

  // ===== State: Gas Estimation =====
  const [estimatedGas, setEstimatedGas] = useState<bigint>(BigInt(0))
  const [renewalPriceWei, setRenewalPriceWei] = useState<bigint | null>(null)
  const [isLoadingRenewalPrice, setIsLoadingRenewalPrice] = useState(false)

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
  const {
    generateImage: regenerateAIImage,
    isLoading: isRegenerating,
    phase: regenPhase,
  } = useImageGenerator('/api/image-gen/citizen-image', croppedInputImage, (file: File) => {
    setCitizenImage(file)
  })

  const handleImageGenProgress = useCallback((snapshot: ImageGenProgressSnapshot | null) => {
    setImageGenProgress(snapshot)
  }, [])

  const runImageJobPolling = useCallback((sourceImage: File | undefined) => {
    setIsImageGenerating(true)
    setHasPendingImageJob(true)
    const start = Date.now()
    const elapsedTimer = setInterval(() => {
      setImageGenProgress((prev) => {
        const phase = prev?.phase ?? 'queued'
        const elapsed = Date.now() - start
        return {
          phase,
          elapsedMs: elapsed,
          progressPct: computeProgressPct(phase, elapsed),
          phaseLabel: PHASE_LABELS[phase] ?? 'Creating your AI image…',
          tipIndex: prev?.tipIndex ?? 0,
        }
      })
    }, 250)

    return resumePendingComfyJob(
      {
        setPhase: (phase) => {
          const elapsed = Date.now() - start
          setImageGenProgress({
            phase,
            elapsedMs: elapsed,
            progressPct: computeProgressPct(phase, elapsed),
            phaseLabel: PHASE_LABELS[phase] ?? 'Creating your AI image…',
            tipIndex: 0,
          })
        },
        setImage: (file) => setCitizenImage(file),
        setError: (msg) => console.warn('[CreateCitizen] image resume:', msg),
      },
      sourceImage,
    ).finally(() => {
      clearInterval(elapsedTimer)
      setIsImageGenerating(false)
      setHasPendingImageJob(false)
      setImageGenProgress(null)
    })
  }, [])

  const restartImageGeneration = useCallback(
    async (sourceImage: File) => {
      clearAiPortraitReady()
      setCitizenImage(undefined)
      setIsImageGenerating(true)
      setHasPendingImageJob(true)
      try {
        await regenerateAIImage(sourceImage)
      } finally {
        setIsImageGenerating(false)
        setHasPendingImageJob(false)
      }
    },
    [regenerateAIImage],
  )

  // Progress for Review: Design-step generator (hidden mount) or Review regeneration hook.
  const activeImageGenProgress = useMemo((): ImageGenProgressSnapshot | null => {
    if (imageGenProgress) return imageGenProgress
    if (!isRegenerating) return null
    return {
      phase: regenPhase,
      elapsedMs: regenElapsedMs,
      progressPct: computeProgressPct(regenPhase, regenElapsedMs),
      phaseLabel: PHASE_LABELS[regenPhase] ?? 'Creating your AI image…',
      tipIndex: 0,
    }
  }, [imageGenProgress, isRegenerating, regenPhase, regenElapsedMs])

  const hasAiPortrait = hasAiPortraitImage(citizenImage, croppedInputImage) && isAiPortraitReady()

  const isAwaitingAiPortrait = isImageGenerating || hasPendingImageJob

  const keepImageGeneratorMounted = stage === 0 || isImageGenerating || hasPendingImageJob

  // ===== Computed Values =====
  const LAYER_ZERO_TRANSFER_COST = useMemo(() => BigInt('3000000000000000'), [])
  const isCrossChain = useMemo(
    () => selectedChainSlug !== defaultChainSlug,
    [selectedChainSlug, defaultChainSlug],
  )

  const nativeSymbol = selectedChain?.nativeCurrency?.symbol ?? 'ETH'

  const mintCostBreakdown = useMemo(() => {
    const gasEth =
      estimatedGas > BigInt(0) && effectiveGasPrice && effectiveGasPrice > BigInt(0)
        ? Number(estimatedGas * effectiveGasPrice) / 1e18
        : 0
    const bridgeEth = isCrossChain ? Number(LAYER_ZERO_TRANSFER_COST) / 1e18 : 0
    if (freeMint) {
      // Sponsored mint: the server relayer signs and submits the mint, so the
      // user pays neither the citizenship fee nor network gas.
      return { renewalEth: 0, gasEth: 0, bridgeEth: 0, totalEth: 0 }
    }
    const renewalEth = renewalPriceWei ? Number(ethers.utils.formatEther(renewalPriceWei)) : 0
    return {
      renewalEth,
      gasEth,
      bridgeEth,
      totalEth: renewalEth + gasEth + bridgeEth,
    }
  }, [
    freeMint,
    renewalPriceWei,
    estimatedGas,
    effectiveGasPrice,
    isCrossChain,
    LAYER_ZERO_TRANSFER_COST,
  ])

  const { data: renewalUsd, isLoading: isLoadingRenewalUsd } = useETHPrice(
    mintCostBreakdown.renewalEth,
    'ETH_TO_USD',
  )
  const { data: totalMintUsd, isLoading: isLoadingTotalMintUsd } = useETHPrice(
    mintCostBreakdown.totalEth,
    'ETH_TO_USD',
  )

  const isLoadingMintCosts = freeMint
    ? false
    : isLoadingRenewalPrice ||
      isLoadingGasEstimate ||
      isLoadingRenewalUsd ||
      isLoadingTotalMintUsd ||
      !renewalPriceWei

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

  // Persisted images are JPEG-compressed so the cache survives the storage quota
  // across a Privy sign-in navigation. Full-resolution copies stay in React state
  // for the active session; this only affects what we can restore after a remount.
  const serializeForStorage = useCallback(async (file: File | undefined | null) => {
    if (!file) return null
    try {
      const compressed = (await compressImageForStorage(file)) as File
      return await fileToBase64(compressed)
    } catch {
      return null
    }
  }, [])

  const serializeCacheData = useCallback(async () => {
    const serializedCitizenImage = await serializeForStorage(citizenImage)
    const serializedInputImage = await serializeForStorage(inputImage)
    const serializedCroppedInputImage = await serializeForStorage(croppedInputImage)
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
    serializeForStorage,
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

  const handleCrop = useCallback(
    async (file: File | undefined) => {
      setCroppedInputImage(file)
      if (!file) {
        try {
          sessionStorage.removeItem(CROPPED_IMAGE_SESSION_KEY)
          const cacheData = await serializeCacheData()
          setCache({ ...cacheData, croppedInputImage: null }, stage)
        } catch (err) {
          console.warn('[CreateCitizen] Failed to clear cropped image:', err)
        }
        return
      }
      try {
        // Compress so this reliably fits in sessionStorage (the cropped image is
        // the critical artifact for restore + "Use my photo" after Privy returns).
        const serialized = await serializeForStorage(file)
        if (serialized) {
          writeSerializedImageToSession(CROPPED_IMAGE_SESSION_KEY, serialized)
        }
        const cacheData = await serializeCacheData()
        setCache({ ...cacheData, croppedInputImage: serialized }, stage)
      } catch (err) {
        console.warn('[CreateCitizen] Failed to persist cropped image:', err)
      }
    },
    [stage, setCache, serializeCacheData, serializeForStorage],
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
      clearPendingTypeformSession()
      clearPendingImageJob()
      clearSessionImageSnapshots()
      clearAiPortraitReady()
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

  const applyCachedFormImages = useCallback((formData: any): { cropped?: File; input?: File } => {
    if (!formData) return {}
    let cropped: File | undefined
    let input: File | undefined
    if (formData.croppedInputImage && isSerializedFile(formData.croppedInputImage)) {
      cropped = base64ToFile(formData.croppedInputImage)
      setCroppedInputImage(cropped)
    }
    if (formData.inputImage && isSerializedFile(formData.inputImage)) {
      input = base64ToFile(formData.inputImage)
      setInputImage(input)
    }
    if (formData.citizenImage && isSerializedFile(formData.citizenImage)) {
      const restoredCitizenImage = base64ToFile(formData.citizenImage)
      setCitizenImage(restoredCitizenImage)
      // If citizenImage differs from croppedInputImage, it's an AI portrait - mark it ready
      if (!cropped || restoredCitizenImage !== cropped) {
        markAiPortraitReady()
      }
    }
    if (cropped || input || formData.citizenImage) {
      imagesRestoredRef.current = true
    }
    return { cropped, input }
  }, [])

  /** Restore uploads + resume/restart AI gen after Privy or a full page reload. */
  const restoreWizardArtifacts = useCallback((): { cropped?: File; input?: File } => {
    let cropped: File | undefined
    let input: File | undefined

    const sessionCropped = readSerializedImageFromSession(CROPPED_IMAGE_SESSION_KEY)
    if (sessionCropped) {
      cropped = base64ToFile(sessionCropped)
      setCroppedInputImage(cropped)
    }
    const sessionInput = readSerializedImageFromSession(INPUT_IMAGE_SESSION_KEY)
    if (sessionInput) {
      input = base64ToFile(sessionInput)
      setInputImage(input)
    }

    const caches = [restoreAnonymousFormCache(), address ? restoreCache() : null].filter(
      Boolean,
    ) as any[]

    for (const entry of caches) {
      const formData = entry?.formData || entry
      const applied = applyCachedFormImages(formData)
      cropped = cropped || applied.cropped
      input = input || applied.input
      if (formData?.citizenData?.name && !citizenDataRef.current.name) {
        setCitizenData(formData.citizenData)
      }
    }

    return { cropped, input }
  }, [address, restoreCache, applyCachedFormImages])

  /**
   * Full reset: clear every persisted artifact (local + session storage) and
   * reset React state so the user genuinely starts from step 1. Restore guards
   * are flipped back on so a subsequent reload won't re-hydrate stale data.
   */
  const handleStartOver = useCallback(() => {
    clearCache()
    clearAnonymousFormCache()
    clearPendingTypeformSession()
    clearPendingImageJob()
    clearSessionImageSnapshots()
    clearAiPortraitReady()

    imagesRestoredRef.current = false
    hasRestoredFromSessionRef.current = false
    hasRestoredWizardArtifactsRef.current = false
    hasRestoredInProgressFlowRef.current = false
    hasMigratedAnonCacheRef.current = false
    processingPendingTypeformRef.current = false

    setPendingTypeform(null)
    setCitizenImage(undefined)
    setSavedAiImage(undefined)
    setInputImage(undefined)
    setCroppedInputImage(undefined)
    setCitizenData({
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
    setAgreedToCondition(false)
    setIsImageGenerating(false)
    setHasPendingImageJob(false)
    setImageGenProgress(null)
    setTypeformProcessingFailed(false)
    lastTypeformPayloadRef.current = null
    setStage(0)
  }, [clearCache, setAgreedToCondition])

  // Form Restoration Handler
  const handleFormRestore = useCallback(
    (restored: any) => {
      if (hasRestoredFormDataRef.current) {
        return
      }

      // Handle both old and new cache formats
      const formData = restored.formData || restored

      const hasProfile = !!formData?.citizenData?.name
      const hasImages =
        !!formData?.croppedInputImage || !!formData?.inputImage || !!formData?.citizenImage

      if (!formData || (!hasProfile && !hasImages)) {
        console.error('[CreateCitizen] Invalid cache structure, nothing to restore')
        return
      }

      hasRestoredFormDataRef.current = true

      if (typeof restored.stage === 'number') {
        setStage((current) => Math.max(current, restored.stage))
      } else if (hasProfile) {
        setStage((current) => (current < 2 ? 2 : current))
      }

      if (hasProfile) {
        setCitizenData(formData.citizenData)
      }

      const croppedInputImageRestored = restoreImageFromCache(
        formData.croppedInputImage,
        setCroppedInputImage,
        'cropped input image',
      )
      const inputImageRestored = restoreImageFromCache(
        formData.inputImage,
        setInputImage,
        'input image',
      )
      const citizenImageRestored = restoreImageFromCache(
        formData.citizenImage,
        setCitizenImage,
        'citizen image',
      )
      // If citizenImage was restored and differs from croppedInputImage, it's an AI portrait
      if (citizenImageRestored && formData.citizenImage && isSerializedFile(formData.citizenImage)) {
        // Compare serialized data to determine if it's an AI portrait
        if (!formData.croppedInputImage || 
            !isSerializedFile(formData.croppedInputImage) ||
            formData.citizenImage.dataURL !== formData.croppedInputImage.dataURL) {
          markAiPortraitReady()
        }
      }

      imagesRestoredRef.current =
        citizenImageRestored || inputImageRestored || croppedInputImageRestored

      // Trigger gas estimation after form restore
      setTimeout(() => {
        if (restored.stage === 2 && formData.citizenData?.name) {
          estimateMintGas()
        }
      }, 100)

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
      !isClientHydrated ||
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
        startTransition(() => handleFormRestore(restored))
      }
    }
  }, [
    isClientHydrated,
    router.isReady,
    router.query.onrampSuccess,
    restoreCache,
    handleFormRestore,
    getAddressFromJWT,
  ])

  // Mint Handler
  const callMint = useCallback(async () => {
    // Validation
    const imageToUse = hasAiPortrait && citizenImage ? citizenImage : croppedInputImage
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
    hasAiPortrait,
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
        const payload = { formId, responseId }
        setPendingTypeform(payload)
        writePendingTypeformToSession(payload)
        login()
        return
      }

      lastTypeformPayloadRef.current = { formId, responseId }
      setTypeformProcessingFailed(false)
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

        clearPendingTypeformSession()
        setCitizenData(cleanedData as any)
        // Only advance to checkout once the response is actually available.
        setStage(2)
      } catch (error: any) {
        console.error('Typeform submission error:', error)
        // Keep the user on the Profile step and offer a retry rather than
        // dumping them back to a blank form (their answers are saved in Typeform).
        setTypeformProcessingFailed(true)
        toast.error(
          error?.message || 'Still finalizing your profile. Please try again in a moment.',
          { duration: 6000 },
        )
      } finally {
        setIsSubmittingTypeform(false)
      }
    },
    [subscribeToNetworkSignup, authenticated, login],
  )

  const retryTypeformProcessing = useCallback(() => {
    if (lastTypeformPayloadRef.current) {
      void submitTypeform(lastTypeformPayloadRef.current)
    }
  }, [submitTypeform])

  // Tick a 1s counter while the profile is processing so the UI can show
  // elapsed time and progressively reassuring copy during the Typeform wait.
  useEffect(() => {
    if (!isSubmittingTypeform) {
      setProcessingElapsedSec(0)
      return
    }
    setProcessingElapsedSec(0)
    const startedAt = Date.now()
    const timer = setInterval(() => {
      setProcessingElapsedSec(Math.floor((Date.now() - startedAt) / 1000))
    }, 1000)
    return () => clearInterval(timer)
  }, [isSubmittingTypeform])

  // Persist original upload (compressed) so re-cropping survives a Privy navigation.
  // This is the lowest-priority artifact — the resilient session writer will evict
  // it first under quota pressure in favor of the cropped image / pending job.
  useEffect(() => {
    if (!inputImage) return
    serializeForStorage(inputImage)
      .then((serialized) => {
        if (serialized) writeSerializedImageToSession(INPUT_IMAGE_SESSION_KEY, serialized)
      })
      .catch((err) => console.warn('[CreateCitizen] Failed to persist input image:', err))
  }, [inputImage, serializeForStorage])

  // Client-only: restore wizard step, cached images, and in-flight AI jobs after Privy / reload.
  useEffect(() => {
    if (!isClientHydrated || hasRestoredFromSessionRef.current) return
    hasRestoredFromSessionRef.current = true

    const pendingTypeform = readPendingTypeformFromSession()
    const restoredStage = restoreWizardStageFromSession()

    startTransition(() => {
      if (pendingTypeform) {
        setPendingTypeform(pendingTypeform)
      }
      if (restoredStage > 0) {
        setStage((current) => (current < restoredStage ? restoredStage : current))
      }
    })

    if (!hasRestoredWizardArtifactsRef.current) {
      hasRestoredWizardArtifactsRef.current = true
      const { cropped } = restoreWizardArtifacts()
      const sourceForGen = getGenerationSourceImage(cropped, undefined)

      const pendingJob = readPendingImageJob()
      if (pendingJob && isPendingImageJobStale(pendingJob)) {
        clearPendingImageJob()
      }

      const freshJob = readPendingImageJob()
      const hasAiPortraitAlready =
        isAiPortraitReady() && hasAiPortraitImage(citizenImageRef.current, cropped)

      const resumeAction = decideImageResumeAction({
        job: freshJob,
        jobStale: freshJob ? isPendingImageJobStale(freshJob) : true,
        hasAiPortraitReady: hasAiPortraitAlready,
        hasSourceImage: !!sourceForGen,
      })

      if (resumeAction === 'resume-polling') {
        void runImageJobPolling(sourceForGen)
      } else if (resumeAction === 'restart-generation' && sourceForGen) {
        clearPendingImageJob()
        void restartImageGeneration(sourceForGen)
      } else if (freshJob && freshJob.status === 'uploading') {
        clearPendingImageJob()
        startTransition(() => setHasPendingImageJob(false))
      }
    }
  }, [isClientHydrated, restoreWizardArtifacts, runImageJobPolling, restartImageGeneration])

  // Copy anonymous localStorage progress to the wallet-scoped key once an address exists.
  const hasMigratedAnonCacheRef = useRef(false)
  useEffect(() => {
    if (!isClientHydrated || !address || hasMigratedAnonCacheRef.current) return
    const anon = restoreAnonymousFormCache()
    if (!anon) return
    const walletCache = restoreCache()
    if (walletCache?.formData?.citizenData?.name) {
      hasMigratedAnonCacheRef.current = true
      return
    }
    const formData = anon.formData || anon
    if (!formData?.citizenData && (anon.stage ?? 0) < 1) return

    hasMigratedAnonCacheRef.current = true
    if (formData?.citizenData) {
      setCache(formData, anon.stage)
    }
    startTransition(() => {
      if (!hasRestoredFormDataRef.current && (anon.stage ?? 0) >= 1) {
        handleFormRestore(anon)
      } else if (!imagesRestoredRef.current) {
        applyCachedFormImages(formData)
      }
    })
  }, [
    isClientHydrated,
    address,
    restoreCache,
    setCache,
    stage,
    handleFormRestore,
    applyCachedFormImages,
  ])

  // After profile submit we prompt Privy sign-in. That can remount this tree and
  // wipe React state, so we also persist the pending Typeform in sessionStorage
  // and restore in-progress flow from the anonymous form cache when needed.
  useEffect(() => {
    if (!isClientHydrated || !authenticated || processingPendingTypeformRef.current) return

    const pending = pendingTypeform || readPendingTypeformFromSession()
    if (pending) {
      // We're authenticated and about to process, so the OAuth redirect has
      // already happened — clear the persisted payload now so a failed/slow
      // attempt can't auto-retrigger this effect into a perpetual spinner.
      // The explicit "Try again" button replays from an in-memory ref instead.
      clearPendingTypeformSession()
      startTransition(() => {
        if (stage === 0) setStage(1)
        setPendingTypeform(null)
      })
      processingPendingTypeformRef.current = true
      hasRestoredInProgressFlowRef.current = true
      submitTypeform(pending).finally(() => {
        processingPendingTypeformRef.current = false
      })
      return
    }

    if (hasRestoredInProgressFlowRef.current) return

    startTransition(() => {
      // Typeform already processed before a remount — jump straight to checkout.
      if (stage < 2) {
        if (citizenData.name) {
          hasRestoredInProgressFlowRef.current = true
          setStage(2)
          clearPendingTypeformSession()
          return
        }
        const walletCache = address ? restoreCache() : null
        const cachedName =
          walletCache?.formData?.citizenData?.name ||
          restoreAnonymousFormCache()?.formData?.citizenData?.name
        if (cachedName) {
          hasRestoredInProgressFlowRef.current = true
          const toRestore = walletCache || restoreAnonymousFormCache()
          if (toRestore) handleFormRestore(toRestore)
          else setStage(2)
          clearPendingTypeformSession()
          return
        }
      }

      if (!imagesRestoredRef.current) {
        restoreWizardArtifacts()
      }

      const anon = restoreAnonymousFormCache()
      const formData = anon?.formData || anon
      if (anon && formData && (anon.stage ?? 0) >= 1 && !hasRestoredInProgressFlowRef.current) {
        hasRestoredInProgressFlowRef.current = true
        handleFormRestore(anon)
      }
    })

    // Lock after the first authenticated restore pass. This effect exists to
    // restore in-progress state once (e.g. after a Privy remount wipes React
    // state). Without this lock it re-runs on every `stage` change and would
    // bounce the user back to checkout when they intentionally navigate
    // backward (e.g. "Change photo" on the Review step sets stage 0).
    hasRestoredInProgressFlowRef.current = true
  }, [
    isClientHydrated,
    authenticated,
    pendingTypeform,
    submitTypeform,
    stage,
    citizenData.name,
    handleFormRestore,
    address,
    restoreCache,
    restoreWizardArtifacts,
  ])

  // Regenerate Handler for Review step
  const handleRegenerateFromReview = useCallback(async () => {
    if (!croppedInputImage) {
      toast.error('No image to regenerate from. Please upload a photo first.')
      return
    }

    clearAiPortraitReady()
    setCitizenImage(undefined)
    setSavedAiImage(undefined)
    setIsImageGenerating(true)
    setHasPendingImageJob(true)

    try {
      await regenerateAIImage(croppedInputImage)
    } catch (error) {
      console.error('Regeneration error:', error)
      toast.error(
        'Image generation is unavailable right now — you can continue with your uploaded photo.',
      )
    } finally {
      // Always release the generating state so the user can keep their cropped
      // photo and proceed to mint even when AI generation fails.
      setIsImageGenerating(false)
      setHasPendingImageJob(false)
    }
  }, [croppedInputImage, regenerateAIImage])

  // ===== Effect Group: Gas Estimation =====
  useEffect(() => {
    if (stage !== 2 || !address) {
      setRenewalPriceWei(null)
      return
    }

    let cancelled = false
    setIsLoadingRenewalPrice(true)
    readContract({
      contract: citizenContract,
      method: 'getRenewalPrice' as string,
      params: [address, ONE_YEAR_SECONDS],
    })
      .then((cost: unknown) => {
        if (!cancelled) {
          setRenewalPriceWei(BigInt(String(cost)))
          setIsLoadingRenewalPrice(false)
        }
      })
      .catch((err) => {
        console.error('Failed to fetch citizenship renewal price:', err)
        if (!cancelled) {
          setRenewalPriceWei(null)
          setIsLoadingRenewalPrice(false)
        }
      })

    return () => {
      cancelled = true
    }
  }, [stage, address, citizenContract])

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
    if (isImageGenerating && hasAiPortrait) {
      setIsImageGenerating(false)
      setHasPendingImageJob(false)
      setImageGenProgress(null)
    }
  }, [citizenImage, croppedInputImage, isImageGenerating, hasAiPortrait])

  // Sync regeneration loading — only clear when regeneration ends (not while
  // initial background generation is running with isRegenerating false).
  useEffect(() => {
    if (isRegenerating) {
      setIsImageGenerating(true)
      wasRegeneratingRef.current = true
    } else if (wasRegeneratingRef.current) {
      wasRegeneratingRef.current = false
      setIsImageGenerating(false)
    }
  }, [isRegenerating])

  useEffect(() => {
    if (!isRegenerating) {
      setRegenElapsedMs(0)
      return
    }
    const start = Date.now()
    const timer = setInterval(() => setRegenElapsedMs(Date.now() - start), 250)
    return () => clearInterval(timer)
  }, [isRegenerating])

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
    imagesRestoredRef.current = !!citizenImage || !!inputImage || !!croppedInputImage
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

  // Cache form state continuously (removed onrampModalOpen guard for more aggressive caching).
  // Do not require a wallet address — signed-out users use the anonymous cache key
  // until they authenticate at profile submit.
  useEffect(() => {
    if (
      stage >= 0 &&
      !mintComplete &&
      (citizenData.name || citizenImage || inputImage || croppedInputImage || stage > 0)
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
    croppedInputImage,
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
  const reviewPreviewFile = useMemo(
    () =>
      getReviewPreviewFile({
        citizenImage,
        croppedInputImage,
        inputImage,
        isImageGenerating,
        hasPendingImageJob,
        aiPortraitReady: isAiPortraitReady(),
      }),
    [citizenImage, croppedInputImage, inputImage, isImageGenerating, hasPendingImageJob],
  )
  const reviewPreviewUrl = useMemo(
    () => (reviewPreviewFile ? URL.createObjectURL(reviewPreviewFile) : null),
    [reviewPreviewFile],
  )
  useEffect(() => {
    return () => {
      if (reviewPreviewUrl) URL.revokeObjectURL(reviewPreviewUrl)
    }
  }, [reviewPreviewUrl])

  const welcomeImageFile = citizenImage || croppedInputImage || inputImage
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
        <div className="w-full">
          {/* Header bar with steps + close */}
          <div className="flex items-center justify-between mb-6">
            <Steps
              className="w-full max-w-[480px]"
              steps={['Design', 'Profile', 'Checkout']}
              currStep={stage}
              lastStep={lastStage}
              setStep={(value) => {
                const next = typeof value === 'function' ? value(stage) : value
                setStage(next)
              }}
            />
            <div className="ml-4 flex items-center gap-2 flex-shrink-0">
              {(stage > 0 ||
                !!inputImage ||
                !!croppedInputImage ||
                !!citizenImage ||
                !!citizenData.name) && (
                <button
                  onClick={handleStartOver}
                  className="text-xs text-slate-500 hover:text-slate-300 transition-colors underline underline-offset-2"
                  aria-label="Start over"
                >
                  Start over
                </button>
              )}
              <button
                onClick={() => setSelectedTier(null)}
                className="p-2 rounded-xl hover:bg-white/5 transition-colors"
                aria-label="Close"
              >
                <XMarkIcon width={28} height={28} className="text-slate-400" />
              </button>
            </div>
          </div>

          {/* Card container */}
          <div className="bg-gradient-to-b from-slate-800/40 to-slate-900/60 backdrop-blur-md border border-white/[0.08] rounded-2xl p-5 sm:p-8">
            {/* Design / Image — stay mounted (hidden) while background AI runs */}
            {keepImageGeneratorMounted && (
              <div
                className={
                  stage === 0
                    ? 'animate-fadeIn'
                    : 'sr-only fixed w-0 h-0 overflow-hidden opacity-0 pointer-events-none'
                }
                aria-hidden={stage !== 0}
              >
                {stage === 0 && (
                  <div className="mb-6">
                    <h2 className="text-2xl font-GoodTimes text-white mb-2">Design</h2>
                    <p className="text-slate-400 text-sm leading-relaxed">
                      Upload a photo with a clear face — yourself or an avatar — position the crop,
                      and we&apos;ll generate your AI passport photo. It renders in the background
                      (~30–60s) while you keep going; you can regenerate or switch back to your own
                      photo on the review step.
                    </p>
                  </div>
                )}
                <ImageGenerator
                  image={citizenImage}
                  setImage={setCitizenImage}
                  inputImage={inputImage}
                  setInputImage={setInputImage}
                  // If the profile is already done (e.g. user hit "Change
                  // photo" on Review), return straight to checkout instead of
                  // making them redo the Profile step.
                  nextStage={() => setStage(citizenData.name ? 2 : 1)}
                  stage={stage}
                  generateInBG
                  onGenerationStateChange={setIsImageGenerating}
                  onGenerationProgress={handleImageGenProgress}
                  onCrop={handleCrop}
                />
                {stage === 0 && process.env.NEXT_PUBLIC_ENV === 'dev' && (
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
                  <div className="flex flex-col items-center gap-4 py-12 px-6 text-center">
                    <Image
                      src="/assets/MoonDAO-Loading-Animation.svg"
                      alt="Processing"
                      width={80}
                      height={80}
                      className="animate-pulse"
                    />
                    <p className="text-white font-medium">
                      {processingElapsedSec < 12
                        ? 'Processing your profile...'
                        : processingElapsedSec < 30
                          ? 'Saving your answers...'
                          : 'Almost there — finalizing your profile...'}
                    </p>
                    <p className="text-slate-400 text-sm max-w-[420px]">
                      This can take up to a minute while we securely sync your responses. We&apos;ll
                      move you to checkout automatically as soon as it&apos;s ready — no need to
                      refresh or resubmit.
                    </p>
                    <p className="text-slate-500 text-xs tabular-nums">
                      Elapsed: {processingElapsedSec}s
                    </p>
                  </div>
                ) : pendingTypeform && !authenticated ? (
                  <div className="flex flex-col items-center gap-4 py-12 px-6 text-center">
                    <h3 className="font-GoodTimes text-lg text-white">
                      One last step — sign in to finish
                    </h3>
                    <p className="text-slate-400 text-sm max-w-[420px]">
                      Your profile is saved. Sign in or create your wallet to finalize your details
                      and continue to mint your citizenship.
                    </p>
                    <button
                      onClick={() => login()}
                      className="mt-2 py-3 px-6 gradient-2 hover:scale-[1.02] active:scale-[0.98] transition-all duration-200 rounded-2xl font-semibold text-white text-sm"
                    >
                      Sign in to continue
                    </button>
                  </div>
                ) : typeformProcessingFailed ? (
                  <div className="flex flex-col items-center gap-4 py-12 px-6 text-center">
                    <h3 className="font-GoodTimes text-lg text-white">
                      Still finalizing your profile
                    </h3>
                    <p className="text-slate-400 text-sm max-w-[420px]">
                      Your answers are saved with Typeform — they&apos;re just taking a little
                      longer than usual to sync. No need to fill anything out again.
                    </p>
                    <button
                      onClick={retryTypeformProcessing}
                      className="mt-2 py-3 px-6 gradient-2 hover:scale-[1.02] active:scale-[0.98] transition-all duration-200 rounded-2xl font-semibold text-white text-sm"
                    >
                      Try again
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
                    {reviewPreviewUrl && (
                      <Image
                        src={reviewPreviewUrl}
                        alt="citizen-image"
                        fill
                        style={{ objectFit: 'cover' }}
                        className={`rounded-2xl transition-opacity duration-300 ${
                          isAwaitingAiPortrait && !hasAiPortrait
                            ? 'opacity-30 blur-[2px]'
                            : 'opacity-100'
                        }`}
                      />
                    )}
                    {isAwaitingAiPortrait && !hasAiPortrait && (
                      <CitizenImageGenerationProgress
                        phase={activeImageGenProgress?.phase ?? 'uploading'}
                        elapsedMs={activeImageGenProgress?.elapsedMs ?? 0}
                        progressPct={
                          activeImageGenProgress?.progressPct ?? computeProgressPct('uploading', 0)
                        }
                        isBackgroundFlow
                        tipIndex={activeImageGenProgress?.tipIndex ?? 0}
                        variant="overlay"
                      />
                    )}
                    {!hasAiPortrait && !croppedInputImage && !isAwaitingAiPortrait && (
                      <div className="absolute inset-0 flex items-center justify-center bg-slate-800/60">
                        <p className="text-slate-400 text-center text-sm px-6">
                          Complete previous steps to generate your citizen image
                        </p>
                      </div>
                    )}
                  </div>
                  {(hasAiPortrait || croppedInputImage) && (
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
                        {croppedInputImage && hasAiPortrait && (
                          <button
                            onClick={() => {
                              // Preserve the AI portrait so the user can
                              // restore it without regenerating.
                              setSavedAiImage(citizenImage)
                              clearAiPortraitReady()
                              setCitizenImage(croppedInputImage)
                              setIsImageGenerating(false)
                              setHasPendingImageJob(false)
                              clearPendingImageJob()
                              setImageGenProgress(null)
                            }}
                            className="flex-1 py-2.5 px-5 bg-white/[0.06] hover:bg-white/[0.1] border border-white/[0.1] hover:border-white/[0.2] transition-all duration-200 rounded-2xl font-semibold text-white text-sm"
                          >
                            Use my photo instead
                          </button>
                        )}
                        {savedAiImage && !hasAiPortrait && (
                          <button
                            onClick={() => {
                              setCitizenImage(savedAiImage)
                              markAiPortraitReady()
                              setSavedAiImage(undefined)
                            }}
                            className="flex-1 py-2.5 px-5 bg-white/[0.06] hover:bg-white/[0.1] border border-white/[0.1] hover:border-white/[0.2] transition-all duration-200 rounded-2xl font-semibold text-white text-sm"
                          >
                            Use AI photo
                          </button>
                        )}
                      </div>
                      <button
                        onClick={() => {
                          setCitizenImage(undefined)
                          setSavedAiImage(undefined)
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

                {/* Cost breakdown */}
                <div className="bg-slate-800/30 border border-white/[0.06] rounded-2xl p-5">
                  <h3 className="font-GoodTimes text-base mb-3 text-white">Mint cost</h3>
                  {isLoadingMintCosts ? (
                    <p className="text-slate-400 text-sm">Calculating costs…</p>
                  ) : (
                    <dl className="space-y-3 text-sm">
                      <div className="flex justify-between gap-4">
                        <dt className="text-slate-400">1-year citizenship</dt>
                        <dd className="text-right tabular-nums">
                          {freeMint ? (
                            <span className="text-emerald-400 font-medium">Sponsored</span>
                          ) : (
                            <>
                              <span className="text-white">
                                {formatEthAmount(mintCostBreakdown.renewalEth)} ETH
                              </span>
                              {renewalUsd > 0 && (
                                <span className="block text-slate-400 text-xs mt-0.5">
                                  ~${Math.round(renewalUsd)} / year
                                </span>
                              )}
                            </>
                          )}
                        </dd>
                      </div>
                      <div className="flex justify-between gap-4">
                        <dt className="text-slate-400">Network fee (est.)</dt>
                        <dd className="text-right tabular-nums">
                          {freeMint ? (
                            <span className="text-emerald-400 font-medium">Sponsored</span>
                          ) : (
                            <span className="text-white">
                              {formatEthAmount(mintCostBreakdown.gasEth)} {nativeSymbol}
                            </span>
                          )}
                        </dd>
                      </div>
                      {!freeMint && isCrossChain && mintCostBreakdown.bridgeEth > 0 && (
                        <div className="flex justify-between gap-4">
                          <dt className="text-slate-400">Cross-chain bridge (est.)</dt>
                          <dd className="text-white text-right tabular-nums">
                            {formatEthAmount(mintCostBreakdown.bridgeEth)} {nativeSymbol}
                          </dd>
                        </div>
                      )}
                      <div className="flex justify-between gap-4 pt-3 border-t border-white/[0.08]">
                        <dt className="text-slate-300 font-medium">Total due at mint</dt>
                        <dd className="text-white font-medium text-right tabular-nums">
                          {freeMint ? (
                            <span className="text-emerald-400">Free</span>
                          ) : (
                            <>
                              {formatEthAmount(mintCostBreakdown.totalEth)} {nativeSymbol}
                              {totalMintUsd > 0 && (
                                <span className="block text-slate-400 text-xs font-normal mt-0.5">
                                  ~${Math.round(totalMintUsd)} today
                                </span>
                              )}
                            </>
                          )}
                        </dd>
                      </div>
                    </dl>
                  )}
                  <p className="mt-4 text-slate-500 text-xs leading-relaxed">
                    {freeMint
                      ? `Your citizenship and network fees are fully sponsored — you pay nothing to mint. Renewal is ~1 year from mint.`
                      : `Citizenship is paid in ${nativeSymbol} on ${selectedChain?.name ?? 'your network'}. Gas varies with network conditions. Renewal is ~1 year from mint.`}
                  </p>
                </div>

                {/* Info box */}
                <div className="bg-slate-800/30 border border-white/[0.06] rounded-2xl p-5">
                  <h3 className="font-GoodTimes text-base mb-3 text-white">Citizenship</h3>
                  <p className="text-slate-400 text-sm leading-relaxed">
                    Citizenship lasts for one year and can be renewed at any time. Wallet funds are
                    self-custodied and not dependent on registration.
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
                    !agreedToCondition || isLoadingMint || isLoadingGasEstimate || isImageGenerating
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
