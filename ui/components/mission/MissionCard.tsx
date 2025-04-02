import Link from 'next/link'
import { useState } from 'react'
import { useEffect } from 'react'
import { getNFT } from 'thirdweb/extensions/erc721'
import useJBProjectData from '@/lib/juicebox/useJBProjectData'
import { generatePrettyLink } from '@/lib/subscription/pretty-links'
import StandardCard from '../layout/StandardCard'
import MissionStat from './MissionStat'

export type Mission = {
  id: number
  teamId: number
  projectId: number
  fundingGoal: number
  metadata: {
    name: string
    description: string
    tagline: string
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
  teamContract?: any
  jbControllerContract?: any
  jbDirectoryContract?: any
  jbTokensContract?: any
}

export default function MissionCard({
  teamContract,
  jbControllerContract,
  jbDirectoryContract,
  jbTokensContract,
  mission,
}: MissionCardProps) {
  const { metadata } = mission

  const projectData = useJBProjectData(
    mission?.projectId,
    jbControllerContract,
    jbDirectoryContract,
    jbTokensContract,
    metadata
  )

  const [teamNFT, setTeamNFT] = useState<any>(null)

  useEffect(() => {
    async function getTeamNFT() {
      const nft = await getNFT({
        contract: teamContract,
        tokenId: BigInt(mission?.teamId),
      })
      setTeamNFT(nft)
    }
    if (teamContract) getTeamNFT()
  }, [mission?.teamId, teamContract])

  function MissionFooter() {
    return (
      <div id="missions-stats" className="flex gap-4">
        <MissionStat
          label="VOLUME"
          value={'Ξ' + projectData?.subgraphData?.volume / 1e18}
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
      link={`/mission/${mission?.id}`}
      title={metadata?.name}
      subheader={
        <Link
          href={`/team/${generatePrettyLink(teamNFT?.metadata?.name || '')}`}
          passHref
        >
          <p className="text-light-warm hover:underline">
            {teamNFT?.metadata?.name}
          </p>
        </Link>
      }
      paragraph={metadata?.tagline}
      image={metadata?.logoUri}
      footer={<MissionFooter />}
    />
  )
}
