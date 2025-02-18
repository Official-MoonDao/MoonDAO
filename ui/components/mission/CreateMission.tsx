import {
  ArrowLeftCircleIcon,
  ArrowRightCircleIcon,
  RocketLaunchIcon,
  XMarkIcon,
} from '@heroicons/react/20/solid'
import { GetMarkdown, SetMarkdown } from '@nance/nance-editor'
import { DEFAULT_CHAIN_V5 } from 'const/config'
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
import { pinBlobOrFile } from '@/lib/ipfs/pinBlobOrFile'
import toastStyle from '@/lib/marketplace/marketplace-utils/toastConfig'
import { generatePrettyLink } from '@/lib/subscription/pretty-links'
import { renameFile } from '@/lib/utils/files'
import '@nance/nance-editor/lib/css/dark.css'
import '@nance/nance-editor/lib/css/editor.css'
import FormDate from '../forms/FormDate'
import FormInput from '../forms/FormInput'
import FormYesNo from '../forms/FormYesNo'
import { Hat } from '../hats/Hat'
import ConditionCheckbox from '../layout/ConditionCheckbox'
import Container from '../layout/Container'
import ContentLayout from '../layout/ContentLayout'
import FileInput from '../layout/FileInput'
import { LoadingSpinner } from '../layout/LoadingSpinner'
import { NoticeFooter } from '../layout/NoticeFooter'
import Point from '../layout/Point'
import StandardButton from '../layout/StandardButton'
import { Steps } from '../layout/Steps'
import { PrivyWeb3Button } from '../privy/PrivyWeb3Button'
import MissionWideCard from './MissionWideCard'

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
  twitter: string
  discord: string
  tagline: string
  token: {
    name: string
    symbol: string
    decimals: number
    deadline: string | undefined
    fundingGoal: number | undefined
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
  userTeamsAsManager: any
}

const MISSION_DESCRIPTION_TEMPLATE = `
# Your Mission Details
### Mission Overview
The text below is a template to help you craft a compelling mission. Please consider these as suggestions 
for best practices for information to include, but customize it to your needs, eliminating what is not needed.

### Introduce Your Mission
Contributors are more likely to support your mission if they connect with its purpose and trust the team 
behind it. Consider including:
- A concise summary of your mission and why it matters.
- A brief introduction to your team and any relevant experience.
- A compelling call to action explaining what supporters will help you achieve and what they get in return.

Think of this as your mission's elevator pitch—make it clear and engaging! If you don't capture their 
attention in the first paragraph, they are unlikely to continue reading.

### Mission Details (Optional but recommended)
Use this section to provide additional context, such as:
- The core objectives and impact of your mission.
- Technical aspects or unique innovations involved.
- Any personal stories or insights that add depth to your mission's purpose.
If you were reading this for the first time, would you be excited to contribute?

### Funding & Rewards
What will supporters receive in return? Funding a mission is more engaging when contributors get something meaningful in return. Outline what 
backers can expect:
- Governance Tokens – Enable participation in mission decisions.
- Mission Patches & Digital Collectibles – Unique digital memorabilia tied to the mission.
`

const TOKENOMICS_POINTS = [
  'Payouts : Unlimited withdrawals for up to 80% of the total raise. 7.5% allocated to MoonDAO to support the space ecosystem, 2.5% to the Juicebox protocol, and 10% to support token liquidity.',
  'Mission Tokens : Each mission generates its own token, with 1,000,000 tokens minted per 1 ETH. Distribution: 50% to contributors, 30% to the team (1-year cliff, 3-year stream), 10% to MoonDAO (1-year cliff, 3-year stream), and 10% locked for liquidity.',
  'ERC-20 Option : ERC-20 tokens are not created by default, but teams can choose to deploy one, if they would like a market tradeable token.',
  'Funding Cycles : Runs in 28-day cycles, locked by default for stability. Teams have three days to make changes before a cycle begins.',
  'Mission Ownership : The mission is fully and solely controlled by your team wallet.',
]

const ADDITIONAL_POINTS = [
  'Mission Ownership : The mission is fully controlled by your team wallet.',
  'Funding Cycles : Runs in 28-day cycles, locked by default for stability.',
  'Payouts : Unlimited withdrawals, with 10% allocated to MoonDAO to support the ecosystem.',
  'Mission Tokens : Each mission generates its own token, with 10% reserved for MoonDAO.',
  'ERC-20 Option : ERC-20 tokens are not created by default, but teams can choose to deploy one.',
]

export function Stage({
  stage,
  setStage,
  header,
  description,
  action,
  customButton,
  children,
}: any) {
  return (
    <div className="w-full flex flex-col gap-4">
      <h2 className="font-GoodTimes text-2xl md:text-4xl">{header}</h2>
      <p className="opacity-50">{description}</p>
      <div className="flex flex-col gap-5 w-full md:max-w-[600px] lg:max-w-[800px]">
        {children}
        <div className="mt-4 w-full flex flex-wrap gap-4 justify-between items-center">
          {stage > 0 ? (
            <StandardButton
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
              className="gradient-2 rounded-full"
              hoverEffect={false}
              onClick={
                process.env.NEXT_PUBLIC_ENV === 'dev'
                  ? () => {
                      action()
                      setStage((prev: number) => prev + 1)
                    }
                  : action
              }
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
  const [missionImage, setMissionImage] = useState<File | undefined>()
  const [missionData, setMissionData] = useState<MissionData>({
    name: missionCache?.name || '',
    description: missionCache?.description || '',
    infoUri: missionCache?.infoUri || '',
    logoUri: missionCache?.logoUri || '',
    twitter: missionCache?.twitter || '',
    discord: missionCache?.discord || '',
    tagline: missionCache?.tagline || '',
    token: missionCache?.token || {
      name: '',
      symbol: '',
      decimals: 18,
      deadline: undefined,
      fundingGoal: undefined,
      tradeable: false,
    },
  })
  const [hasDeadline, setHasDeadline] = useState(
    missionData.token.deadline !== undefined
  )
  const [hasFundingGoal, setHasFundingGoal] = useState(
    missionData.token.fundingGoal !== undefined
  )
  const [agreedToTerms, setAgreedToTerms] = useState(false)
  const [agreedToTokenNotSecurity, setAgreedToTokenNotSecurity] =
    useState(false)

  useEffect(() => {
    if (missionData) {
      setMissionCache({
        name: missionData.name,
        description: missionData.description,
        infoUri: missionData.infoUri,
        logoUri: missionData.logoUri,
        twitter: missionData.twitter,
        discord: missionData.discord,
        tagline: missionData.tagline,
        token: missionData.token as any,
        timestamp: getUnixTime(new Date()),
      })
    }
  }, [missionData])

  useEffect(() => {
    async function getTeamNFT() {
      if (selectedTeamId === undefined) return
      const nft = await getNFT({
        contract: teamContract,
        tokenId: BigInt(selectedTeamId),
      })
      setSelectedTeamNFT(nft)
    }
    if (selectedTeamId !== undefined && teamContract) getTeamNFT()
    else setSelectedTeamNFT(undefined)
  }, [selectedTeamId, teamContract])

  useEffect(() => {
    if (userTeamsAsManager) {
      setSelectedTeamId(userTeamsAsManager[0].teamId)
    } else {
      setSelectedTeamId(undefined)
    }
  }, [userTeamsAsManager, address])

  return (
    <Container>
      <ContentLayout
        header="Launch A Mission"
        headerSize="max(20px, 3vw)"
        description={
          <p className="">
            {
              'The Launchpad is an onchain fundraising platform that connects your space mission to the global cryptocurrency economy, providing transparent funding, community engagement, and real stakeholder participation to turn your vision into reality. For more information, check out '
            }
            <Link
              className="underline"
              href="https://docs.moondao.com"
              target="_blank"
              rel="noreferrer"
            >
              our documentation
            </Link>
            {'.'}
          </p>
        }
        preFooter={<NoticeFooter />}
        mainPadding
        mode="compact"
        popOverEffect={false}
        isProfile
      >
        <div className="flex flex-col justify-center items-start bg-darkest-cool p-8 rounded-[2vmax]">
          <div className="relative flex flex-col md:flex-row items-center md:items-start p-2 pb-0 w-full justify-between max-w-[600px] items-start">
            <button
              className="md:absolute top-1 right-[-7.5%] md:right-0"
              onClick={() => setStatus('idle')}
            >
              <XMarkIcon width={50} height={50} />
            </button>
            <Steps
              className="mb-4 pl-5 md:pl-0 w-full md:w-[600px] lg:w-[800px] md:-ml-16"
              steps={['Overview', 'Details', 'Goals', 'Confirm']}
              currStep={stage}
              lastStep={stage - 1}
              setStep={setStage}
            />
          </div>
          {stage === 0 && (
            <Stage
              stage={stage}
              setStage={setStage}
              header="Mission Overview"
              description="Enter your mission concept from a high level, overview perspective. These fields should encapsulate the mission idea succinctly to potential backers and compel them to contribute.
"
              action={() => {
                if (!userTeamsAsManager || userTeamsAsManager.length === 0) {
                  return toast.error(
                    'Please create a team or join one as a manager',
                    {
                      style: toastStyle,
                    }
                  )
                } else if (selectedTeamId === undefined) {
                  return toast.error('Please select a team', {
                    style: toastStyle,
                  })
                }
                if (missionData.name.length === 0) {
                  return toast.error('Please enter a mission title', {
                    style: toastStyle,
                  })
                }
                if (!missionImage) {
                  return toast.error('Please upload a mission image', {
                    style: toastStyle,
                  })
                }
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
                  <p>You are a manager of multiple teams, please select one</p>
                  <div className="mt-4 grid grid-cols-1 md:grid-cols-2 gap-4 max-h-[500px] overflow-y-auto">
                    {!userTeamsAsManager ? (
                      Array.from({ length: 3 }).map((_, index) => (
                        <div
                          key={`team-${index}`}
                          className="w-[350px] h-[100px] bg-dark-cool p-2"
                        ></div>
                      ))
                    ) : userTeamsAsManager && userTeamsAsManager.length > 0 ? (
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
                  label="Mission Title"
                  placeholder="Enter a title for your mission"
                  value={missionData.name}
                  onChange={(e: any) =>
                    setMissionData({ ...missionData, name: e.target.value })
                  }
                  mode="dark"
                />
                <FormInput
                  label="Tagline"
                  placeholder="Enter a tagline for your mission"
                  value={missionData.tagline}
                  onChange={(e: any) =>
                    setMissionData({ ...missionData, tagline: e.target.value })
                  }
                  mode="dark"
                />

                <FormInput
                  label="Website"
                  placeholder="Enter a website link"
                  value={missionData.infoUri}
                  onChange={(e: any) =>
                    setMissionData({ ...missionData, infoUri: e.target.value })
                  }
                  mode="dark"
                />
                <FormInput
                  label="Social Link"
                  placeholder="Enter a Twitter link"
                  value={missionData.twitter}
                  onChange={(e: any) =>
                    setMissionData({ ...missionData, twitter: e.target.value })
                  }
                  mode="dark"
                />
              </div>
              <FileInput
                file={missionImage}
                setFile={setMissionImage}
                dimensions={[1024, 1024]}
              />
              <div>
                {missionImage && (
                  <Image
                    src={missionImage ? URL.createObjectURL(missionImage) : ''}
                    alt="Mission Image"
                    width={200}
                    height={200}
                  />
                )}
              </div>
            </Stage>
          )}
          {stage === 1 && (
            <Stage
              stage={stage}
              setStage={setStage}
              header="Mission Details"
              action={async () => {
                if (missionData.description.length < 10) {
                  return toast.error('Please enter a mission description', {
                    style: toastStyle,
                  })
                }
                const html = await marked(missionData.description)
                setMissionData({ ...missionData, description: html })
              }}
            >
              <StandardButton
                className="gradient-2 rounded-full"
                hoverEffect={false}
                onClick={() => {
                  setMarkdown(MISSION_DESCRIPTION_TEMPLATE)
                }}
              >
                Restore Template
              </StandardButton>
              <div className="pt-2 rounded-b-[0px] bg-gradient-to-b from-[#0b0c21] from-50% to-transparent to-50%">
                <NanceEditor
                  initialValue={
                    missionData.description.length === 0
                      ? MISSION_DESCRIPTION_TEMPLATE
                      : missionData.description
                  }
                  fileUploadExternal={async (val) => {
                    const res = await pinBlobOrFile(val)
                    return res.url
                  }}
                  darkMode={true}
                  onEditorChange={(m: string) => {
                    setMissionData({ ...missionData, description: m })
                  }}
                />
              </div>
            </Stage>
          )}
          {stage === 2 && (
            <Stage stage={stage} setStage={setStage} action={() => {}}>
              <div className="w-full grid grid-cols-1 lg:grid-cols-2 gap-4">
                <FormInput
                  label="Token Name"
                  placeholder="Enter a token name"
                  value={missionData.token.name}
                  onChange={(e: any) =>
                    setMissionData({
                      ...missionData,
                      token: { ...missionData.token, name: e.target.value },
                    })
                  }
                  mode="dark"
                />
                <FormInput
                  label="Token Symbol"
                  placeholder="Enter a token symbol"
                  value={missionData.token.symbol}
                  onChange={(e: any) =>
                    setMissionData({
                      ...missionData,
                      token: { ...missionData.token, symbol: e.target.value },
                    })
                  }
                  mode="dark"
                />
                <FormYesNo
                  label="Set A Fundraising Deadline"
                  value={hasDeadline}
                  onChange={(value: boolean) => {
                    setHasDeadline(value)
                    if (!value) {
                      setMissionData({
                        ...missionData,
                        token: { ...missionData.token, deadline: '' },
                      })
                    }
                  }}
                  mode="dark"
                  tooltip="Set a specific date to end fundraising, or keep it open-ended for a goal-based raise."
                />
                <div
                  className={`w-full ${
                    hasDeadline ? 'opacity-100' : 'opacity-30'
                  }`}
                >
                  <FormDate
                    label="Deadline"
                    value={missionData.token.deadline || ''}
                    onChange={(value: string) => {
                      setMissionData({
                        ...missionData,
                        token: {
                          ...missionData.token,
                          deadline: value,
                        },
                      })
                    }}
                    min={new Date()}
                    disabled={!hasDeadline}
                    mode="dark"
                  />
                </div>
                <FormYesNo
                  label="Define a Funding Goal"
                  value={hasFundingGoal}
                  onChange={(value: boolean) => {
                    setHasFundingGoal(value)
                    if (!value) {
                      setMissionData({
                        ...missionData,
                        token: { ...missionData.token, fundingGoal: 0 },
                      })
                    }
                  }}
                  mode="dark"
                  tooltip="Set a target amount for your mission, or allow unlimited contributions for continuous fundraising."
                />
                <div
                  className={`w-full ${
                    hasFundingGoal ? 'opacity-100' : 'opacity-30'
                  }`}
                >
                  <FormInput
                    label="Funding Goal"
                    placeholder="Enter a funding goal"
                    value={missionData.token.fundingGoal}
                    onChange={(e: any) =>
                      setMissionData({
                        ...missionData,
                        token: {
                          ...missionData.token,
                          fundingGoal: e.target.value,
                        },
                      })
                    }
                    disabled={!hasFundingGoal}
                    mode="dark"
                  />
                </div>
              </div>
              <FormYesNo
                label="Create A Mission Token"
                value={missionData.token.tradeable}
                onChange={(value: boolean) =>
                  setMissionData({
                    ...missionData,
                    token: { ...missionData.token, tradeable: value },
                  })
                }
                mode="dark"
              />
              <div className="font-sm">
                <h1 className="font-GoodTimes text-2xl">Tokenomics</h1>
                <p className="mt-2">
                  {
                    'When you deploy your mission on the MoonDAO Launch Pad, your funding structure will follow a transparent standardized model designed for success and long-term sustainability.'
                  }
                </p>
                {TOKENOMICS_POINTS.map((p: string, i: number) => (
                  <Point key={`tokenomics-point-${i}`} point={p} />
                ))}
              </div>
            </Stage>
          )}
          {stage === 3 && (
            <Stage
              stage={stage}
              setStage={setStage}
              header="Mission Confirmation"
              description="Please review your mission details"
              customButton={
                <PrivyWeb3Button
                  label={
                    <div className="flex items-center gap-2">
                      Launch Your Mission
                      <RocketLaunchIcon width={20} height={20} />
                    </div>
                  }
                  requiredChain={DEFAULT_CHAIN_V5}
                  className="gradient-2 rounded-full px-4"
                  isDisabled={
                    !agreedToTerms ||
                    (missionData.token.tradeable && !agreedToTokenNotSecurity)
                  }
                  action={async () => {
                    try {
                      if (!account)
                        throw new Error('Please connect your wallet')
                      if (!missionImage)
                        throw new Error('Please upload a mission image')

                      const teamMultisig = await readContract({
                        contract: teamContract,
                        method: 'ownerOf' as string,
                        params: [selectedTeamId],
                      })

                      const renamedMissionImage = renameFile(
                        missionImage,
                        `${missionData.name} Mission Image`
                      )

                      const { cid: missionLogoIpfsHash } = await pinBlobOrFile(
                        renamedMissionImage
                      )

                      const missionMetadataBlob = new Blob(
                        [
                          JSON.stringify({
                            name: missionData.name,
                            description: missionData.description,
                            infoUri: missionData.infoUri,
                            twitter: missionData.twitter,
                            discord: missionData.discord,
                            logoUri: `https://ipfs.io/ipfs/${missionLogoIpfsHash}`,
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

                      const transaction = prepareContractCall({
                        contract: missionCreatorContract,
                        method: 'createMission' as string,
                        params: [
                          selectedTeamId,
                          teamMultisig,
                          missionMetadataIpfsHash,
                          'MoonDAO Mission',
                        ],
                      })

                      const receipt = await sendAndConfirmTransaction({
                        transaction,
                        account,
                      })

                      // Define the event signature for the Transfer event
                      const transferEventSignature = ethers.utils.id(
                        'MissionCreated(uint256,uint256,uint256)'
                      )
                      // Find the log that matches the Transfer event signature
                      const transferLog = receipt.logs.find(
                        (log: any) => log.topics[0] === transferEventSignature
                      )

                      const missionId = ethers.BigNumber.from(
                        transferLog?.topics[1]
                      ).toString()

                      if (receipt) {
                        setTimeout(() => {
                          toast.success('Mission created successfully')
                          clearMissionCache()
                          setStatus('idle')
                          router.push(
                            `/team/${generatePrettyLink(
                              selectedTeamNFT?.metadata?.name
                            )}?mission=${missionId}`
                          )
                        }, 15000)
                      }
                    } catch (err) {
                      console.error(err)
                    }
                  }}
                />
              }
            >
              <MissionWideCard
                name={missionData.name}
                tagline={missionData.tagline}
                deadline={missionData.token.deadline || 'None'}
                fundingGoal={missionData.token.fundingGoal}
                tradeable={missionData.token.tradeable}
                description={missionData.description}
                logoUri={missionData.logoUri}
                missionImage={missionImage}
              />
              <div id="additional-details">
                <h1 className="font-GoodTimes text-2xl">Additional Details</h1>
                <div className="mt-3">
                  {ADDITIONAL_POINTS.map((p: string, i: number) => (
                    <Point key={`additional-point-${i}`} point={p} />
                  ))}
                </div>
              </div>
              <ConditionCheckbox
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
                  label={'I AGREE THAT THIS TOKEN IS NOT A SECURITY, ETC...'}
                  agreedToCondition={agreedToTokenNotSecurity}
                  setAgreedToCondition={setAgreedToTokenNotSecurity}
                />
              )}
            </Stage>
          )}
        </div>
      </ContentLayout>
    </Container>
  )
}
