import { XMarkIcon } from '@heroicons/react/24/outline'
import { useFundWallet } from '@privy-io/react-auth'
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
import { useCallback, useEffect, useState } from 'react'
import toast from 'react-hot-toast'
import { prepareContractCall, readContract, sendAndConfirmTransaction } from 'thirdweb'
import { useActiveAccount } from 'thirdweb/react'
import useWindowSize from '../../lib/team/use-window-size'
import sendDiscordMessage from '@/lib/discord/sendDiscordMessage'
import { pinBlobOrFile } from '@/lib/ipfs/pinBlobOrFile'
import {
  estimateGasWithAPI,
  applyGasBuffer,
  extractTokenIdFromReceipt,
  handleTypeformSubmission,
} from '@/lib/onboarding/shared-utils'
import { useGasPrice } from '@/lib/rpc/useGasPrice'
import { generatePrettyLink } from '@/lib/subscription/pretty-links'
import { getChainSlug } from '@/lib/thirdweb/chain'
import useContract from '@/lib/thirdweb/hooks/useContract'
import { useNativeBalance } from '@/lib/thirdweb/hooks/useNativeBalance'
import waitForERC721 from '@/lib/thirdweb/waitForERC721'
import formatTeamFormData, { TeamData } from '@/lib/typeform/teamFormData'
import { renameFile } from '@/lib/utils/files'
import viemChains from '@/lib/viem/viemChains'
import MoonDAOTeamCreatorABI from '../../const/abis/MoonDAOTeamCreator.json'
import TeamABI from '../../const/abis/Team.json'
import Container from '../layout/Container'
import ContentLayout from '../layout/ContentLayout'
import { ExpandedFooter } from '../layout/ExpandedFooter'
import { Steps } from '../layout/Steps'
import { PrivyWeb3Button } from '../privy/PrivyWeb3Button'
import { DataOverview } from './DataOverview'
import { StageContainer } from './StageContainer'
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

  const { nativeBalance } = useNativeBalance()
  const { fundWallet } = useFundWallet()

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
      setTimeout(async () => {
        await sendDiscordMessage(
          'networkNotifications',
          `## [**${teamName}**](${DEPLOYED_ORIGIN}/team/${teamPrettyLink}?_timestamp=123456789) has created a team in the Space Acceleration Network! <@&${DISCORD_CITIZEN_ROLE_ID}>`
        )

        router.push(`/team/${teamPrettyLink}`)
        setIsLoadingMint(false)
      }, 10000)
    },
    [router]
  )

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

      if (+nativeBalance < totalCost) {
        const roundedCost = Math.ceil(totalCost * 1000000) / 1000000
        setIsLoadingMint(false)
        return await fundWallet(address, {
          amount: String(roundedCost),
          chain: viemChains[chainSlug],
        })
      }

      const adminHatCid = await pinHatMetadata(teamData.name, teamData.description, 'Admin')
      const managerHatCid = await pinHatMetadata(teamData.name, teamData.description, 'Manager')
      const memberHatCid = await pinHatMetadata(teamData.name, teamData.description, 'Member')

      const renamedTeamImage = renameFile(teamImage, `${teamData.name} Team Image`)
      const { cid: newImageIpfsHash } = await pinBlobOrFile(renamedTeamImage)

      if (!newImageIpfsHash) {
        setIsLoadingMint(false)
        return toast.error('Error pinning image to IPFS.')
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
        return toast.error('Could not find mint event in transaction.')
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
    fundWallet,
    chainSlug,
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

  // ===== Effect Group: Gas Estimation =====
  useEffect(() => {
    if (stage === 2 && address && teamData.name) {
      estimateMintGas()
    }
  }, [stage, address, teamData.name, estimateMintGas])

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
          <div className="flex flex-row w-full justify-center">
            <div className="w-full lg:max-w-[800px] flex flex-col">
              <div className="flex items-center justify-between mb-8 px-4 md:px-0">
                <Steps
                  className="flex-1 max-w-[500px]"
                  steps={['Design', 'Profile', 'Checkout']}
                  currStep={stage}
                  lastStep={lastStage}
                  setStep={setStage}
                />
                <button
                  onClick={() => setSelectedTier(null)}
                  className="ml-4 p-2 rounded-full bg-white/5 hover:bg-white/10 border border-white/10 transition-all duration-200"
                >
                  <XMarkIcon width={20} height={20} className="text-white/60" />
                </button>
              </div>

              <div className="bg-white/[0.03] backdrop-blur-sm border border-white/10 rounded-2xl p-6 md:p-10">

              {/* Typeform form */}
              {stage === 0 && (
                <StageContainer
                  className={`mb-[350px] max-w-[600px]`}
                  title="Design"
                  description="Design your unique onchain registration by uploading your logo or image. For best results, use an image with a white or transparent background."
                >
                  <ImageGenerator
                    setImage={setTeamImage}
                    nextStage={() => setStage(1)}
                    stage={stage}
                  />
                </StageContainer>
              )}

              {/* Upload & Create Image */}
              {stage === 1 && (
                <StageContainer
                  title="Team Profile"
                  description="Please complete your team profile by filling out the form below."
                >
                  <div className="w-full bg-black/20 backdrop-blur-sm border border-white/10 rounded-2xl overflow-hidden relative">
                    <Widget
                      className="w-full"
                      id={process.env.NEXT_PUBLIC_TYPEFORM_TEAM_FORM_ID as string}
                      onSubmit={submitTypeform}
                      height={700}
                    />
                  </div>
                </StageContainer>
              )}
              {/* Pin Image and Metadata to IPFS, Mint NFT to Gnosis Safe */}
              {stage === 2 && (
                <StageContainer
                  title="Review & Mint"
                  description="Please review your team information before finalizing your registration on the blockchain."
                >
                  {teamImage && (
                    <div className="w-full bg-black/20 backdrop-blur-sm border border-white/10 rounded-2xl p-6 mb-6">
                      <h3 className="text-lg font-semibold text-white mb-4">Team Image Preview</h3>
                      <div className="flex justify-start">
                        <Image
                          src={URL.createObjectURL(teamImage)}
                          alt="entity-image"
                          width={300}
                          height={300}
                          className="rounded-xl border border-slate-600/50"
                        />
                      </div>
                    </div>
                  )}

                  <div className="flex flex-col w-full md:p-5 mt-8 max-w-[600px]">
                    <DataOverview
                      data={teamData}
                      title="Team Overview"
                      excludeKeys={['formResponseId']}
                    />
                  </div>
                  <div className="flex flex-col w-full md:p-5 mt-8 max-w-[600px]">
                    <div className="bg-black/20 backdrop-blur-sm border border-white/10 rounded-2xl p-6">
                      <h2 className="font-GoodTimes text-xl mb-6 text-white">
                        Important Information
                      </h2>
                      <div className="flex flex-col rounded-[20px] bg-slate-800/50 border border-slate-600/30 p-5 pb-10 md:p-5">
                        <h3 className="font-GoodTimes text-lg mb-3 text-white">Treasury</h3>
                        <p className="text-slate-300 leading-relaxed">
                          A self-custodied multisignature treasury will secure your organization’s
                          assets, allowing interaction with any smart contracts within the Ethereum
                          ecosystem.
                          <br />
                          <br />
                          You can add more signers later via your Team management portal.
                        </p>
                      </div>
                      <div className="flex flex-col bg-slate-800/50 border border-slate-600/30 rounded-[20px] pb-10 p-5 mt-5">
                        <h3 className="font-GoodTimes text-lg mb-3 text-white">Manager</h3>
                        <p className="text-slate-300 leading-relaxed">
                          The manager can modify your organization’s information. To begin, the
                          currently connected wallet will act as the Manager.
                          <br />
                          <br />
                          You can add a manager or members to your organization using your Team
                          Management Portal.
                        </p>
                      </div>
                      <p className="mt-6 text-center text-slate-300 font-medium">
                        Welcome to the future of on-chain, off-world coordination with MoonDAO!
                      </p>
                    </div>
                  </div>
                  <TermsCheckbox checked={agreedToCondition} onChange={setAgreedToCondition} />
                  <PrivyWeb3Button
                    id="team-checkout-button"
                    label={isLoadingMint ? 'Creating Team...' : 'Create Team'}
                    className="mt-6 w-auto px-8 py-2 gradient-2 hover:scale-105 transition-transform rounded-xl font-medium text-base disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:scale-100"
                    isDisabled={!agreedToCondition || isLoadingMint || isLoadingGasEstimate}
                    action={callMint}
                  />
                  {isLoadingMint && (
                    <div className="mt-4 p-4 bg-black/20 backdrop-blur-sm border border-white/10 rounded-2xl">
                      <p className="text-slate-300 text-center">
                        Creating your team on the blockchain...
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
          </div>
          {/* Dev Buttons */}
          {process.env.NEXT_PUBLIC_ENV === 'dev' && (
            <div className="flex flex-row justify-center gap-4">
              <button id="team-back-button" onClick={() => setStage(stage - 1)}>
                BACK
              </button>
              <button id="team-next-button" onClick={() => setStage(stage + 1)}>
                NEXT
              </button>
            </div>
          )}
        </ContentLayout>
      </div>
    </Container>
  )
}
