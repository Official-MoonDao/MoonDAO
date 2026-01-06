import Link from 'next/link'
import { useState } from 'react'
import { useEffect } from 'react'
import { getNFT } from 'thirdweb/extensions/erc721'
import { getIPFSGateway } from '@/lib/ipfs/gateway'
import useJBProjectData from '@/lib/juicebox/useJBProjectData'
import useTotalFunding from '@/lib/juicebox/useTotalFunding'
import { generatePrettyLink } from '@/lib/subscription/pretty-links'
import Card from '@/components/layout/Card'
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
    youtubeLink: string
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

  const projectData = useJBProjectData({
    projectId: mission?.projectId,
    jbControllerContract,
    jbDirectoryContract,
    jbTokensContract,
    projectMetadata: mission?.metadata,
  })

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
    const totalFunding = useTotalFunding(mission?.projectId)
    return (
      <div id="missions-stats" className="flex gap-4">
        <MissionStat label="Total Raised" value={'Ξ' + Number(totalFunding || 0) / 1e18} />
        <MissionStat label="PAYMENTS" value={projectData?.subgraphData?.paymentsCount} />
      </div>
    )
  }

  return (
    <Card
      id="mission-card"
      variant="gradient"
      link={`/mission/${mission?.id}`}
      title={metadata?.name}
      subheader={
        <Link href={`/team/${generatePrettyLink(teamNFT?.metadata?.name || '')}`} passHref>
          <p id="team-name" className="text-light-warm hover:underline">
            {teamNFT?.metadata?.name}
          </p>
        </Link>
      }
      paragraph={metadata?.tagline}
      image={getIPFSGateway(metadata?.logoUri)}
      footer={<MissionFooter />}
    />
  )
}
