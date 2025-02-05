import { useEffect, useState } from 'react'
import { getNFT } from 'thirdweb/extensions/erc721'
import { MediaRenderer } from 'thirdweb/react'
import client from '@/lib/thirdweb/client'

export type MissionRow = {
  id: number
  projectId: number
  teamId: number
}

export type MissionCardProps = {
  mission: MissionRow
  teamContract: any
}

export default function MissionCard({
  mission,
  teamContract,
}: MissionCardProps) {
  const [teamNFT, setTeamNFT] = useState<any>(null)

  useEffect(() => {
    async function getTeamNFT() {
      const nft = await getNFT({
        contract: teamContract,
        tokenId: BigInt(mission.teamId),
      })
      setTeamNFT(nft)
    }
    if (teamContract && mission) getTeamNFT()
  }, [mission, teamContract])
  return (
    <div className="p-4 w-[150px] h-[200px] flex flex-col items-center gap-4 bg-darkest-cool rounded-2xl">
      <MediaRenderer
        client={client}
        src={teamNFT?.metadata?.image}
        className="w-16 h-16 rounded-full"
      />
      <p>{teamNFT?.metadata?.name}</p>
      <p>{`Mission #${mission.projectId}`}</p>
    </div>
  )
}
