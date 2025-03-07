import useJBProjectData from '@/lib/juicebox/useJBProjectData'
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
  jbControllerContract?: any
  jbTokensContract?: any
}

export default function MissionCard({
  jbControllerContract,
  jbTokensContract,
  mission,
}: MissionCardProps) {
  const { metadata } = mission

  const projectData = useJBProjectData(
    mission?.projectId,
    jbControllerContract,
    jbTokensContract,
    metadata
  )

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
      link={`/mission/${mission?.id}`}
      title={metadata?.name}
      subheader={metadata?.tagline}
      image={metadata?.logoUri}
      footer={<MissionFooter />}
    />
  )
}
