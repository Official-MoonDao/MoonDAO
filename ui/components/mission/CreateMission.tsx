import {
  ArrowLeftCircleIcon,
  ArrowRightCircleIcon,
  RocketLaunchIcon,
  XMarkIcon,
} from '@heroicons/react/20/solid'
import JuiceProviders from '@/lib/juicebox/JuiceProviders'
import { GetMarkdown, SetMarkdown } from '@nance/nance-editor'
import { usePrivy } from '@privy-io/react-auth'
import { DEFAULT_CHAIN_V5, IPFS_GATEWAY } from 'const/config'
import { getUnixTime } from 'date-fns'
import { ethers } from 'ethers'
import { marked } from 'marked'
import dynamic from 'next/dynamic'
import Image from 'next/image'
import Link from 'next/link'
import { useRouter } from 'next/router'
import { useEffect, useState } from 'react'
import toast from 'react-hot-toast'
import { useLocalStorage } from 'react-use'
import {
  prepareContractCall,
  readContract,
  sendAndConfirmTransaction,
} from 'thirdweb'
import { getNFT } from 'thirdweb/extensions/erc721'
import { useActiveAccount } from 'thirdweb/react'
import useETHPrice from '@/lib/etherscan/useETHPrice'
import { pinBlobOrFile } from '@/lib/ipfs/pinBlobOrFile'
import toastStyle from '@/lib/marketplace/marketplace-utils/toastConfig'
import { renameFile } from '@/lib/utils/files'
import { getAttribute } from '@/lib/utils/nft'
import '@nance/nance-editor/lib/css/dark.css'
import '@nance/nance-editor/lib/css/editor.css'
import FormInput from '../forms/FormInput'
import FormYesNo from '../forms/FormYesNo'
import { Hat } from '../hats/Hat'
import ConditionCheckbox from '../layout/ConditionCheckbox'
import Container from '../layout/Container'
import FileInput from '../layout/FileInput'
import { LoadingSpinner } from '../layout/LoadingSpinner'
import StandardButton from '../layout/StandardButton'
import { Steps } from '../layout/Steps'
import { PrivyWeb3Button } from '../privy/PrivyWeb3Button'
import MissionTokenomicsExplainer from './MissionTokenomicsExplainer'
import MissionWideCard from './MissionWideCard'
import TeamRequirementModal from './TeamRequirementModal'

let getMarkdown: GetMarkdown
let setMarkdown: SetMarkdown

const NanceEditor = dynamic(
  async () => {
    getMarkdown = (await import('@nance/nance-editor')).getMarkdown
    setMarkdown = (await import('@nance/nance-editor')).setMarkdown
    return import('@nance/nance-editor').then((mod) => mod.NanceEditor)
  },
  {
    ssr: false,
    loading: () => <LoadingSpinner />,
  }
)

export type MissionData = {
  name: string
  description: string
  infoUri: string
  logoUri: string
  socialLink: string
  tagline: string
  fundingGoal: number | undefined
  youtubeLink: string
  token: {
    name: string
    symbol: string
    decimals: number
    tradeable: boolean
  }
}

export type MissionCache = MissionData & {
  timestamp: number
}

export type CreateMissionProps = {
  selectedChain: any
  missionCreatorContract: any
  hatsContract: any
  teamContract: any
  setStatus: (status: 'idle' | 'loggingIn' | 'apply' | 'create') => void
  userTeams: any
  userTeamsAsManager: any
}

const MISSION_DESCRIPTION_TEMPLATE = `
*Please delete all italicized instructions*

### Mission Overview
*The text below is a template to help you craft a compelling mission. Please consider these as suggestions for best practices for information to include, but customize it to your needs, eliminating what is not needed.*

### Introduce Your Mission
*Contributors are more likely to support your mission if they connect with its purpose and trust the team behind it. Consider including:*
- A concise summary of your mission and why it matters.
- A brief introduction to your team and any relevant experience.
- A compelling call to action explaining what supporters will help you achieve and what they get in return.

*Think of this as your mission's elevator pitch—make it clear and engaging! If you don't capture their attention in the first paragraph, they are unlikely to continue reading.*

### Mission Details (Optional but recommended)
*Use this section to provide additional context, such as:*
- The core objectives and impact of your mission.
- Technical aspects or unique innovations involved.
- Any personal stories or insights that add depth to your mission's purpose.
*If you were reading this for the first time, would you be excited to contribute?*

### Funding & Rewards
*What will supporters receive in return? Funding a mission is more engaging when contributors get something meaningful in return. Outline what backers can expect:*
- Governance Tokens – Enable participation in mission decisions.
- Mission Patches & Digital Collectibles – Unique digital memorabilia tied to the mission.
`

export function CreateMissionStage({
  id,
  account,
  stage,
  setStage,
  header,
  description,
  action,
  customButton,
  children,
}: any) {
  const { login } = usePrivy()
  return (
    <div className="w-full flex flex-col gap-4" id={id}>
      <h2 className="font-GoodTimes text-2xl md:text-4xl">{header}</h2>
      <p className="opacity-50">{description}</p>
      <div className="flex flex-col gap-5 w-full md:max-w-[600px] lg:max-w-[800px]">
        {children}
        <div className="mt-4 w-full flex flex-wrap gap-4 justify-between items-center">
          {stage > 0 ? (
            <StandardButton
              id="back-button"
              className="gradient-2 rounded-full"
              hoverEffect={false}
              onClick={() => setStage((prev: number) => prev - 1)}
            >
              <div className="flex items-center gap-2">
                <ArrowLeftCircleIcon width={20} height={20} />
                Go Back
              </div>
            </StandardButton>
          ) : (
            <div />
          )}
          {customButton ? (
            customButton
          ) : (
            <StandardButton
              id="continue-button"
              className="gradient-2 rounded-full"
              hoverEffect={false}
              onClick={async () => {
                const isTestEnv = process.env.NEXT_PUBLIC_TEST_ENV === 'true'
                if (!account && !isTestEnv) {
                  login()
                  return
                }
                if (isTestEnv) {
                  setStage((prev: number) => prev + 1)
                } else {
                  if ((await action()) === true) {
                    setStage((prev: number) => prev + 1)
                  }
                }
              }}
            >
              <div className="flex items-center gap-2">
                Continue
                <ArrowRightCircleIcon width={20} height={20} />
              </div>
            </StandardButton>
          )}
        </div>
      </div>
    </div>
  )
}

export default function CreateMission({
  selectedChain,
  missionCreatorContract,
  hatsContract,
  teamContract,
  setStatus,
  userTeams,
  userTeamsAsManager,
}: CreateMissionProps) {
  const router = useRouter()
  const account = useActiveAccount()
  const address = account?.address

  const [stage, setStage] = useState(0)

  const [selectedTeamId, setSelectedTeamId] = useState<number | undefined>(
    userTeamsAsManager?.[0]?.teamId
  )
  const [selectedTeamNFT, setSelectedTeamNFT] = useState<any>()
  const [missionCache, setMissionCache, clearMissionCache] =
    useLocalStorage<MissionCache>(`MissionCacheV1`)
  const [missionLogoUri, setMissionLogoUri] = useState<string | undefined>(
    missionCache?.logoUri
  )
  const [missionData, setMissionData] = useState<MissionData>({
    name: missionCache?.name || '',
    description: missionCache?.description || '',
    infoUri:
      getAttribute(selectedTeamNFT?.metadata?.attributes, 'website')?.value ||
      '',
    logoUri: missionCache?.logoUri || '',
    socialLink:
      getAttribute(selectedTeamNFT?.metadata?.attributes, 'communications') ||
      '',
    tagline: missionCache?.tagline || '',
    fundingGoal: missionCache?.fundingGoal || undefined,
    youtubeLink: missionCache?.youtubeLink || '',
    token: missionCache?.token || {
      name: '',
      symbol: '',
      decimals: 18,
      tradeable: false,
    },
  })

  const [formattedFundingGoal, setFormattedFundingGoal] = useState<string>(
    missionCache?.fundingGoal
      ? Number(missionCache.fundingGoal).toLocaleString()
      : ''
  )

  useEffect(() => {
    if (selectedTeamNFT) {
      setMissionData({
        ...missionData,
        infoUri:
          getAttribute(selectedTeamNFT?.metadata?.attributes, 'website')
            ?.value || '',
        socialLink:
          getAttribute(
            selectedTeamNFT?.metadata?.attributes,
            'communications'
          ) || '',
      })
    }
  }, [selectedTeamNFT])

  const [signingTx, setSigningTx] = useState(false)
  const [createdMission, setCreatedMission] = useState(false)
  const [fundingGoalIsLoading, setFundingGoalIsLoading] = useState(false)
  const [agreedToTerms, setAgreedToTerms] = useState(false)
  const [agreedToTokenNotSecurity, setAgreedToTokenNotSecurity] =
    useState(false)

  const [teamRequirementModalEnabled, setTeamRequirementModalEnabled] =
    useState(userTeamsAsManager && userTeamsAsManager?.[0] === undefined)

  useEffect(() => {
    if (userTeams)
      setTeamRequirementModalEnabled(userTeamsAsManager?.[0] === undefined)
  }, [userTeams, userTeamsAsManager])

  const {
    data: fundingGoalInETH,
    isLoading: fundingGoalInETHIsLoading,
    refresh: getFundingGoalInETH,
  } = useETHPrice(missionData?.fundingGoal || 0, 'USD_TO_ETH')

  const [isUploadingImage, setIsUploadingImage] = useState(false)

  async function createMission() {
    try {
      if (!account) throw new Error('Please connect your wallet')
      if (!missionLogoUri) throw new Error('Please upload a mission image')
      if (!fundingGoalInETH || +fundingGoalInETH <= 0)
        throw new Error('Funding goal is not set')
      const teamMultisig = await readContract({
        contract: teamContract,
        method: 'ownerOf' as string,
        params: [selectedTeamId],
      })

      const missionMetadataBlob = new Blob(
        [
          JSON.stringify({
            name: missionData.name,
            description: missionData.description,
            tagline: missionData.tagline,
            infoUri: missionData.infoUri,
            socialLink: missionData.socialLink,
            logoUri: missionLogoUri,
            youtubeLink: missionData.youtubeLink,
            tokens: [],
            payButton: 'Brew',
            payDisclosure: '',
            version: 4,
          }),
        ],
        {
          type: 'application/json',
        }
      )

      const { cid: missionMetadataIpfsHash } =
        await pinBlobOrFile(missionMetadataBlob)

      let transaction
      if (process.env.NEXT_PUBLIC_CHAIN === 'mainnet') {
        transaction = prepareContractCall({
          contract: missionCreatorContract,
          method: 'createMission' as string,
          params: [
            selectedTeamId,
            teamMultisig,
            missionMetadataIpfsHash,
            fundingGoalInETH * 1e18,
            missionData.token.tradeable,
            missionData?.token?.name,
            missionData?.token?.symbol,
            'MoonDAO Mission',
          ],
        })
      } else {
        transaction = prepareContractCall({
          contract: missionCreatorContract,
          method: 'createMission' as string,
          params: [
            selectedTeamId,
            teamMultisig,
            missionMetadataIpfsHash,
            fundingGoalInETH * 1e18,
            Math.floor(new Date().getTime() / 1000) + 10 * 60, // Expires in 300000 days
            missionData.token.tradeable,
            missionData?.token?.name,
            missionData?.token?.symbol,
            'MoonDAO Mission',
          ],
        })
      }

      setSigningTx(true)
      const receipt = await sendAndConfirmTransaction({
        transaction,
        account,
      })
      setSigningTx(false)
      // Define the event signature for the Transfer event
      const missionCreatedEventSignature = ethers.utils.id(
        'MissionCreated(uint256,uint256,uint256,address,uint256)'
      )
      // Find the log that matches the Transfer event signature
      const missionCreatedLog = receipt.logs.find(
        (log: any) => log.topics[0] === missionCreatedEventSignature
      )

      const missionId = ethers.BigNumber.from(
        missionCreatedLog?.topics[1]
      ).toString()

      setCreatedMission(true)

      if (receipt) {
        setTimeout(() => {
          toast.success('Mission created successfully!')
          setMissionData({
            name: '',
            description: '',
            infoUri: '',
            logoUri: '',
            socialLink: '',
            tagline: '',
            fundingGoal: undefined,
            youtubeLink: '',
            token: {
              name: '',
              symbol: '',
              decimals: 18,
              tradeable: false,
            },
          })
          setFormattedFundingGoal('')
          clearMissionCache()
          setCreatedMission(false)

          router.push(`/mission/${missionId}`)
        }, 30000)
      }
    } catch (err: any) {
      console.error(err)
      toast.error(err.message)
      setSigningTx(false)
      setCreatedMission(false)
    }
  }

  useEffect(() => {
    if (missionData || missionLogoUri) {
      setMissionCache({
        name: missionData.name,
        description: missionData.description,
        infoUri: missionData.infoUri,
        logoUri: missionLogoUri || missionData.logoUri,
        socialLink: missionData.socialLink,
        tagline: missionData.tagline,
        fundingGoal: missionData.fundingGoal,
        youtubeLink: missionData.youtubeLink,
        token: missionData.token,
        timestamp: getUnixTime(new Date()),
      })
    }
  }, [missionData, missionLogoUri])

  useEffect(() => {
    if (selectedTeamNFT) {
      setMissionData({
        ...missionData,
        socialLink:
          getAttribute(selectedTeamNFT?.metadata?.attributes, 'communications')
            ?.value || '',
        infoUri:
          getAttribute(selectedTeamNFT?.metadata?.attributes, 'website')
            ?.value || '',
      })
    }
  }, [selectedTeamNFT])

  useEffect(() => {
    async function getTeamNFT() {
      if (selectedTeamId === undefined) return
      try {
        const nft = await getNFT({
          contract: teamContract,
          tokenId: BigInt(selectedTeamId),
        })
        setSelectedTeamNFT(nft)
      } catch (err) {
        console.error(err)
        setSelectedTeamNFT(undefined)
      }
    }
    if (selectedTeamId !== undefined && teamContract) getTeamNFT()
    else setSelectedTeamNFT(undefined)
  }, [selectedTeamId, teamContract])

  useEffect(() => {
    if (userTeamsAsManager?.[0]) {
      setSelectedTeamId(userTeamsAsManager[0]?.teamId)
    } else {
      setSelectedTeamId(undefined)
    }
  }, [userTeamsAsManager, address])

  return (
    <Container containerwidth={true}>
      <div className="flex flex-col items-center w-full min-h-screen">
        <div className="w-full max-w-[1200px] flex flex-col items-center px-4 pb-4 md:px-8">
          <h1 className="font-GoodTimes text-[max(20px,3vw)] mt-[100px] mb-4 text-center">
            Launch A Mission
          </h1>

          <div className="w-full bg-darkest-cool p-8 rounded-[2vmax]">
            <div className="max-w-[800px] mx-auto">
              <div className="relative flex flex-col md:flex-row items-center p-2 pb-0 w-full">
                <button
                  className="absolute top-1 right-1"
                  onClick={() => setStatus('idle')}
                >
                  <XMarkIcon width={50} height={50} />
                </button>
                <Steps
                  className="mb-4 w-full"
                  steps={['Overview', 'Goals', 'Details', 'Confirm']}
                  currStep={stage}
                  lastStep={stage - 1}
                  setStep={setStage}
                />
              </div>
              {teamRequirementModalEnabled && (
                <TeamRequirementModal setStatus={setStatus} />
              )}
              {stage === 0 && (
                <CreateMissionStage
                  id="mission-overview-stage"
                  account={account}
                  stage={stage}
                  setStage={setStage}
                  description="Enter your mission concept from a high level, overview perspective. These fields should encapsulate the mission idea succinctly to potential backers and compel them to contribute.
"
                  action={() => {
                    if (
                      !userTeamsAsManager ||
                      userTeamsAsManager.length === 0
                    ) {
                      return toast.error(
                        'Please create a team or join one as a manager.',
                        {
                          style: toastStyle,
                        }
                      )
                    } else if (selectedTeamId === undefined) {
                      return toast.error('Please select a team.', {
                        style: toastStyle,
                      })
                    }
                    if (missionData.name.length === 0) {
                      return toast.error('Please enter a mission title.', {
                        style: toastStyle,
                      })
                    }
                    if (!missionLogoUri) {
                      return toast.error('Please upload a mission image.', {
                        style: toastStyle,
                      })
                    }
                    return true
                  }}
                >
                  <div className="flex justify-between">
                    {!userTeamsAsManager || userTeamsAsManager.length === 0 ? (
                      <StandardButton
                        className="gradient-2"
                        hoverEffect={false}
                        link="/team"
                      >
                        Create a Team
                      </StandardButton>
                    ) : (
                      <></>
                    )}
                  </div>
                  {userTeamsAsManager && userTeamsAsManager.length > 1 && (
                    <div>
                      <p>
                        You are a manager of multiple teams, please select one:
                      </p>
                      <div className="mt-4 grid grid-cols-1 md:grid-cols-2 gap-4 max-h-[500px] overflow-y-auto">
                        {!userTeamsAsManager ? (
                          Array.from({ length: 3 }).map((_, index) => (
                            <div
                              key={`team-${index}`}
                              className="w-[350px] h-[100px] bg-dark-cool p-2"
                            ></div>
                          ))
                        ) : userTeamsAsManager &&
                          userTeamsAsManager.length > 0 ? (
                          userTeamsAsManager.map((team: any) => (
                            <button
                              key={`team-${team.id}`}
                              className="bg-dark-cool p-2"
                              onClick={() => {
                                setSelectedTeamId(team.teamId)
                              }}
                            >
                              <Hat
                                hat={team}
                                selectedChain={selectedChain}
                                hatsContract={hatsContract}
                                teamContract={teamContract}
                                compact
                                isDisabled={true}
                              />
                            </button>
                          ))
                        ) : (
                          <p>You are not a manager of any teams</p>
                        )}
                      </div>
                    </div>
                  )}
                  {selectedTeamNFT && (
                    <p className="mt-4 font-GoodTimes">
                      {`Selected Team : `}
                      <Link
                        className="text-lg text-light-warm font-bold hover:underline"
                        href={`/team/${selectedTeamId}`}
                      >
                        {selectedTeamNFT?.metadata?.name}
                      </Link>
                    </p>
                  )}
                  <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                    <FormInput
                      id="mission-title"
                      label="Mission Title *"
                      placeholder="Enter a title for your mission"
                      value={missionData.name}
                      onChange={(e: any) =>
                        setMissionData({ ...missionData, name: e.target.value })
                      }
                      mode="dark"
                      maxLength={100}
                    />
                    <FormInput
                      id="mission-tagline"
                      label="Tagline"
                      placeholder="Enter a tagline for your mission"
                      value={missionData.tagline}
                      onChange={(e: any) =>
                        setMissionData({
                          ...missionData,
                          tagline: e.target.value,
                        })
                      }
                      mode="dark"
                      maxLength={100}
                    />

                    <FormInput
                      id="mission-website"
                      label="Website"
                      placeholder="Enter a website link"
                      value={missionData.infoUri}
                      onChange={(e: any) =>
                        setMissionData({
                          ...missionData,
                          infoUri: e.target.value,
                        })
                      }
                      mode="dark"
                      maxLength={500}
                    />
                    <FormInput
                      id="mission-social"
                      label="Social Link"
                      placeholder="Enter a social media link"
                      value={missionData.socialLink}
                      onChange={(e: any) =>
                        setMissionData({
                          ...missionData,
                          socialLink: e.target.value,
                        })
                      }
                      maxLength={500}
                      mode="dark"
                    />
                    <FormInput
                      id="mission-youtube"
                      label="YouTube Video Link"
                      placeholder="Enter a YouTube video link"
                      value={missionData.youtubeLink}
                      onChange={(e: any) =>
                        setMissionData({
                          ...missionData,
                          youtubeLink: e.target.value,
                        })
                      }
                      maxLength={500}
                      mode="dark"
                      tooltip="Add a YouTube video link to showcase your mission. This will be displayed on the mission page."
                    />
                  </div>
                  <FileInput
                    id="mission-image"
                    label="Mission Logo *"
                    uri={missionLogoUri}
                    setFile={async (file: File) => {
                      const renamedMissionImage = renameFile(
                        file,
                        `${missionData.name} Mission Image`
                      )
                      const { cid: missionLogoIpfsHash } =
                        await pinBlobOrFile(renamedMissionImage)
                      setMissionLogoUri(`${IPFS_GATEWAY}${missionLogoIpfsHash}`)
                    }}
                    dimensions={[1024, 1024]}
                    accept="image/png, image/jpeg, image/webp, image/gif, image/svg"
                    acceptText="Accepted file types: PNG, JPEG, WEBP, GIF, SVG"
                  />
                  <div>
                    {missionLogoUri && (
                      <Image
                        src={missionLogoUri}
                        alt="Mission Image"
                        width={200}
                        height={200}
                      />
                    )}
                  </div>
                </CreateMissionStage>
              )}
              {stage === 1 && (
                <CreateMissionStage
                  id="mission-goals-stage"
                  account={account}
                  stage={stage}
                  setStage={setStage}
                  action={() => {
                    if (
                      !missionData?.fundingGoal ||
                      missionData.fundingGoal <= 0
                    ) {
                      return toast.error('Please enter a funding goal.', {
                        style: toastStyle,
                      })
                    }
                    if (missionData.token.tradeable) {
                      if (missionData.token.name.trim().length === 0) {
                        return toast.error('Please enter a token name.', {
                          style: toastStyle,
                        })
                      }
                      if (missionData.token.symbol.trim().length === 0) {
                        return toast.error('Please enter a token symbol.', {
                          style: toastStyle,
                        })
                      }
                    }
                    return true
                  }}
                >
                  <div className="">
                    <h1 className="font-GoodTimes text-2xl">Tokenomics</h1>
                    <p className="my-2">
                      {
                        'When you launch a mission on the MoonDAO Launchpad, your fundraising structure follows a transparent, standardized model designed for long-term sustainability and success.'
                      }
                    </p>
                    <MissionTokenomicsExplainer />
                  </div>
                  <div className="mt-2 w-full grid grid-cols-1 lg:grid-cols-2 gap-4">
                    <FormInput
                      id="funding-goal-input"
                      label="Funding Goal (USD)"
                      placeholder="Enter a goal in USD"
                      value={formattedFundingGoal}
                      onChange={(e: any) => {
                        const value = e.target.value
                        // Remove any commas and dollar signs from the input for storage
                        const rawValue = value.replace(/[,$]/g, '')
                        setMissionData({
                          ...missionData,
                          fundingGoal: rawValue,
                        })
                        // Only format if there's actually a value
                        if (rawValue) {
                          const numValue = parseFloat(rawValue)
                          if (!isNaN(numValue)) {
                            setFormattedFundingGoal(
                              `$${numValue.toLocaleString()}`
                            )
                          }
                        } else {
                          setFormattedFundingGoal('') // Allow empty value
                        }
                      }}
                      disabled={false}
                      mode="dark"
                      tooltip="How much would you like to raise? Set something ambitious but achievable while accounting for the 20% set aside of the total raise. We will automatically convert the US Dollar amount into Ethereum, the native currency of the Launchpad."
                      maxLength={15}
                      extra={
                        <div className="w-full">
                          <p className="opacity-60">
                            {fundingGoalIsLoading ? (
                              <div className="flex">
                                <LoadingSpinner className="scale-75" />
                              </div>
                            ) : (
                              `${Number(fundingGoalInETH).toFixed(2)} ETH`
                            )}
                          </p>
                        </div>
                      }
                      onBlur={getFundingGoalInETH}
                    />
                  </div>

                  <div className="w-full grid grid-cols-1 lg:grid-cols-3 gap-4">
                    <FormYesNo
                      id="mission-token-toggle"
                      label="Create a Token"
                      value={missionData.token.tradeable}
                      onChange={(value: boolean) =>
                        setMissionData({
                          ...missionData,
                          token: { ...missionData.token, tradeable: value },
                        })
                      }
                      mode="dark"
                      tooltip="ERC-20 tokens are not created by default, but teams can choose to deploy one, if they would like a market tradeable token."
                    />

                    <div
                      className={`${
                        !missionData.token.tradeable && 'opacity-60'
                      }`}
                    >
                      <FormInput
                        id="mission-token-name"
                        label="Token Name"
                        placeholder="Enter a token name"
                        value={missionData.token.name}
                        onChange={(e: any) =>
                          setMissionData({
                            ...missionData,
                            token: {
                              ...missionData.token,
                              name: e.target.value,
                            },
                          })
                        }
                        maxLength={32}
                        disabled={!missionData.token.tradeable}
                        mode="dark"
                        tooltip="The name for your mission token (e.g.: Ethereum, Bitcoin)."
                      />
                    </div>
                    <div
                      className={`${
                        !missionData.token.tradeable && 'opacity-60'
                      }`}
                    >
                      <FormInput
                        id="mission-token-symbol"
                        label="Token Symbol"
                        placeholder="Enter a token symbol"
                        value={missionData.token.symbol}
                        onChange={(e: any) =>
                          setMissionData({
                            ...missionData,
                            token: {
                              ...missionData.token,
                              symbol: e.target.value.toUpperCase(),
                            },
                          })
                        }
                        maxLength={8}
                        disabled={!missionData.token.tradeable}
                        mode="dark"
                        tooltip="The symbol for your mission token (e.g.: ETH, BTC)."
                      />
                    </div>
                  </div>
                </CreateMissionStage>
              )}
              {stage === 2 && (
                <CreateMissionStage
                  id="mission-details-stage"
                  account={account}
                  stage={stage}
                  setStage={setStage}
                  action={async () => {
                    if (missionData.description.length < 10) {
                      return toast.error('Please enter a mission description', {
                        style: toastStyle,
                      })
                    }
                    const html = await marked(missionData.description)
                    setMissionData({ ...missionData, description: html })
                    return true
                  }}
                >
                  <StandardButton
                    className="gradient-2 rounded-full"
                    hoverEffect={false}
                    onClick={() => {
                      if (isUploadingImage) return
                      setMarkdown(MISSION_DESCRIPTION_TEMPLATE)
                    }}
                    disabled={isUploadingImage}
                  >
                    Restore Template
                  </StandardButton>
                  <div
                    id="mission-description-editor"
                    className="pt-2 rounded-b-[0px] bg-gradient-to-b from-[#0b0c21] from-50% to-transparent to-50% relative"
                  >
                    <NanceEditor
                      initialValue={
                        missionData.description.length === 0
                          ? MISSION_DESCRIPTION_TEMPLATE
                          : missionData.description
                      }
                      fileUploadExternal={async (val) => {
                        try {
                          setIsUploadingImage(true)
                          const res = await pinBlobOrFile(val)
                          return res.url
                        } finally {
                          setIsUploadingImage(false)
                        }
                      }}
                      darkMode={true}
                      onEditorChange={(m: string) => {
                        setMissionData({ ...missionData, description: m })
                      }}
                    />
                    {isUploadingImage && (
                      <div className="absolute inset-0 bg-black bg-opacity-75 flex flex-col items-center justify-center z-50 rounded-b-[0px]">
                        <img
                          src="/assets/MoonDAO-Loading-Animation.svg"
                          alt="Uploading..."
                          className="w-16 h-16 mb-4"
                        />
                        <p className="text-white text-lg font-medium">
                          Uploading image...
                        </p>
                        <p className="text-gray-300 text-sm mt-2">
                          Please wait, do not close this window
                        </p>
                      </div>
                    )}
                  </div>
                </CreateMissionStage>
              )}
              {stage === 3 && (
                <CreateMissionStage
                  id="mission-confirmation-stage"
                  account={account}
                  stage={stage}
                  setStage={setStage}
                  description="Please review your mission details:"
                  customButton={
                    <PrivyWeb3Button
                      id="launch-mission-button"
                      label={
                        <div className="flex items-center gap-2">
                          Launch Your Mission
                          <RocketLaunchIcon width={20} height={20} />
                        </div>
                      }
                      requiredChain={DEFAULT_CHAIN_V5}
                      className="gradient-2 rounded-full px-4 py-[7px]"
                      noPadding
                      isDisabled={
                        !agreedToTerms ||
                        (missionData.token.tradeable &&
                          !agreedToTokenNotSecurity) ||
                        signingTx ||
                        createdMission
                      }
                      action={createMission}
                    />
                  }
                >
                  <JuiceProviders
                    /** placeholder, not used since this
                     * project won't have an id yet **/
                    projectId={1}
                    selectedChain={selectedChain}
                  >
                    <MissionWideCard
                      mission={
                        {
                          metadata: {
                            name: missionData.name,
                            tagline: missionData.tagline,
                            description: missionData.description,
                            logoUri: missionData.logoUri,
                          },
                        } as any
                      }
                      token={missionData.token}
                      fundingGoal={fundingGoalInETH * 1e18 || 0}
                      subgraphData={{}}
                      missionImage={missionLogoUri}
                      showMore={true}
                      showMoreButton={false}
                      onlyGoalStat
                    />
                  </JuiceProviders>
                  <MissionTokenomicsExplainer />
                  <ConditionCheckbox
                    id="terms-checkbox"
                    label={
                      <p>
                        I HAVE READ AND ACCEPTED THE{' '}
                        <Link
                          className="text-blue-500 hover:underline"
                          href="https://docs.moondao.com/Legal/Website-Terms-and-Conditions"
                          target="_blank"
                          rel="noreferrer"
                        >
                          TERMS AND CONDITIONS
                        </Link>{' '}
                        AND THE{' '}
                        <Link
                          className="text-blue-500 hover:underline"
                          href="https://docs.moondao.com/Legal/Website-Privacy-Policy"
                          target="_blank"
                          rel="noreferrer"
                        >
                          PRIVACY POLICY
                        </Link>
                      </p>
                    }
                    agreedToCondition={agreedToTerms}
                    setAgreedToCondition={setAgreedToTerms}
                  />
                  {missionData.token.tradeable && (
                    <ConditionCheckbox
                      id="token-security-checkbox"
                      label={
                        <p>
                          I ACKNOWLEDGE THAT THIS TOKEN IS NOT A SECURITY,
                          CARRIES NO PROFIT EXPECTATION, AND I ACCEPT ALL{' '}
                          <Link
                            className="text-blue-500 hover:underline"
                            href="https://docs.moondao.com/Launchpad/Launchpad-Disclaimer"
                            target="_blank"
                            rel="noreferrer"
                          >
                            RISKS
                          </Link>{' '}
                          ASSOCIATED WITH PARTICIPATION IN THE MOONDAO
                          LAUNCHPAD.
                        </p>
                      }
                      agreedToCondition={agreedToTokenNotSecurity}
                      setAgreedToCondition={setAgreedToTokenNotSecurity}
                    />
                  )}
                  {signingTx && (
                    <p>{`Please sign the transaction in your wallet. After signing you will be redirected to your mission page. This might take a minute. If nothing happens please refresh your page.`}</p>
                  )}
                  {createdMission && (
                    <div className="px-2 flex justify-center items-center gap-4">
                      <LoadingSpinner />
                      <p>{`You will be redirected to the Mission page once your payment has been processed. Expect to wait about 30 seconds.`}</p>
                    </div>
                  )}
                </CreateMissionStage>
              )}
            </div>
          </div>
        </div>
      </div>
    </Container>
  )
}
