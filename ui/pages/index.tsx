import {
  CITIZEN_TABLE_ADDRESSES,
  DEFAULT_CHAIN_V5,
  JOBS_TABLE_ADDRESSES,
  MARKETPLACE_TABLE_ADDRESSES,
  PROJECT_TABLE_ADDRESSES,
  TEAM_TABLE_ADDRESSES,
} from 'const/config'
import { blockedProjects } from 'const/whitelist'
import { useRouter } from 'next/router'
import { useContext, useEffect, useState } from 'react'
import CitizenContext from '@/lib/citizen/citizen-context'
import { getAUMHistory, getMooneyPrice } from '@/lib/coinstats'
import { getAllNetworkTransfers } from '@/lib/network/networkSubgraph'
import { Project } from '@/lib/project/useProjectData'
import queryTable from '@/lib/tableland/queryTable'
import { getChainSlug } from '@/lib/thirdweb/chain'
import { serverClient } from '@/lib/thirdweb/client'
import { calculateARRFromTransfers } from '@/lib/treasury/arr'
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

export default function Home({
  newestNewsletters,
  newestCitizens,
  newestListings,
  newestJobs,
  citizenSubgraphData,
  aumData,
  arrData,
  mooneyPrice,
  filteredTeams,
  citizensLocationData,
  currentProjects,
}: any) {
  const router = useRouter()
  const { citizen } = useContext(CitizenContext)

  if (citizen) {
    return (
      <SignedInDashboard
        newestNewsletters={newestNewsletters}
        newestCitizens={newestCitizens}
        newestListings={newestListings}
        newestJobs={newestJobs}
        citizenSubgraphData={citizenSubgraphData}
        aumData={aumData}
        arrData={arrData}
        mooneyPrice={mooneyPrice}
        filteredTeams={filteredTeams}
        citizensLocationData={citizensLocationData}
        currentProjects={currentProjects}
      />
    )
  }

  return (
    <Container>
      <WebsiteHead
        title="Welcome"
        description="MoonDAO is accelerating our multiplanetary future with an open platform to fund, collaborate, and compete on challenges that get us closer to a lunar settlement."
      />
      <div>
        <Hero />
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
  const chain = DEFAULT_CHAIN_V5
  const chainSlug = getChainSlug(chain)

  // Initialize all data structures with proper types
  let transferData: any = { citizenTransfers: [], teamTransfers: [] }
  let arrData: any = {
    arrHistory: [],
    currentARR: 0,
    citizenARR: 0,
    teamARR: 0,
  }
  let citizenSubgraphData: any = { transfers: [], createdAt: Date.now() }
  let aumData = null
  let newestCitizens: any = []
  let newestListings: any = []
  let newestJobs: any = []
  let mooneyPrice = 0.0003605 // Default fallback price

  // Get MOONEY price data
  const getMooneyPriceData = async () => {
    try {
      const priceData = await getMooneyPrice()
      console.log('PRICE DATA', priceData)
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

  // Batch all contract operations to reduce API calls
  const contractOperations = async () => {
    try {
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

      // Batch all table name reads
      const [
        citizenTableName,
        marketplaceTableName,
        jobTableName,
        teamTableName,
        projectTableName,
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
      ])

      // Batch all table queries
      const [citizens, listings, jobs, teams, projects] = await Promise.all([
        queryTable(
          chain,
          `SELECT * FROM ${citizenTableName} ORDER BY id DESC LIMIT 10`
        ),
        queryTable(
          chain,
          `SELECT * FROM ${marketplaceTableName} ORDER BY id DESC LIMIT 10`
        ),
        queryTable(
          chain,
          `SELECT * FROM ${jobTableName} WHERE (endTime = 0 OR endTime >= ${Math.floor(
            Date.now() / 1000
          )}) ORDER BY id DESC LIMIT 10`
        ),
        queryTable(
          chain,
          `SELECT * FROM ${teamTableName} ORDER BY id DESC LIMIT 10`
        ),
        queryTable(chain, `SELECT * FROM ${projectTableName} ORDER BY id DESC`),
      ])

      return { citizens, listings, jobs, teams, projects }
    } catch (error) {
      console.error('Contract operations failed:', error)
      return { citizens: [], listings: [], jobs: [], teams: [], projects: [] }
    }
  }

  // Get all transfer data as requested
  const allTransferData = async () => {
    try {
      console.log('Fetching all network transfers...')
      const transfers = await getAllNetworkTransfers()
      console.log(
        `Fetched ${transfers.citizenTransfers.length} citizen transfers and ${transfers.teamTransfers.length} team transfers`
      )
      return transfers
    } catch (error) {
      console.error('Transfer data fetch failed:', error)
      return { citizenTransfers: [], teamTransfers: [] }
    }
  }

  // Get AUM data with proper error handling
  const getAUMData = async () => {
    try {
      const aum = await getAUMHistory(365)
      return aum
    } catch (error) {
      console.error('AUM data fetch failed:', error)
      return null
    }
  }

  // Use Promise.allSettled to run all operations in parallel with individual error handling
  const [transferResult, contractResult, aumResult, mooneyPriceResult] =
    await Promise.allSettled([
      allTransferData(),
      contractOperations(),
      getAUMData(),
      getMooneyPriceData(),
    ])

  // Extract results with fallbacks and proper type handling
  if (transferResult.status === 'fulfilled') {
    transferData = transferResult.value

    // Calculate ARR from all transfer data
    try {
      arrData = await calculateARRFromTransfers(
        transferData.citizenTransfers,
        transferData.teamTransfers,
        365
      )
    } catch (error) {
      console.error('ARR calculation failed:', error)
    }

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
    const { citizens, listings, jobs, teams, projects } = contractResult.value
    newestCitizens = citizens
    newestListings = listings
    newestJobs = jobs
    newestTeams = teams

    // Process projects data for home page display - match projects-overview.tsx logic
    if (projects && projects.length > 0) {
      const activeProjects = []
      for (let i = 0; i < projects.length; i++) {
        if (projects[i]) {
          const project = projects[i] as any
          // Use the 'active' field to determine current projects, excluding blocked ones
          if (project.active && !blockedProjects.includes(project.id)) {
            activeProjects.push(project)
          }
        }
      }

      // Sort projects by eligible status (same as projects-overview.tsx)
      activeProjects.sort((a, b) => {
        if (a.eligible === b.eligible) {
          return 0
        }
        return a.eligible ? 1 : -1
      })

      currentProjects = activeProjects.reverse() as Project[]
    }

    // Process teams data for home page display
    filteredTeams = teams.filter((team: any) => team.id && team.name)

    // Process citizens data for map display
    citizensLocationData = citizens
      .filter((citizen: any) => citizen.location)
      .map((citizen: any) => ({
        name: citizen.name || 'Anonymous',
        location: citizen.location,
        bio: citizen.bio || '',
      }))
  }

  if (aumResult.status === 'fulfilled') {
    aumData = aumResult.value
  }

  if (mooneyPriceResult.status === 'fulfilled') {
    mooneyPrice = mooneyPriceResult.value
  }

  // Get newsletter data (will be fetched client-side)
  const newestNewsletters: any = []

  return {
    props: {
      newestNewsletters,
      newestCitizens,
      newestListings,
      newestJobs,
      citizenSubgraphData,
      aumData,
      arrData,
      mooneyPrice,
      filteredTeams,
      citizensLocationData,
      currentProjects,
    },
    revalidate: 300,
  }
}
