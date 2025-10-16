import CitizenTableABI from 'const/abis/CitizenTable.json'
import JobTableABI from 'const/abis/JobBoardTable.json'
import JBV5Controller from 'const/abis/JBV5Controller.json'
import MarketplaceTableABI from 'const/abis/MarketplaceTable.json'
import MissionTableABI from 'const/abis/MissionTable.json'
import ProjectTableABI from 'const/abis/ProjectTable.json'
import TeamTableABI from 'const/abis/TeamTable.json'
import {
  CITIZEN_TABLE_ADDRESSES,
  DEFAULT_CHAIN_V5,
  JBV5_CONTROLLER_ADDRESS,
  JOBS_TABLE_ADDRESSES,
  MARKETPLACE_TABLE_ADDRESSES,
  MISSION_TABLE_ADDRESSES,
  PROJECT_TABLE_ADDRESSES,
  TEAM_TABLE_ADDRESSES,
} from 'const/config'
import { BLOCKED_MISSIONS, BLOCKED_PROJECTS } from 'const/whitelist'
import Head from 'next/head'
import { useRouter } from 'next/router'
import { useContext, useEffect, useState } from 'react'
import { getContract, readContract } from 'thirdweb'
import CitizenContext from '@/lib/citizen/citizen-context'
import { getAUMHistory, getMooneyPrice } from '@/lib/coinstats'
import { getIPFSGateway } from '@/lib/ipfs/gateway'
import { getCitizensLocationData } from '@/lib/map'
import { getAllNetworkTransfers } from '@/lib/network/networkSubgraph'
import { Project } from '@/lib/project/useProjectData'
import queryTable from '@/lib/tableland/queryTable'
import { getChainSlug } from '@/lib/thirdweb/chain'
import { serverClient } from '@/lib/thirdweb/client'
import { getHistoricalRevenue } from '@/lib/treasury/revenue'
import Callout1 from '../components/home/Callout1'
import Callout2 from '../components/home/Callout2'
import Callout3 from '../components/home/Callout3'
import Feature from '../components/home/Feature'
import GovernanceSection from '../components/home/GovernanceSection'
import Hero from '../components/home/Hero'
import LaunchpadSection from '../components/home/LaunchpadSection'
import NetworkSection from '../components/home/NetworkSection'
import PartnerSection from '../components/home/PartnerSection'
import ProjectsSection from '../components/home/ProjectsSection'
import SpeakerSection from '../components/home/SpeakerSection'
import Timeline from '../components/home/Timeline'
import Container from '../components/layout/Container'
import { ExpandedFooter } from '../components/layout/ExpandedFooter'
import WebsiteHead from '../components/layout/Head'
import PageEnder from '../components/layout/PreFooter'
import SignedInDashboard from '@/components/home/SignedInDashboard'
import FeaturedMissionSection from '@/components/home/FeaturedMissionSection'

export default function Home({
  newestNewsletters,
  newestCitizens,
  newestListings,
  newestJobs,
  citizenSubgraphData,
  aumData,
  revenueData,
  mooneyPrice,
  filteredTeams,
  citizensLocationData,
  currentProjects,
  missions,
}: any) {
  const router = useRouter()
  const { citizen } = useContext(CitizenContext)

  if (citizen) {
    return (
      <>
        <WebsiteHead
          title="Welcome"
          description="MoonDAO is accelerating our multiplanetary future with an open platform to fund, collaborate, and compete on challenges that get us closer to a lunar settlement."
        />
        <SignedInDashboard
          newestNewsletters={newestNewsletters}
          newestCitizens={newestCitizens}
          newestListings={newestListings}
          newestJobs={newestJobs}
          citizenSubgraphData={citizenSubgraphData}
          aumData={aumData}
          revenueData={revenueData}
          mooneyPrice={mooneyPrice}
          filteredTeams={filteredTeams}
          citizensLocationData={citizensLocationData}
          currentProjects={currentProjects}
          missions={missions}
        />
      </>
    )
  }

  return (
    <Container>
      <Head>
        {/* Preload critical background images */}
        <link rel="preload" as="image" href="/assets/Lunar-Colony-Dark.webp" />
        <link rel="preload" as="image" href="/assets/mission-hero-bg.webp" />
      </Head>
      <WebsiteHead
        title="Welcome"
        description="MoonDAO is accelerating our multiplanetary future with an open platform to fund, collaborate, and compete on challenges that get us closer to a lunar settlement."
      />
      <div>
        <Hero />
        <FeaturedMissionSection missions={missions} />
        <Callout1 />
        <Callout2 />
        <Feature />
        <LaunchpadSection />
        <GovernanceSection />
        <ProjectsSection />
        <NetworkSection />
        <Timeline />
        <SpeakerSection />
        <Callout3 />
        <PartnerSection />
        <PageEnder />
        <ExpandedFooter
          hasCallToAction={false}
          darkBackground={true}
          isFullwidth={true}
        />
      </div>
    </Container>
  )
}

export async function getStaticProps() {
  let transferData: any = { citizenTransfers: [], teamTransfers: [] }
  let revenueData: any = {
    revenueHistory: [],
    currentRevenue: 0,
    citizenRevenue: 0,
    teamRevenue: 0,
    defiRevenue: 0,
    stakingRevenue: 0,
  }
  let citizenSubgraphData: any = { transfers: [], createdAt: Date.now() }
  let aumData = null
  let newestCitizens: any = []
  let newestListings: any = []
  let newestJobs: any = []
  let mooneyPrice = 0

  const getMooneyPriceData = async () => {
    try {
      const priceData = await getMooneyPrice()
      return priceData?.price || 0
    } catch (error) {
      console.error('MOONEY price fetch failed:', error)
      return 0
    }
  }
  let newestTeams: any = []
  let filteredTeams: any = []
  let currentProjects: Project[] = []
  let citizensLocationData: any = []
  let missions: any = []

  const contractOperations = async () => {
    try {
      const chain = DEFAULT_CHAIN_V5
      const chainSlug = getChainSlug(chain)

      const citizenTableContract = getContract({
        client: serverClient,
        address: CITIZEN_TABLE_ADDRESSES[chainSlug],
        chain: chain,
        abi: CitizenTableABI as any,
      })

      const marketplaceTableContract = getContract({
        client: serverClient,
        address: MARKETPLACE_TABLE_ADDRESSES[chainSlug],
        chain: chain,
        abi: MarketplaceTableABI as any,
      })

      const jobTableContract = getContract({
        client: serverClient,
        address: JOBS_TABLE_ADDRESSES[chainSlug],
        chain: chain,
        abi: JobTableABI as any,
      })

      const teamTableContract = getContract({
        client: serverClient,
        address: TEAM_TABLE_ADDRESSES[chainSlug],
        chain: chain,
        abi: TeamTableABI as any,
      })

      const projectTableContract = getContract({
        client: serverClient,
        address: PROJECT_TABLE_ADDRESSES[chainSlug],
        chain: chain,
        abi: ProjectTableABI as any,
      })

      const missionTableContract = getContract({
        client: serverClient,
        address: MISSION_TABLE_ADDRESSES[chainSlug],
        chain: chain,
        abi: MissionTableABI as any,
      })

      // Table queries
      const [
        citizenTableName,
        marketplaceTableName,
        jobTableName,
        teamTableName,
        projectTableName,
        missionTableName,
      ] = await Promise.all([
        readContract({
          contract: citizenTableContract,
          method: 'getTableName',
        }),
        readContract({
          contract: marketplaceTableContract,
          method: 'getTableName',
        }),
        readContract({ contract: jobTableContract, method: 'getTableName' }),
        readContract({ contract: teamTableContract, method: 'getTableName' }),
        readContract({
          contract: projectTableContract,
          method: 'getTableName',
        }),
        readContract({
          contract: missionTableContract,
          method: 'getTableName',
        }),
      ])

      const [citizens, listings, jobs, teams, projects, missionRows] =
        await Promise.all([
        queryTable(
          chain,
          `SELECT * FROM ${citizenTableName} ORDER BY id DESC LIMIT 10`
        ),
        queryTable(
          chain,
          `SELECT * FROM ${marketplaceTableName} WHERE (startTime = 0 OR startTime <= ${Math.floor(
            Date.now() / 1000
          )}) AND (endTime = 0 OR endTime >= ${Math.floor(
            Date.now() / 1000
          )}) ORDER BY id DESC LIMIT 10`
        ),
        queryTable(
          chain,
          `SELECT * FROM ${jobTableName} WHERE (endTime = 0 OR endTime >= ${Math.floor(
            Date.now() / 1000
          )}) ORDER BY id DESC LIMIT 10`
        ),
        queryTable(chain, `SELECT * FROM ${teamTableName} ORDER BY id DESC`),
        queryTable(chain, `SELECT * FROM ${projectTableName} ORDER BY id DESC`),
        queryTable(
          chain,
          `SELECT * FROM ${missionTableName} ORDER BY id DESC LIMIT 10`
        ),
      ])

      return { citizens, listings, jobs, teams, projects, missionRows }
    } catch (error) {
      console.error('Contract operations failed:', error)
      return {
        citizens: [],
        listings: [],
        jobs: [],
        teams: [],
        projects: [],
        missionRows: [],
      }
    }
  }

  const allTransferData = async () => {
    try {
      const transfers = await getAllNetworkTransfers()
      return transfers
    } catch (error) {
      console.error('Transfer data fetch failed:', error)
      return { citizenTransfers: [], teamTransfers: [] }
    }
  }

  const getAUMData = async () => {
    try {
      const aum = await getAUMHistory(365)
      return aum
    } catch (error) {
      console.error('AUM data fetch failed:', error)
      return null
    }
  }

  const [
    transferResult,
    contractResult,
    aumResult,
    mooneyPriceResult,
    citizensLocationResult,
  ] = await Promise.allSettled([
    allTransferData(),
    contractOperations(),
    getAUMData(),
    getMooneyPriceData(),
    getCitizensLocationData(),
  ])

  transferData =
    transferResult.status === 'fulfilled'
      ? transferResult.value
      : { citizenTransfers: [], teamTransfers: [] }
  aumData = aumResult.status === 'fulfilled' ? aumResult.value : null

  // Historical Revenue
  if (aumData?.defiData) {
    try {
      revenueData = await getHistoricalRevenue(aumData.defiData, 365)
    } catch (error) {
      console.error('Error getting historical revenue:', error)
    }
  }

  if (transferResult.status === 'fulfilled') {
    citizenSubgraphData = {
      transfers: transferData.citizenTransfers.map((transfer: any) => ({
        id: transfer.id,
        from: transfer.transactionHash,
        blockTimestamp: transfer.blockTimestamp,
      })),
      createdAt: Date.now(),
    }
  }

  if (contractResult.status === 'fulfilled') {
    const { citizens, listings, jobs, teams, projects, missionRows } =
      contractResult.value
    newestCitizens = citizens
    newestListings = listings
    newestJobs = jobs
    newestTeams = teams

    // Process projects data for home page display
    if (projects && projects.length > 0) {
      const activeProjects = []
      for (let i = 0; i < projects.length; i++) {
        if (projects[i]) {
          const project = projects[i] as any
          // Use the 'active' field to determine current projects, excluding blocked ones
          if (project.active && !BLOCKED_PROJECTS.has(project.id)) {
            activeProjects.push(project)
          }
        }
      }

      // Sort projects by eligible status
      activeProjects.sort((a, b) => {
        if (a.eligible === b.eligible) {
          return 0
        }
        return a.eligible ? 1 : -1
      })

      currentProjects = activeProjects.reverse() as Project[]
    }

    // Process missions data with real metadata like the launchpad does
    if (missionRows && missionRows.length > 0) {
      const filteredMissionRows = missionRows.filter((mission: any) => {
        return !BLOCKED_MISSIONS.has(mission.id) && mission && mission.id
      })

      const chain = DEFAULT_CHAIN_V5
      const jbV5ControllerContract = getContract({
        client: serverClient,
        address: JBV5_CONTROLLER_ADDRESS,
        abi: JBV5Controller.abi as any,
        chain: chain,
      })

      // Process missions with proper metadata fetching (limit to 3 for performance)
      try {
        const processedMissions = await Promise.all(
          filteredMissionRows
            .slice(0, 3)
            .map(async (missionRow: any, index: number) => {
              try {
                // Add delay between requests to avoid rate limiting
                if (index > 0) {
                  await new Promise((resolve) => setTimeout(resolve, 100))
                }

                if (!missionRow?.projectId) {
                  return {
                    id: missionRow?.id || `fallback-${index}`,
                    teamId: missionRow?.teamId || null,
                    projectId: null,
                    metadata: {
                      name: 'Mission Loading...',
                      description: 'Mission data is being loaded.',
                      image: '/assets/placeholder-mission.png',
                    },
                  }
                }

                const metadataURI = await readContract({
                  contract: jbV5ControllerContract,
                  method: 'uriOf' as string,
                  params: [missionRow.projectId],
                })

                const metadataRes = await fetch(getIPFSGateway(metadataURI))
                const metadata = await metadataRes.json()

                return {
                  id: missionRow.id,
                  teamId: missionRow.teamId,
                  projectId: missionRow.projectId,
                  fundingGoal: missionRow.fundingGoal || 0,
                  deadline: missionRow.deadline || null,
                  stage: missionRow.stage || 1,
                  metadata: metadata,
                }
              } catch (error) {
                console.warn(
                  `Failed to fetch mission ${missionRow?.id}:`,
                  error
                )
                return {
                  id: missionRow?.id || `fallback-${index}`,
                  teamId: missionRow?.teamId || null,
                  projectId: missionRow?.projectId || null,
                  fundingGoal: missionRow?.fundingGoal || 0,
                  deadline: missionRow?.deadline || null,
                  stage: missionRow?.stage || 1,
                  metadata: {
                    name: 'Mission Unavailable',
                    description: 'This mission is temporarily unavailable.',
                    image: '/assets/placeholder-mission.png',
                  },
                }
              }
            })
        )
        missions = processedMissions.filter((mission) => mission !== null)
      } catch (error) {
        console.error('Failed to process missions:', error)
        missions = []
      }
    }

    filteredTeams = teams || []
  }

  if (citizensLocationResult.status === 'fulfilled') {
    citizensLocationData = citizensLocationResult.value
  }

  if (mooneyPriceResult.status === 'fulfilled') {
    mooneyPrice = mooneyPriceResult.value
  }

  const newestNewsletters: any = []

  return {
    props: {
      newestNewsletters,
      newestCitizens,
      newestListings,
      newestJobs,
      citizenSubgraphData,
      aumData,
      revenueData,
      mooneyPrice,
      filteredTeams,
      citizensLocationData,
      currentProjects,
      missions,
    },
    revalidate: 300,
  }
}
