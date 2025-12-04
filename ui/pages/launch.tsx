import HatsABI from 'const/abis/Hats.json'
import JBV5Controller from 'const/abis/JBV5Controller.json'
import MissionCreator from 'const/abis/MissionCreator.json'
import TeamABI from 'const/abis/Team.json'
import {
  DEFAULT_CHAIN_V5,
  HATS_ADDRESS,
  JBV5_CONTROLLER_ADDRESS,
  MISSION_CREATOR_ADDRESSES,
  MISSION_TABLE_ADDRESSES,
  TEAM_ADDRESSES,
} from 'const/config'
import { GetStaticProps, GetStaticPropsResult } from 'next'
import { useContext } from 'react'
import { useActiveAccount } from 'thirdweb/react'
import { useTeamWearer } from '@/lib/hats/useTeamWearer'
import { fetchFeaturedMissionData } from '@/lib/launchpad/fetchFeaturedMission'
import { fetchMissions } from '@/lib/launchpad/fetchMissions'
import { FeaturedMissionData, Mission } from '@/lib/launchpad/types'
import { useLaunchStatus } from '@/lib/launchpad/useLaunchStatus'
import { useLaunchpadAccess } from '@/lib/launchpad/useLaunchpadAccess'
import { useTeamManagerCheck } from '@/lib/launchpad/useTeamManagerCheck'
import { getChainSlug } from '@/lib/thirdweb/chain'
import ChainContextV5 from '@/lib/thirdweb/chain-context-v5'
import useContract from '@/lib/thirdweb/hooks/useContract'
import FeaturedMissionSection from '@/components/home/FeaturedMissionSection'
import GetStartedToday from '@/components/launchpad/GetStartedToday'
import GoFurtherTogether from '@/components/launchpad/GoFurtherTogether'
import LaunchHero from '@/components/launchpad/LaunchHero'
import LaunchpadFAQ from '@/components/launchpad/LaunchpadFAQ'
import PowerOfDecentralization from '@/components/launchpad/PowerOfDecentralization'
import ProvenFinancingModel from '@/components/launchpad/ProvenFinancingModel'
import { ExpandedFooter } from '@/components/layout/ExpandedFooter'
import CreateMission from '@/components/mission/CreateMission'

type LaunchProps = {
  missions: Mission[]
  featuredMissionData: FeaturedMissionData | null
}

export default function Launch({ missions, featuredMissionData }: LaunchProps) {
  const account = useActiveAccount()
  const address = account?.address
  const { selectedChain } = useContext(ChainContextV5)
  const chainSlug = getChainSlug(selectedChain)

  const teamContract = useContract({
    address: TEAM_ADDRESSES[chainSlug],
    chain: selectedChain,
    abi: TeamABI as any,
  })

  const missionCreatorContract = useContract({
    address: MISSION_CREATOR_ADDRESSES[chainSlug],
    chain: selectedChain,
    abi: MissionCreator.abi as any,
  })

  const hatsContract = useContract({
    address: HATS_ADDRESS,
    chain: selectedChain,
    abi: HatsABI as any,
  })

  const { userTeams, isLoading: userTeamsLoading } = useTeamWearer(
    teamContract,
    selectedChain,
    address
  )

  const { userTeamsAsManager, isLoading: userTeamsAsManagerLoading } = useTeamManagerCheck(
    teamContract,
    userTeams,
    address,
    userTeamsLoading
  )

  const { hasAccess: citizenHasAccess } = useLaunchpadAccess(
    userTeamsAsManager,
    userTeamsAsManagerLoading
  )

  const { status, setStatus, handleCreateMission } = useLaunchStatus(userTeamsAsManager)

  if (status === 'create' && citizenHasAccess) {
    return (
      <CreateMission
        selectedChain={selectedChain}
        missionCreatorContract={missionCreatorContract}
        teamContract={teamContract}
        hatsContract={hatsContract}
        setStatus={setStatus}
        userTeams={userTeams}
        userTeamsAsManager={userTeamsAsManager}
        userTeamsAsManagerLoading={userTeamsLoading || userTeamsAsManagerLoading}
      />
    )
  }

  return (
    <>
      <LaunchHero citizenHasAccess={citizenHasAccess} onLaunchClick={handleCreateMission} />
      <FeaturedMissionSection missions={missions} featuredMissionData={featuredMissionData} />
      <GoFurtherTogether />
      <ProvenFinancingModel />
      <PowerOfDecentralization />
      <GetStartedToday citizenHasAccess={citizenHasAccess} onLaunchClick={handleCreateMission} />
      <LaunchpadFAQ />
      <ExpandedFooter
        callToActionTitle="Join the Network"
        callToActionBody="Be part of the space acceleration network and play a role in establishing a permanent human presence on the moon and beyond!"
        callToActionImage="/assets/SAN-logo-dark.svg"
        callToActionButtonText="Join the Network"
        callToActionButtonLink="/join"
        hasCallToAction={true}
      />
    </>
  )
}

export const getStaticProps: GetStaticProps = async (): Promise<
  GetStaticPropsResult<LaunchProps>
> => {
  try {
    const chain = DEFAULT_CHAIN_V5
    const chainSlug = getChainSlug(chain)

    const missions = await fetchMissions(
      chain,
      chainSlug,
      MISSION_TABLE_ADDRESSES[chainSlug],
      JBV5_CONTROLLER_ADDRESS
    )

    const featuredMissionData = await fetchFeaturedMissionData(
      missions,
      chain,
      chainSlug,
      JBV5_CONTROLLER_ADDRESS,
      JBV5Controller.abi as any
    )

    return {
      props: {
        missions,
        featuredMissionData,
      },
      revalidate: 60,
    }
  } catch (error) {
    console.error('Error in getStaticProps:', error)

    return {
      props: {
        missions: [
          {
            id: 'fallback-1',
            teamId: null,
            projectId: null,
            metadata: {
              name: 'MoonDAO Launchpad',
              description: 'Welcome to the MoonDAO Launchpad. Mission data is being loaded.',
              image: '/Original.png',
            },
          },
        ],
        featuredMissionData: null,
      },
      revalidate: 60,
    }
  }
}
