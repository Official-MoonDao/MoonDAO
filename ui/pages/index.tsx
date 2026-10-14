import { DEFAULT_CHAIN_V5, JBV5_CONTROLLER_ADDRESS, MISSION_TABLE_ADDRESSES, FEATURED_MISSION } from 'const/config'
import { BLOCKED_MISSIONS } from 'const/whitelist'
import dynamic from 'next/dynamic'
import ProjectTableABI from 'const/abis/ProjectTable.json'
import Head from 'next/head'
import { useRouter } from 'next/router'
import { useContext, useEffect } from 'react'
import { getContract, readContract } from 'thirdweb'
import CitizenContext from '@/lib/citizen/citizen-context'
import { getIPFSGateway } from '@/lib/ipfs/gateway'
import queryTable from '@/lib/tableland/queryTable'
import { getChainSlug } from '@/lib/thirdweb/chain'
import { serverClient } from '@/lib/thirdweb/serverClient'
import LandingHero from '../components/home/landing/LandingHero'
import Container from '../components/layout/Container'
import { ExpandedFooter } from '../components/layout/ExpandedFooter'
import WebsiteHead from '../components/layout/Head'
import { MissionSkeleton, SectionSkeleton } from '../components/layout/SkeletonLoader'

const FeaturedMissionSection = dynamic(() => import('@/components/home/FeaturedMissionSection'), {
  loading: () => <MissionSkeleton />,
  ssr: false,
})

const MissionStory = dynamic(() => import('../components/home/landing/MissionStory'), {
  loading: () => <SectionSkeleton />,
})

const PillarsSection = dynamic(() => import('../components/home/landing/PillarsSection'), {
  loading: () => <SectionSkeleton />,
})

const GovernanceSection = dynamic(() => import('../components/home/landing/GovernanceSection'), {
  loading: () => <SectionSkeleton />,
})

const LaunchpadShowcase = dynamic(() => import('../components/home/landing/LaunchpadShowcase'), {
  loading: () => <SectionSkeleton />,
})

const JourneyTimeline = dynamic(() => import('../components/home/landing/JourneyTimeline'), {
  loading: () => <SectionSkeleton />,
})

const VoicesSection = dynamic(() => import('../components/home/landing/VoicesSection'), {
  loading: () => <SectionSkeleton />,
})

const PartnersMarquee = dynamic(() => import('../components/home/landing/PartnersMarquee'), {
  loading: () => <SectionSkeleton minHeight="min-h-[300px]" />,
})

const FinalCTA = dynamic(() => import('../components/home/landing/FinalCTA'), {
  loading: () => <SectionSkeleton />,
})

export default function Home({ missions, featuredMissionData }: any) {
  const router = useRouter()
  const { citizen, isLoading } = useContext(CitizenContext)

  // Redirect citizens to dashboard
  useEffect(() => {
    if (!isLoading && citizen) {
      router.push('/dashboard')
    }
  }, [citizen, isLoading, router])

  // Show nothing while checking/redirecting
  if (citizen) {
    return null
  }

  return (
    <Container>
      <Head>
        {/* Preload critical background images */}
        <link rel="preload" as="image" href="/assets/Lunar-Colony-Dark.webp" />
      </Head>
      <WebsiteHead
        title="Welcome"
        description="MoonDAO is accelerating our multiplanetary future with an open platform to fund, collaborate, and compete on challenges that get us closer to a lunar settlement."
      />
      <div className="bg-[#010208]">
        <LandingHero />
        {FEATURED_MISSION && (
          <FeaturedMissionSection missions={missions} featuredMissionData={featuredMissionData} />
        )}
        <MissionStory />
        <PillarsSection />
        <GovernanceSection />
        <LaunchpadShowcase />
        <JourneyTimeline />
        <VoicesSection />
        <PartnersMarquee />
        <FinalCTA />
        <ExpandedFooter hasCallToAction={false} darkBackground={true} isFullwidth={true} />
      </div>
    </Container>
  )
}

export async function getStaticProps() {
  // Lightweight homepage - only fetch mission data
  // Import ABIs only on server-side
  const JBV5Controller = (await import('const/abis/JBV5Controller.json')).default
  const MissionTableABI = (await import('const/abis/MissionTable.json')).default

  let missions: any = []
  let featuredMissionData: any = null

  try {
    const chain = DEFAULT_CHAIN_V5
    const chainSlug = getChainSlug(chain)

    const missionTableContract = getContract({
      client: serverClient,
      address: MISSION_TABLE_ADDRESSES[chainSlug],
      chain: chain,
      abi: MissionTableABI as any,
    })

    const missionTableName = await readContract({
      contract: missionTableContract,
      method: 'getTableName',
    })

    const missionRows = await queryTable(
      chain,
      `SELECT * FROM ${missionTableName} ORDER BY id DESC LIMIT 1`
    )

    // Process missions data
    if (missionRows && missionRows.length > 0) {
      const filteredMissionRows = missionRows.filter((mission: any) => {
        return !BLOCKED_MISSIONS.has(mission.id) && mission && mission.id
      })

      // Only fetch metadata for the first mission
      if (filteredMissionRows.length > 0 && filteredMissionRows[0]?.projectId) {
        try {
          const jbV5ControllerContract = getContract({
            client: serverClient,
            address: JBV5_CONTROLLER_ADDRESS,
            abi: JBV5Controller.abi as any,
            chain: chain,
          })

          const metadataURI = await readContract({
            contract: jbV5ControllerContract,
            method: 'uriOf' as string,
            params: [filteredMissionRows[0].projectId],
          })

          const metadataRes = await fetch(getIPFSGateway(metadataURI))
          const metadata = await metadataRes.json()

          missions = [
            {
              id: filteredMissionRows[0].id,
              teamId: filteredMissionRows[0].teamId,
              projectId: filteredMissionRows[0].projectId,
              fundingGoal: filteredMissionRows[0].fundingGoal || 0,
              deadline: filteredMissionRows[0].deadline || null,
              stage: filteredMissionRows[0].stage || 1,
              metadata: metadata,
            },
          ]

          // Pass basic featured mission data - let client fetch details
          featuredMissionData = {
            mission: missions[0],
            projectMetadata: metadata,
          }
        } catch (error) {
          console.warn('Failed to fetch featured mission metadata:', error)
          // Fallback to basic data without metadata
          missions = [
            {
              id: filteredMissionRows[0].id,
              teamId: filteredMissionRows[0].teamId,
              projectId: filteredMissionRows[0].projectId,
              fundingGoal: filteredMissionRows[0].fundingGoal || 0,
              deadline: filteredMissionRows[0].deadline || null,
              stage: filteredMissionRows[0].stage || 1,
              metadata: {
                name: 'Featured Mission',
                description: 'Loading mission details...',
                image: '/assets/placeholder-mission.png',
              },
            },
          ]
        }
      }
    }
  } catch (error) {
    console.error('Mission data fetch failed:', error)
  }

  return {
    props: {
      missions,
      featuredMissionData,
    },
    revalidate: 300, // 5 minutes
  }
}
