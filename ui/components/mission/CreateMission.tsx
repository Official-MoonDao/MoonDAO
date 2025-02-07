import { XMarkIcon } from '@heroicons/react/20/solid'
import { DEFAULT_CHAIN_V5 } from 'const/config'
import { ethers } from 'ethers'
import Image from 'next/image'
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
import { useTeamWearer } from '@/lib/hats/useTeamWearer'
import { pinBlobOrFile } from '@/lib/ipfs/pinBlobOrFile'
import { renameFile } from '@/lib/utils/files'
import FormInput from '../forms/FormInput'
import { Hat } from '../hats/Hat'
import FileInput from '../layout/FileInput'
import StandardButton from '../layout/StandardButton'
import { PrivyWeb3Button } from '../privy/PrivyWeb3Button'

export type CreateMissionProps = {
  selectedChain: any
  missionCreatorContract: any
  hatsContract: any
  teamContract: any
  setIsCreatingMission: (isCreatingMission: boolean) => void
}

export default function CreateMission({
  selectedChain,
  missionCreatorContract,
  hatsContract,
  teamContract,
  setIsCreatingMission,
}: {
  selectedChain: any
  missionCreatorContract: any
  hatsContract: any
  teamContract: any
  setIsCreatingMission: (isCreatingMission: boolean) => void
}) {
  const router = useRouter()
  const account = useActiveAccount()
  const address = account?.address
  const [stage, setStage] = useState(0)

  const userTeams = useTeamWearer(teamContract, selectedChain, address)
  const [userTeamsAsManager, setUserTeamsAsManager] = useState<any>()

  const [selectedTeamId, setSelectedTeamId] = useState<number>()
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
    async function getUserTeamsAsManager() {
      setUserTeamsAsManager(undefined)
      const teamsAsManager = userTeams?.filter(async (team: any) => {
        if (!team.teamId) return false
        const isManager = await readContract({
          contract: teamContract,
          method: 'isManager' as string,
          params: [team.teamId, address],
        })
        return isManager
      })
      setUserTeamsAsManager(teamsAsManager)
    }
    if (teamContract && userTeams && address) getUserTeamsAsManager()
  }, [teamContract, userTeams, address])

  useEffect(() => {
    async function getTeamNFT() {
      if (!selectedTeamId) return
      const nft = await getNFT({
        contract: teamContract,
        tokenId: BigInt(selectedTeamId),
      })
      setSelectedTeamNFT(nft)
    }
    if (selectedTeamId) getTeamNFT()
  }, [selectedTeamId, teamContract])

  return (
    <div className="flex flex-col justify-center items-center bg-darkest-cool p-8">
      <button className="" onClick={() => setIsCreatingMission(false)}>
        <XMarkIcon className="w-6 h-6" />
      </button>
      {stage === 0 && (
        <div>
          <div className="flex justify-between">
            <p>Please select a team</p>
            <StandardButton
              className="gradient-2"
              hoverEffect={false}
              link="/team"
            >
              Create a Team
            </StandardButton>
          </div>
          <div className="mt-4 flex flex-col gap-2">
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
      {stage === 1 && (
        <div>
          <div>
            <Image
              src={missionImage ? URL.createObjectURL(missionImage) : ''}
              alt="Mission Image"
              width={200}
              height={200}
            />
          </div>
          <FileInput file={missionImage} setFile={setMissionImage} />
          <FormInput
            label="Name"
            value={metadata.name}
            onChange={(e: any) =>
              setMetadata({ ...metadata, name: e.target.value })
            }
          />
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
        </div>
      )}
      {stage === 2 && (
        <div>
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

                const { cid: missionMetadataIpfsHash } = await pinBlobOrFile(
                  missionMetadataBlob
                )

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
                    setIsCreatingMission(false)
                    router.push(`/mission/${missionId}`)
                  }, 15000)
                }
              } catch (err) {
                console.error(err)
              }
            }}
          />
        </div>
      )}
    </div>
  )
}
