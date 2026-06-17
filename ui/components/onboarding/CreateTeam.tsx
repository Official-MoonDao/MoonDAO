import { XMarkIcon } from '@heroicons/react/24/outline'
import { Widget } from '@typeform/embed-react'
import {
  DEPLOYED_ORIGIN,
  DISCORD_CITIZEN_ROLE_ID,
  TEAM_ADDRESSES,
  TEAM_CREATOR_ADDRESSES,
} from 'const/config'
import { ethers } from 'ethers'
import Image from 'next/image'
import { useRouter } from 'next/router'
import { useCallback, useContext, useEffect, useRef, useState } from 'react'
import toast from 'react-hot-toast'
import { prepareContractCall, readContract, sendAndConfirmTransaction } from 'thirdweb'
import { useActiveAccount } from 'thirdweb/react'
import useWindowSize from '../../lib/team/use-window-size'
import { useOnrampAutoTransaction } from '@/lib/coinbase/useOnrampAutoTransaction'
import { useOnrampInitialStage } from '@/lib/coinbase/useOnrampInitialStage'
import useOnrampJWT from '@/lib/coinbase/useOnrampJWT'
import sendDiscordMessage from '@/lib/discord/sendDiscordMessage'
import { pinBlobOrFile } from '@/lib/ipfs/pinBlobOrFile'
import {
  estimateGasWithAPI,
  applyGasBuffer,
  extractTokenIdFromReceipt,
  handleTypeformSubmission,
} from '@/lib/onboarding/shared-utils'
import PrivyWalletContext from '@/lib/privy/privy-wallet-context'
import { useGasPrice } from '@/lib/rpc/useGasPrice'
import { generatePrettyLink } from '@/lib/subscription/pretty-links'
import { getChainSlug } from '@/lib/thirdweb/chain'
import useContract from '@/lib/thirdweb/hooks/useContract'
import { useNativeBalance } from '@/lib/thirdweb/hooks/useNativeBalance'
import waitForERC721 from '@/lib/thirdweb/waitForERC721'
import formatTeamFormData, { TeamData } from '@/lib/typeform/teamFormData'
import {
  base64ToFile,
  fileToBase64,
  isSerializedFile,
  renameFile,
  SerializedFile,
} from '@/lib/utils/files'
import { useClientHydrated } from '@/lib/utils/hooks/useClientHydrated'
import { useFormCache } from '@/lib/utils/hooks/useFormCache'
import { compressImageForStorage } from '@/lib/utils/images'
import MoonDAOTeamCreatorABI from '../../const/abis/MoonDAOTeamCreator.json'
import TeamABI from '../../const/abis/Team.json'
import Container from '../layout/Container'
import ContentLayout from '../layout/ContentLayout'
import { ExpandedFooter } from '../layout/ExpandedFooter'
import { Steps } from '../layout/Steps'
import { FundOnrampModal } from '../onramp/FundOnrampModal'
import { PrivyWeb3Button } from '../privy/PrivyWeb3Button'
import { DataOverview } from './DataOverview'
import { ImageGenerator } from './TeamImageGenerator'
import { TermsCheckbox } from './TermsCheckbox'

/**
 * CreateTeam Component
 *
 * Component Structure:
 * 1. Context & Constants
 * 2. State Declarations (Form, Loading, Gas)
 * 3. Custom Hooks
 * 4. Computed Values (useMemo)
 * 5. Internal Helper Functions
 * 6. Event Handlers & Callbacks
 * 7. Side Effects (grouped by purpose)
 * 8. JSX Render
 */
export default function CreateTeam({ selectedChain, setSelectedTier }: any) {
  // ===== Context & Constants =====
  const router = useRouter()
  const chainSlug = getChainSlug(selectedChain)
  const account = useActiveAccount()
  const address = account?.address
  const { selectedWallet, setSelectedWallet } = useContext(PrivyWalletContext)
  const isClientHydrated = useClientHydrated()

  // Form state caching - needs to be defined before useOnrampInitialStage so the
  // onramp redirect/reload (US Apple Pay) can restore progress and auto-resume the mint.
  const { setCache, restoreCache, clearCache } = useFormCache<{
    stage: number
    teamData: TeamData
    teamImage: SerializedFile | null
    agreedToCondition: boolean
    selectedChainSlug: string
  }>('CreateTeamCacheV1', address)

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
  const [stage, setStage] = useState<number>(0)
  const [lastStage, setLastStage] = useState<number>(0)
  const [teamImage, setTeamImage] = useState<any>()
  const [teamData, setTeamData] = useState<TeamData>({
    name: '',
    description: '',
    twitter: '',
    communications: '',
    website: '',
    view: 'private',
    formResponseId: '',
  })
  const [agreedToCondition, setAgreedToCondition] = useState<boolean>(false)

  // ===== State: Loading State =====
  const [isLoadingMint, setIsLoadingMint] = useState<boolean>(false)
  const [isLoadingGasEstimate, setIsLoadingGasEstimate] = useState(false)

  // ===== State: Gas Estimation =====
  const [estimatedGas, setEstimatedGas] = useState<bigint>(BigInt(0))

  // ===== State: Onramp State =====
  const [onrampModalOpen, setOnrampModalOpen] = useState(false)
  const [requiredEthAmount, setRequiredEthAmount] = useState(0)

  // ===== Refs =====
  const hasRestoredFormDataRef = useRef(false)
  const imageRestoredRef = useRef(false)
  const stageRef = useRef(stage)

  // ===== Custom Hooks =====
  const { effectiveGasPrice } = useGasPrice(selectedChain)
  const { isMobile } = useWindowSize()

  const teamContract = useContract({
    address: TEAM_ADDRESSES[chainSlug],
    abi: TeamABI,
    chain: selectedChain,
  })

  const teamCreatorContract = useContract({
    address: TEAM_CREATOR_ADDRESSES[chainSlug],
    abi: MoonDAOTeamCreatorABI,
    chain: selectedChain,
  })

  const { nativeBalance, refetch: refetchNativeBalance } = useNativeBalance()

  // ===== Internal Helper Functions =====

  const pinHatMetadata = useCallback(async (name: string, description: string, role: string) => {
    const metadataBlob = new Blob(
      [
        JSON.stringify({
          type: '1.0',
          data: {
            name: `${name} ${role}`,
            description,
          },
        }),
      ],
      { type: 'application/json' }
    )
    const { cid } = await pinBlobOrFile(metadataBlob)
    return cid
  }, [])

  const handlePostMint = useCallback(
    async (mintedTokenId: string, teamName: string) => {
      const teamPrettyLink = generatePrettyLink(teamName)
      clearCache()
      setTimeout(async () => {
        await sendDiscordMessage(
          'networkNotifications',
          `## [**${teamName}**](${DEPLOYED_ORIGIN}/team/${teamPrettyLink}?_timestamp=123456789) has created a team in the Space Acceleration Network! <@&${DISCORD_CITIZEN_ROLE_ID}>`
        )

        router.push(`/team/${teamPrettyLink}`)
        setIsLoadingMint(false)
      }, 10000)
    },
    [router, clearCache]
  )

  const serializeForStorage = useCallback(async (file: File | undefined | null) => {
    if (!file) return null
    try {
      const compressed = (await compressImageForStorage(file)) as File
      return await fileToBase64(compressed)
    } catch {
      return null
    }
  }, [])

  const restoreImageFromCache = useCallback((imageData: SerializedFile | null | undefined) => {
    if (imageData && isSerializedFile(imageData)) {
      setTeamImage(base64ToFile(imageData))
      return true
    }
    return false
  }, [])

  // ===== Event Handlers & Callbacks =====

  const calculateCost = useCallback(
    (renewalCost: bigint) => {
      const gasCostWei = estimatedGas * effectiveGasPrice
      const gasCostEth = Number(gasCostWei) / 1e18
      const totalCost = Number(ethers.utils.formatEther(renewalCost)) + gasCostEth
      return totalCost
    },
    [estimatedGas, effectiveGasPrice]
  )

  const serializeCacheData = useCallback(async () => {
    const serializedTeamImage = await serializeForStorage(teamImage)
    return {
      stage,
      teamData,
      teamImage: serializedTeamImage,
      agreedToCondition,
      selectedChainSlug: chainSlug,
    }
  }, [stage, teamData, teamImage, agreedToCondition, chainSlug, serializeForStorage])

  const checkBalanceSufficient = useCallback(async () => {
    try {
      const cost: any = await readContract({
        contract: teamContract,
        method: 'getRenewalPrice' as string,
        params: [address, 365 * 24 * 60 * 60],
      })
      const totalCost = calculateCost(cost)
      return +(nativeBalance ?? '0') >= totalCost
    } catch (error) {
      console.error('Error checking balance:', error)
      return false
    }
  }, [address, teamContract, nativeBalance, calculateCost])

  const handleFormRestore = useCallback(
    (restored: any) => {
      if (hasRestoredFormDataRef.current) return

      // Handle both old and new cache formats
      const formData = restored.formData || restored
      const hasProfile = !!formData?.teamData?.name
      const hasImage = !!formData?.teamImage

      if (!formData || (!hasProfile && !hasImage)) return

      hasRestoredFormDataRef.current = true

      if (typeof restored.stage === 'number') {
        setStage((current) => Math.max(current, restored.stage))
      } else if (hasProfile) {
        setStage((current) => (current < 2 ? 2 : current))
      }

      if (hasProfile) {
        setTeamData(formData.teamData)
      }

      imageRestoredRef.current = restoreImageFromCache(formData.teamImage)
      setAgreedToCondition(formData.agreedToCondition ?? false)
    },
    [restoreImageFromCache]
  )

  const callMint = useCallback(async () => {
    if (!teamImage) {
      return toast.error('Please upload an image and complete the previous steps.')
    }

    if (!account || !address) {
      return toast.error('Please connect your wallet to continue.')
    }

    setIsLoadingMint(true)

    try {
      const cost: any = await readContract({
        contract: teamContract,
        method: 'getRenewalPrice' as string,
        params: [address, 365 * 24 * 60 * 60],
      })

      const totalCost = calculateCost(cost)

      if (+(nativeBalance ?? '0') < totalCost) {
        const shortfall = totalCost - +(nativeBalance ?? '0')
        const requiredAmount = shortfall * 1.15
        setRequiredEthAmount(requiredAmount)
        setOnrampModalOpen(true)
        setIsLoadingMint(false)
        return
      }

      const adminHatCid = await pinHatMetadata(teamData.name, teamData.description, 'Admin')
      const managerHatCid = await pinHatMetadata(teamData.name, teamData.description, 'Manager')
      const memberHatCid = await pinHatMetadata(teamData.name, teamData.description, 'Member')

      const renamedTeamImage = renameFile(teamImage, `${teamData.name} Team Image`)
      const { cid: newImageIpfsHash } = await pinBlobOrFile(renamedTeamImage)

      if (!newImageIpfsHash) {
        setIsLoadingMint(false)
        return toast.error('Image upload to IPFS failed. Try a smaller file.')
      }

      const transaction = prepareContractCall({
        contract: teamCreatorContract,
        method: 'createMoonDAOTeam' as string,
        params: [
          {
            adminHatURI: 'ipfs://' + adminHatCid,
            managerHatURI: 'ipfs://' + managerHatCid,
            memberHatURI: 'ipfs://' + memberHatCid,
          },
          {
            name: teamData.name,
            bio: teamData.description,
            image: 'ipfs://' + newImageIpfsHash,
            twitter: teamData.twitter,
            communications: teamData.communications,
            website: teamData.website,
            _view: teamData.view,
            formId: teamData.formResponseId,
          },
          [],
        ],
        value: cost,
      })

      const receipt: any = await sendAndConfirmTransaction({
        transaction,
        account,
      })

      const mintedTokenId = extractTokenIdFromReceipt(receipt)

      if (!mintedTokenId) {
        setIsLoadingMint(false)
        return toast.error('Mint unverified — check your wallet or contact support.')
      }

      if (mintedTokenId) {
        await waitForERC721(teamContract, +mintedTokenId)
        await handlePostMint(mintedTokenId, teamData.name)
      }
    } catch (err) {
      console.error(err)
      setIsLoadingMint(false)
    }
  }, [
    teamImage,
    account,
    address,
    teamContract,
    calculateCost,
    nativeBalance,
    pinHatMetadata,
    teamData,
    teamCreatorContract,
    handlePostMint,
  ])

  const estimateMintGas = useCallback(async () => {
    if (!account || !address || !teamData.name) return

    setIsLoadingGasEstimate(true)

    try {
      const cost: any = await readContract({
        contract: teamContract,
        method: 'getRenewalPrice' as string,
        params: [address, 365 * 24 * 60 * 60],
      })

      const transaction = await prepareContractCall({
        contract: teamCreatorContract,
        method: 'createMoonDAOTeam' as string,
        params: [
          {
            adminHatURI: 'ipfs://placeholder',
            managerHatURI: 'ipfs://placeholder',
            memberHatURI: 'ipfs://placeholder',
          },
          {
            name: teamData.name,
            bio: teamData.description,
            image: 'ipfs://placeholder',
            twitter: teamData.twitter,
            communications: teamData.communications,
            website: teamData.website,
            _view: teamData.view,
            formId: teamData.formResponseId || '0000',
          },
          [],
        ],
        value: cost,
      })

      let gasEstimate: bigint = BigInt(0)

      try {
        const txData =
          typeof transaction.data === 'function' ? await transaction.data() : transaction.data

        if (!txData) {
          throw new Error('Transaction data is undefined')
        }

        gasEstimate = await estimateGasWithAPI({
          chainId: selectedChain.id,
          from: address,
          to: TEAM_CREATOR_ADDRESSES[chainSlug],
          data: txData,
          value: `0x${cost.toString(16)}`,
        })
      } catch (estimationError: any) {
        console.error('Gas estimation error:', estimationError)
        gasEstimate = BigInt(350000)
      }

      const gasWithBuffer = applyGasBuffer(gasEstimate, 130)
      setEstimatedGas(gasWithBuffer)
      setIsLoadingGasEstimate(false)
    } catch (error) {
      console.error('Error estimating gas:', error instanceof Error ? error.message : error)
      const fallbackGas = BigInt(350000)
      const bufferedFallback = applyGasBuffer(fallbackGas, 150)
      setEstimatedGas(bufferedFallback)
      setIsLoadingGasEstimate(false)
    }
  }, [
    account,
    address,
    teamData.name,
    teamData.description,
    teamData.twitter,
    teamData.communications,
    teamData.website,
    teamData.view,
    teamData.formResponseId,
    teamContract,
    teamCreatorContract,
    selectedChain,
    chainSlug,
  ])

  const submitTypeform = useCallback(async (formResponse: any) => {
    try {
      const { formId, responseId } = formResponse

      const cleanedData = await handleTypeformSubmission({
        formId,
        responseId,
        formatter: formatTeamFormData,
      })

      setTeamData(cleanedData)
      setStage(2)
    } catch (error) {
      console.error('Error submitting typeform:', error)
      alert('There was an error processing your form submission. Please try again.')
    }
  }, [])

  // ===== Side Effects =====

  // ===== Effect Group: UI State Sync =====
  useEffect(() => {
    if (stage > lastStage) {
      setLastStage(stage)
    }
  }, [stage, lastStage])

  // Apply the stage restored from the onramp redirect/reload once hydrated.
  useEffect(() => {
    if (!isClientHydrated || restoredStage === 0) return
    setStage((current) => Math.max(current, restoredStage))
  }, [isClientHydrated, restoredStage])

  // Keep refs in sync for callbacks that run after an onramp redirect.
  useEffect(() => {
    stageRef.current = stage
    imageRestoredRef.current = imageRestoredRef.current || !!teamImage
  }, [teamImage, stage])

  // ===== Effect Group: Gas Estimation =====
  useEffect(() => {
    if (stage === 2 && address && teamData.name) {
      estimateMintGas()
    }
  }, [stage, address, teamData.name, estimateMintGas])

  // ===== Effect Group: Caching =====
  // Persist progress at checkout so the onramp redirect (non-US Coinbase / MoonPay)
  // or in-page reload (US Apple Pay) can restore the form and auto-resume the mint.
  useEffect(() => {
    if (stage === 2 && agreedToCondition && address) {
      const performCache = async () => {
        const cacheData = await serializeCacheData()
        setCache(cacheData, stage)
      }
      performCache()
    }
  }, [agreedToCondition, stage, address, serializeCacheData, setCache])

  // ===== Effect Group: Onramp Auto-Transaction =====
  useOnrampAutoTransaction({
    address,
    context: 'team',
    expectedChainSlug: chainSlug,
    refetchNativeBalance: async () => {
      await refetchNativeBalance()
    },
    onTransaction: callMint,
    onFormRestore: handleFormRestore,
    checkBalanceSufficient,
    shouldProceed: (restored) => {
      const formData = restored.formData || restored
      const hasImage =
        formData.teamImage &&
        (isSerializedFile(formData.teamImage) || formData.teamImage !== 'PENDING_SERIALIZATION')
      return !!formData.agreedToCondition && !!hasImage
    },
    restoreCache: getCachedForm,
    getChainSlugFromCache: (restored) => restored?.formData?.selectedChainSlug,
    setStage,
    setSelectedWallet,
    waitForReady: () => {
      const gasEstimateReady = !isLoadingGasEstimate && estimatedGas > BigInt(0)
      const gasPriceReady = effectiveGasPrice !== undefined && effectiveGasPrice > BigInt(0)
      const imageReady = imageRestoredRef.current || !!teamImage
      return gasEstimateReady && gasPriceReady && imageReady
    },
  })

  // ===== JSX Render =====

  return (
    <Container>
      <div id="create-team-image-container">
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
                  setStep={setStage}
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
                {/* Stage 0: Design */}
                {stage === 0 && (
                  <div className="animate-fadeIn">
                    <div className="mb-6">
                      <h2 className="text-2xl font-GoodTimes text-white mb-2">Design</h2>
                      <p className="text-slate-400 text-sm leading-relaxed">
                        Upload your team logo or image. For best results, use an image with a white
                        or transparent background.
                      </p>
                    </div>
                    <ImageGenerator
                      setImage={setTeamImage}
                      nextStage={() => setStage(1)}
                      stage={stage}
                    />
                  </div>
                )}

                {/* Stage 1: Team Profile */}
                {stage === 1 && (
                  <div className="animate-fadeIn">
                    <div className="mb-6">
                      <h2 className="text-2xl font-GoodTimes text-white mb-2">Team Profile</h2>
                      <p className="text-slate-400 text-sm">Fill out your team information below.</p>
                    </div>
                    <div className="w-full rounded-xl overflow-hidden border border-white/[0.06]">
                      <Widget
                        className="w-full"
                        id={process.env.NEXT_PUBLIC_TYPEFORM_TEAM_FORM_ID as string}
                        onSubmit={submitTypeform}
                        height={700}
                      />
                    </div>
                  </div>
                )}

                {/* Stage 2: Review & Mint */}
                {stage === 2 && (
                  <div className="animate-fadeIn flex flex-col gap-8">
                    <div>
                      <h2 className="text-2xl font-GoodTimes text-white mb-2">Review & Mint</h2>
                      <p className="text-slate-400 text-sm">
                        Review your team information before registering on the blockchain.
                      </p>
                    </div>

                    {teamImage && (
                      <div className="flex flex-col items-center gap-3">
                        <div className="relative w-full max-w-[320px] aspect-square rounded-2xl border border-white/[0.08] bg-slate-900/60 overflow-hidden">
                          <Image
                            src={URL.createObjectURL(teamImage)}
                            alt="team-image"
                            fill
                            style={{ objectFit: 'cover' }}
                            className="rounded-2xl"
                          />
                        </div>
                        <button
                          onClick={() => setStage(0)}
                          className="text-sky-400 hover:text-sky-300 text-sm transition-colors"
                        >
                          ← Edit Image
                        </button>
                      </div>
                    )}

                    <DataOverview
                      data={teamData}
                      title="Team Overview"
                      excludeKeys={['formResponseId']}
                    />

                    <div className="flex flex-col gap-4">
                      <div className="bg-slate-800/30 border border-white/[0.06] rounded-2xl p-5">
                        <h3 className="font-GoodTimes text-base mb-3 text-white">Treasury</h3>
                        <p className="text-slate-400 text-sm leading-relaxed">
                          A self-custodied multisignature treasury will secure your organization's
                          assets. You can add more signers later via your Team management portal.
                        </p>
                      </div>
                      <div className="bg-slate-800/30 border border-white/[0.06] rounded-2xl p-5">
                        <h3 className="font-GoodTimes text-base mb-3 text-white">Manager</h3>
                        <p className="text-slate-400 text-sm leading-relaxed">
                          The connected wallet will act as Manager. You can add managers or members
                          later via your Team Management Portal.
                        </p>
                      </div>
                    </div>

                    <TermsCheckbox checked={agreedToCondition} onChange={setAgreedToCondition} />
                    <PrivyWeb3Button
                      id="team-checkout-button"
                      label={isLoadingMint ? 'Creating Team...' : 'Create Team'}
                      className="w-full py-3 gradient-2 hover:scale-[1.02] active:scale-[0.98] transition-all duration-200 rounded-2xl font-semibold text-base disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:scale-100"
                      isDisabled={!agreedToCondition || isLoadingMint || isLoadingGasEstimate}
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
                          Creating your team on the blockchain...
                        </p>
                      </div>
                    )}
                  </div>
                )}
              </div>

              {process.env.NEXT_PUBLIC_ENV === 'dev' && (
                <div className="flex justify-center gap-4 mt-4">
                  <button
                    id="team-back-button"
                    className="text-xs text-slate-500 hover:text-white transition-colors"
                    onClick={() => setStage(stage - 1)}
                  >
                    ← BACK
                  </button>
                  <button
                    id="team-next-button"
                    className="text-xs text-slate-500 hover:text-white transition-colors"
                    onClick={() => setStage(stage + 1)}
                  >
                    NEXT →
                  </button>
                </div>
              )}
          </div>
        </ContentLayout>
      </div>
      {address && (
        <FundOnrampModal
          enabled={onrampModalOpen}
          setEnabled={setOnrampModalOpen}
          address={address}
          selectedChain={selectedChain}
          ethAmount={requiredEthAmount}
          isWaitingForGasEstimate={isLoadingGasEstimate}
          context="team"
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
          onMoonPayBeforeOpen={async () => {
            const currentStage = stageRef.current
            const cacheData = await serializeCacheData()
            setCache(cacheData, currentStage)
          }}
          checkBalanceSufficient={checkBalanceSufficient}
          refetchBalance={async () => {
            await refetchNativeBalance()
          }}
          onBalanceSufficient={() => {
            setOnrampModalOpen(false)
            callMint()
          }}
        />
      )}
    </Container>
  )
}
