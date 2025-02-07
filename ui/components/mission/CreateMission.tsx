import { XMarkIcon } from '@heroicons/react/20/solid'
import { DEFAULT_CHAIN_V5 } from 'const/config'
import { ethers } from 'ethers'
import Image from 'next/image'
import Link from 'next/link'
import { useRouter } from 'next/router'
import { useEffect, useState } from 'react'
import toast from 'react-hot-toast'
import {
  prepareContractCall,
  readContract,
  sendAndConfirmTransaction,
} from 'thirdweb'
import { getNFT } from 'thirdweb/extensions/erc721'
import { useActiveAccount } from 'thirdweb/react'
import { pinBlobOrFile } from '@/lib/ipfs/pinBlobOrFile'
import { renameFile } from '@/lib/utils/files'
import FormInput from '../forms/FormInput'
import { Hat } from '../hats/Hat'
import Container from '../layout/Container'
import ContentLayout from '../layout/ContentLayout'
import FileInput from '../layout/FileInput'
import { NoticeFooter } from '../layout/NoticeFooter'
import StandardButton from '../layout/StandardButton'
import { Steps } from '../layout/Steps'
import { PrivyWeb3Button } from '../privy/PrivyWeb3Button'

export type CreateMissionProps = {
  selectedChain: any
  missionCreatorContract: any
  hatsContract: any
  teamContract: any
  setStatus: (status: 'idle' | 'loggingIn' | 'apply' | 'create') => void
  userTeamsAsManager: any
}

export function Stage({ header, children }: any) {
  return (
    <div className="w-full flex flex-col gap-4 items-center">
      <h2 className="font-GoodTimes text-2xl opacity-50">{header}</h2>
      <div className="mt-4 w-[300px] md:w-[600px]">{children}</div>
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

  const [selectedTeamId, setSelectedTeamId] = useState<number>(
    userTeamsAsManager?.[0]?.teamId
  )
  const [selectedTeamNFT, setSelectedTeamNFT] = useState<any>()
  const [missionImage, setMissionImage] = useState<File>()
  const [metadata, setMetadata] = useState({
    name: '',
    description: '',
    infoUri: '',
    logoUri: '',
    twitter: '',
    discord: '',
    tokens: [],
  })

  useEffect(() => {
    async function getTeamNFT() {
      const nft = await getNFT({
        contract: teamContract,
        tokenId: BigInt(selectedTeamId),
      })
      setSelectedTeamNFT(nft)
    }
    if (selectedTeamId !== undefined && teamContract) getTeamNFT()
  }, [selectedTeamId, teamContract])

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
        <div className="flex flex-col justify-center items-center bg-darkest-cool p-8">
          <div className="relative flex p-2 pb-0 flex-row w-full justify-between max-w-[600px] items-start">
            <Steps
              className="mb-4 pl-5 md:pl-0 w-[300px] sm:w-[600px] lg:w-[800px] md:-ml-16"
              steps={['Overview', 'Details', 'Token', 'Confirm']}
              currStep={stage}
              lastStep={stage - 1}
              setStep={setStage}
            />
            <button
              className="absolute top-0 right-0"
              onClick={() => setStatus('idle')}
            >
              <XMarkIcon width={50} height={50} />
            </button>
          </div>
          {stage === 0 && (
            <Stage header="Mission Overview">
              <div className="flex justify-between">
                {!userTeamsAsManager ||
                  (userTeamsAsManager.length === 0 && (
                    <StandardButton
                      className="gradient-2"
                      hoverEffect={false}
                      link="/team"
                    >
                      Create a Team
                    </StandardButton>
                  ))}
              </div>
              {userTeamsAsManager && userTeamsAsManager.length > 1 && (
                <div>
                  <p>You are a manager of multiple teams, please select one</p>
                  <div className="mt-4 flex flex-col gap-2 max-h-[500px] overflow-y-auto">
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
                            setStage(1)
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
                <p>
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
                  value={metadata.name}
                  onChange={(e: any) =>
                    setMetadata({ ...metadata, name: e.target.value })
                  }
                />
                {/* <FormInput
                  label="Tagline"
                  value={metadata.tagline}
                  onChange={(e: any) =>
                    setMetadata({ ...metadata, tagline: e.target.value })
                  }
                /> */}
                <FileInput file={missionImage} setFile={setMissionImage} />
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
                    <div className="w-[200px] h-[200px] bg-dark-cool" />
                  )}
                </div>
                <StandardButton
                  className="gradient-2"
                  hoverEffect={false}
                  onClick={() => setStage(1)}
                >
                  Next
                </StandardButton>
              </div>
            </Stage>
          )}
          {stage === 1 && (
            <Stage header="Mission Details">
              <FormInput
                label="Description"
                value={metadata.description}
                onChange={(e: any) =>
                  setMetadata({ ...metadata, description: e.target.value })
                }
              />
              <FormInput
                label="Info URL"
                value={metadata.infoUri}
                onChange={(e: any) =>
                  setMetadata({ ...metadata, infoUri: e.target.value })
                }
              />
              <FormInput
                label="Twitter"
                value={metadata.twitter}
                onChange={(e: any) =>
                  setMetadata({ ...metadata, twitter: e.target.value })
                }
              />
              <FormInput
                label="Discord"
                value={metadata.discord}
                onChange={(e: any) =>
                  setMetadata({ ...metadata, discord: e.target.value })
                }
              />
              <StandardButton
                type="submit"
                className="gradient-2"
                hoverEffect={false}
                onClick={() => setStage(2)}
              >
                Next
              </StandardButton>
            </Stage>
          )}
          {stage === 2 && (
            <Stage header="Tokenomics">
              <p>Please config your token</p>
              <StandardButton
                type="submit"
                className="gradient-2"
                hoverEffect={false}
                onClick={() => setStage(3)}
              >
                Next
              </StandardButton>
            </Stage>
          )}
          {stage === 3 && (
            <Stage header="Mission Confirmation">
              <p>Please review your mission details</p>
              <Image
                src={missionImage ? URL.createObjectURL(missionImage) : ''}
                alt="Mission Image"
                width={200}
                height={200}
              />
              <p>{`Team: ${selectedTeamNFT?.metadata?.name}`}</p>
              <p>{`Name: ${metadata.name}`}</p>
              <p>{`Description: ${metadata.description}`}</p>
              <p>{`Info URL: ${metadata.infoUri}`}</p>
              <p>{`Twitter: ${metadata.twitter}`}</p>
              <p>{`Discord: ${metadata.discord}`}</p>
              <PrivyWeb3Button
                label="Confirm"
                requiredChain={DEFAULT_CHAIN_V5}
                className="gradient-2 rounded-lg"
                action={async () => {
                  try {
                    if (!account) throw new Error('Please connect your wallet')
                    if (!missionImage)
                      throw new Error('Please upload a mission image')

                    const teamMultisig = await readContract({
                      contract: teamContract,
                      method: 'ownerOf' as string,
                      params: [selectedTeamId],
                    })

                    const renamedMissionImage = renameFile(
                      missionImage,
                      `${metadata.name} Mission Image`
                    )

                    const { cid: missionLogoIpfsHash } = await pinBlobOrFile(
                      renamedMissionImage
                    )

                    const missionMetadataBlob = new Blob(
                      [
                        JSON.stringify({
                          name: metadata.name,
                          description: metadata.description,
                          infoUri: metadata.infoUri,
                          twitter: metadata.twitter,
                          discord: metadata.discord,
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
                        setStatus('idle')
                        router.push(`/mission/${missionId}`)
                      }, 15000)
                    }
                  } catch (err) {
                    console.error(err)
                  }
                }}
              />
            </Stage>
          )}
        </div>
      </ContentLayout>
    </Container>
  )
}
