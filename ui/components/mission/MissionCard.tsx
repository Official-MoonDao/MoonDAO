import Link from 'next/link'
import { useEffect, useState } from 'react'
import { getNFT } from 'thirdweb/extensions/erc721'
import { MediaRenderer } from 'thirdweb/react'
import useJBProjectData from '@/lib/juicebox/useJBProjectData'
import { generatePrettyLink } from '@/lib/subscription/pretty-links'
import client from '@/lib/thirdweb/client'
import StandardCard from '../layout/StandardCard'
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

  function MissionFooter() {
    return (
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
    )
  }

  return (
    <StandardCard
      link={`/team/${
        teamNFT?.metadata?.name
          ? generatePrettyLink(teamNFT?.metadata?.name)
          : mission?.teamId
      }?mission=${mission?.id}`}
      title={metadata?.name}
      paragraph={metadata?.description}
      image={metadata?.logoUri}
      footer={<MissionFooter />}
    />
  )
}
