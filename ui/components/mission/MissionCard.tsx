import Link from 'next/link'
import { useEffect, useState } from 'react'
import { getNFT } from 'thirdweb/extensions/erc721'
import { MediaRenderer } from 'thirdweb/react'
import useJBProjectData from '@/lib/juicebox/useJBProjectData'
import { generatePrettyLink } from '@/lib/subscription/pretty-links'
import client from '@/lib/thirdweb/client'
import MissionStat from './MissionStat'

export type Mission = {
  id: number
  teamId: number
  projectId: number
  metadata: {
    name: string
    description: string
    infoUri: string
    logoUri: string
    twitter: string
    discord: string
    tokens: string[]
    version: number
    payButton: string
    payDisclosure: string
  }
}

export type MissionCardProps = {
  mission: Mission
  jbControllerContract?: any
  jbTokensContract?: any
  teamContract?: any
  compact?: boolean
}

export default function MissionCard({
  jbControllerContract,
  jbTokensContract,
  teamContract,
  mission,
  compact,
}: MissionCardProps) {
  const { metadata } = mission
  const [teamNFT, setTeamNFT] = useState<any>(null)

  const projectData = useJBProjectData(
    mission?.projectId,
    jbControllerContract,
    jbTokensContract
  )

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
    <Link
      id="mission-link"
      href={`/team/${
        teamNFT?.metadata?.name
          ? generatePrettyLink(teamNFT?.metadata?.name)
          : mission?.teamId
      }?mission=${mission?.id}`}
      passHref
    >
      <div
        id="mission-card"
        className={`p-4 flex flex-col items-center gap-4 bg-darkest-cool rounded-2xl`}
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
          <p id="mission-description">
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
        <div id="missions-stats" className="flex gap-4">
          <MissionStat
            label="VOLUME"
            value={'Ξ' + projectData?.subgraphData?.volume}
          />
          <MissionStat
            label="PAYMENTS"
            value={projectData?.subgraphData?.paymentsCount}
          />
        </div>
      </div>
    </Link>
  )
}
