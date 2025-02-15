import { XMarkIcon } from '@heroicons/react/20/solid'
import { GetMarkdown, SetMarkdown } from '@nance/nance-editor'
import { DEFAULT_CHAIN_V5 } from 'const/config'
import { getUnixTime } from 'date-fns'
import { ethers } from 'ethers'
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
import FormInput from '../forms/FormInput'
import { Hat } from '../hats/Hat'
import Checkbox from '../layout/Checkbox'
import Container from '../layout/Container'
import ContentLayout from '../layout/ContentLayout'
import FileInput from '../layout/FileInput'
import { LoadingSpinner } from '../layout/LoadingSpinner'
import { NoticeFooter } from '../layout/NoticeFooter'
import StandardButton from '../layout/StandardButton'
import StandardCard from '../layout/StandardCard'
import { Steps } from '../layout/Steps'
import { PrivyWeb3Button } from '../privy/PrivyWeb3Button'
import MissionStat from './MissionStat'

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
    deadline: number | undefined
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
    <div className="w-full flex flex-col gap-4 items-start">
      <h2 className="font-GoodTimes text-2xl opacity-50">{header}</h2>
      <p className="opacity-50">{description}</p>
      <div className="mt-4 w-[300px] md:w-[600px]">
        {children}
        <div className="mt-4 w-full flex justify-between">
          {stage > 0 ? (
            <StandardButton
              className="gradient-2 rounded-full"
              hoverEffect={false}
              onClick={() => setStage((prev: number) => prev - 1)}
            >
              Back
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
                      setStage((prev: number) => prev + 1)
                    }
                  : action
              }
            >
              Next
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
        description={<p className="text-lg">Subheader</p>}
        preFooter={<NoticeFooter />}
        mainPadding
        mode="compact"
        popOverEffect={false}
        isProfile
      >
        <div className="flex flex-col justify-center items-start bg-darkest-cool p-8 rounded-[2vmax]">
          <div className="relative flex p-2 pb-0 w-full justify-between max-w-[600px] items-start">
            <Steps
              className="mb-4 pl-5 md:pl-0 w-[300px] sm:w-[600px] lg:w-[800px] md:-ml-16"
              steps={['Overview', 'Details', 'Token', 'Confirm']}
              currStep={stage}
              lastStep={stage - 1}
              setStep={setStage}
            />
            <button
              className="absolute top-1 right-[-7.5%] md:right-0"
              onClick={() => setStatus('idle')}
            >
              <XMarkIcon width={50} height={50} />
            </button>
          </div>
          {stage === 0 && (
            <Stage
              stage={stage}
              setStage={setStage}
              header="Mission Overview"
              description="Enter your mission concept from a high level, overview perspective. These fields should encapsulate the mission idea succinctly to potential backers and compel them to contribute.
"
              action={() => {
                if (selectedTeamId === undefined) {
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
                setStage(1)
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
              <div className="mt-4 flex flex-col gap-4 max-w-[300px]">
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
                <FileInput
                  file={missionImage}
                  setFile={setMissionImage}
                  dimensions={[1024, 1024]}
                />
                <div>
                  {missionImage ? (
                    <Image
                      src={
                        missionImage ? URL.createObjectURL(missionImage) : ''
                      }
                      alt="Mission Image"
                      width={200}
                      height={200}
                    />
                  ) : (
                    <div className="h-[200px] w-[200px] bg-dark-cool" />
                  )}
                </div>
              </div>
            </Stage>
          )}
          {stage === 1 && (
            <Stage
              stage={stage}
              setStage={setStage}
              header="Mission Details"
              action={() => {
                if (missionData.description.length < 10) {
                  return toast.error('Please enter a mission description', {
                    style: toastStyle,
                  })
                }
                setStage(2)
              }}
            >
              <div className="pt-2 rounded-b-[0px] bg-gradient-to-b from-[#0b0c21] from-50% to-transparent to-50%">
                <NanceEditor
                  initialValue={missionData.description}
                  fileUploadExternal={async (val) => {
                    const res = await pinBlobOrFile(val)
                    return res.url
                  }}
                  darkMode={true}
                  onEditorChange={(m) => {
                    setMissionData({ ...missionData, description: m })
                  }}
                />
              </div>
              <FormInput
                label="Info URL"
                placeholder="Enter an info link"
                value={missionData.infoUri}
                onChange={(e: any) =>
                  setMissionData({ ...missionData, infoUri: e.target.value })
                }
                mode="dark"
              />
              <FormInput
                label="Twitter"
                placeholder="Enter a Twitter link"
                value={missionData.twitter}
                onChange={(e: any) =>
                  setMissionData({ ...missionData, twitter: e.target.value })
                }
                mode="dark"
              />
              <FormInput
                label="Discord"
                placeholder="Enter a Discord link"
                value={missionData.discord}
                onChange={(e: any) =>
                  setMissionData({ ...missionData, discord: e.target.value })
                }
                mode="dark"
              />
            </Stage>
          )}
          {stage === 2 && (
            <Stage
              stage={stage}
              setStage={setStage}
              header="Tokenomics"
              description="Configure your tokenomics"
              action={() => setStage(3)}
            >
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
              <div className="flex gap-4 items-center justify-between">
                <FormInput
                  label="Deadline"
                  placeholder="Enter a deadline"
                  value={missionData.token.deadline}
                  onChange={(e: any) =>
                    setMissionData({
                      ...missionData,
                      token: { ...missionData.token, deadline: e.target.value },
                    })
                  }
                  mode="dark"
                  tooltip="Enter a deadline for your mission"
                />

                <Checkbox
                  label="Unlimited"
                  checked={missionData.token.deadline === 0}
                  onChange={(e: any) =>
                    setMissionData({
                      ...missionData,
                      token: {
                        ...missionData.token,
                        deadline: e.target.checked ? 0 : undefined,
                      },
                    })
                  }
                  tooltip="Check this box if you'd like the deadline to be unlimited"
                />
              </div>
              <div className="flex gap-4 items-center justify-between">
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
                  mode="dark"
                  tooltip="Enter a funding goal for your mission"
                />

                <Checkbox
                  label="Unlimited"
                  checked={missionData.token.fundingGoal === 0}
                  onChange={(e: any) =>
                    setMissionData({
                      ...missionData,
                      token: {
                        ...missionData.token,
                        fundingGoal: e.target.checked ? 0 : undefined,
                      },
                    })
                  }
                  tooltip="Check this box if you'd like the funding goal to be unlimited"
                />
              </div>
              <Checkbox
                label="Tradeable"
                checked={missionData.token.tradeable}
                onChange={(e: any) =>
                  setMissionData({
                    ...missionData,
                    token: {
                      ...missionData.token,
                      tradeable: e.target.checked,
                    },
                  })
                }
                tooltip="Allow your mission's token to be tradeable"
              />
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
                  label="Confirm"
                  requiredChain={DEFAULT_CHAIN_V5}
                  className="gradient-2 rounded-full px-4"
                  noPadding
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
              {' '}
              <StandardCard
                title={missionData.name}
                paragraph={missionData.description}
                image={
                  missionImage
                    ? URL.createObjectURL(missionImage)
                    : missionData.logoUri
                }
                footer={
                  <div className="flex flex-col gap-2">
                    <hr className="my-4 opacity-50" />
                    <p className="font-GoodTimes text-lg opacity-50">
                      Metadata
                    </p>

                    <div className="w-full grid grid-cols-2 gap-4">
                      <MissionStat
                        label="Team"
                        value={selectedTeamNFT?.metadata?.name}
                      />
                      <MissionStat
                        label="Tagline"
                        value={missionData.tagline}
                      />
                      {missionData.discord && (
                        <MissionStat
                          label="Discord"
                          value={missionData.discord}
                        />
                      )}
                      {missionData.twitter && (
                        <MissionStat
                          label="Twitter"
                          value={missionData.twitter}
                        />
                      )}
                      {missionData.infoUri && (
                        <MissionStat
                          label="Info URL"
                          value={missionData.infoUri}
                        />
                      )}
                    </div>
                    <hr className="my-4 opacity-50" />
                    <p className="font-GoodTimes text-lg opacity-50">
                      Tokenomics
                    </p>

                    <div className="w-full grid grid-cols-2 gap-4">
                      <MissionStat
                        label="Token Name"
                        value={missionData.token.name || ''}
                      />
                      <MissionStat
                        label="Token Symbol"
                        value={missionData.token.symbol || ''}
                      />
                      <MissionStat
                        label="Deadline"
                        value={missionData.token.deadline}
                      />
                      <MissionStat
                        label="Funding Goal"
                        value={missionData.token.fundingGoal}
                      />
                    </div>
                  </div>
                }
                fullParagraph
              />
            </Stage>
          )}
        </div>
      </ContentLayout>
    </Container>
  )
}
