import { Mission } from 'archive/mission/[tokenId]'
import Link from 'next/link'
import { useEffect, useState } from 'react'
import { getNFT } from 'thirdweb/extensions/erc721'
import { MediaRenderer } from 'thirdweb/react'
import client from '@/lib/thirdweb/client'

export type MissionCardProps = {
  mission: Mission
  teamContract?: any
  compact?: boolean
}

export default function MissionCard({
  teamContract,
  mission,
  compact,
}: MissionCardProps) {
  const { metadata } = mission
  const [teamNFT, setTeamNFT] = useState<any>(null)

  useEffect(() => {
    async function getTeamNFT() {
      if (!mission?.teamId) return
      const nft = await getNFT({
        contract: teamContract,
        tokenId: BigInt(mission.teamId),
      })
      setTeamNFT(nft)
    }
    if (teamContract && mission?.teamId) getTeamNFT()
  }, [mission, teamContract])

  return (
    <Link href={`/mission/${mission?.id}`} passHref>
      <div
        className={`p-4 flex flex-col items-center gap-4 bg-darkest-cool rounded-2xl ${
          compact ? 'w-[100px] h-[150px]' : 'w-[250px] h-[300px]'
        }`}
      >
        <MediaRenderer
          client={client}
          src={
            metadata?.logoUri !== ''
              ? metadata?.logoUri
              : teamNFT?.metadata?.image
          }
          className="w-32 h-32 rounded-full"
        />
        <p className="text-lg font-bold">{metadata?.name}</p>
        {!compact && (
          <p>
            {metadata?.description && metadata?.description?.length > 50
              ? metadata?.description?.slice(0, 50) + '...'
              : metadata?.description}
          </p>
        )}
        {/* {!compact && (
          <div className="flex flex-col">
            <p>{`Mission #${mission?.id}`}</p>
            <p>{`JBX #${mission?.projectId}`}</p>
          </div>
        )} */}
      </div>
    </Link>
  )
}
