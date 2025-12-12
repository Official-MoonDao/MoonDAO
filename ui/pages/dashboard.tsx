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
import dynamic from 'next/dynamic'
import { useRouter } from 'next/router'
import { useContext, useEffect } from 'react'
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
import Container from '../components/layout/Container'
import WebsiteHead from '../components/layout/Head'
import { LoadingSpinner } from '../components/layout/LoadingSpinner'

// Dynamic import for SignedInDashboard (client-side only)
const SignedInDashboard = dynamic(() => import('@/components/home/SignedInDashboard'), {
  ssr: false,
  loading: () => (
    <Container>
      <div className="flex items-center justify-center min-h-screen">
        <LoadingSpinner width="w-12" height="h-12" />
      </div>
    </Container>
  ),
})

export default function Dashboard({
  newestCitizens,
  newestListings,
  newestJobs,
  citizenSubgraphData,
  aumData,
  revenueData,
  mooneyPrice,
  filteredTeams,
  currentProjects,
  missions,
  featuredMissionData,
  citizensLocationData,
}: any) {
  const router = useRouter()
  const { citizen, isLoading } = useContext(CitizenContext)

  // Redirect non-citizens to homepage
  useEffect(() => {
    if (!isLoading && !citizen) {
      router.push('/')
    }
  }, [citizen, isLoading, router])

  // Show loading while checking citizen status
  if (isLoading) {
    return (
      <Container>
        <div className="flex items-center justify-center min-h-screen">
          <LoadingSpinner width="w-12" height="h-12" />
        </div>
      </Container>
    )
  }

  // Don't render if not a citizen (will redirect)
  if (!citizen) {
    return null
  }

  return (
    <>
      <WebsiteHead
        title="Dashboard"
        description="Your MoonDAO citizen dashboard - manage your profile, view missions, and connect with the community."
      />
      <SignedInDashboard
        newestCitizens={newestCitizens}
        newestListings={newestListings}
        newestJobs={newestJobs}
        citizenSubgraphData={citizenSubgraphData}
        aumData={aumData}
        revenueData={revenueData}
        mooneyPrice={mooneyPrice}
        filteredTeams={filteredTeams}
        currentProjects={currentProjects}
        missions={missions}
        featuredMissionData={featuredMissionData}
        citizensLocationData={citizensLocationData}
      />
    </>
  )
}

export async function getStaticProps() {
  // Import ABIs only on server-side to reduce client bundle
  const CitizenTableABI = (await import('const/abis/CitizenTable.json')).default
  const JBV5Controller = (await import('const/abis/JBV5Controller.json')).default
  const MarketplaceTableABI = (await import('const/abis/MarketplaceTable.json')).default
  const JobTableABI = (await import('const/abis/JobBoardTable.json')).default
  const TeamTableABI = (await import('const/abis/TeamTable.json')).default
  const ProjectTableABI = (await import('const/abis/ProjectTable.json')).default
  const MissionTableABI = (await import('const/abis/MissionTable.json')).default

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
  let missions: any = []
  let featuredMissionData: any = null
  let citizensLocationData: any[] = []

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

      const [citizens, listings, jobs, teams, projects, missionRows] = await Promise.all([
        queryTable(chain, `SELECT * FROM ${citizenTableName} ORDER BY id DESC LIMIT 5`),
        queryTable(
          chain,
          `SELECT * FROM ${marketplaceTableName} WHERE (startTime = 0 OR startTime <= ${Math.floor(
            Date.now() / 1000
          )}) AND (endTime = 0 OR endTime >= ${Math.floor(
            Date.now() / 1000
          )}) ORDER BY id DESC LIMIT 5`
        ),
        queryTable(
          chain,
          `SELECT * FROM ${jobTableName} WHERE (endTime = 0 OR endTime >= ${Math.floor(
            Date.now() / 1000
          )}) ORDER BY id DESC LIMIT 5`
        ),
        queryTable(chain, `SELECT * FROM ${teamTableName} ORDER BY id DESC`),
        queryTable(chain, `SELECT * FROM ${projectTableName} ORDER BY id DESC`),
        queryTable(chain, `SELECT * FROM ${missionTableName} ORDER BY id DESC LIMIT 1`),
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

  const getLocationData = async () => {
    try {
      const locationData = await getCitizensLocationData()
      return locationData
    } catch (error) {
      console.error('Location data fetch failed:', error)
      return []
    }
  }

  const [transferResult, contractResult, aumResult, mooneyPriceResult, locationResult] =
    await Promise.allSettled([
      allTransferData(),
      contractOperations(),
      getAUMData(),
      getMooneyPriceData(),
      getLocationData(),
    ])

  transferData =
    transferResult.status === 'fulfilled'
      ? transferResult.value
      : { citizenTransfers: [], teamTransfers: [] }
  aumData = aumResult.status === 'fulfilled' ? aumResult.value : null

  const defiDataForRevenue = aumData?.defiData || {
    balance: 0,
    firstPoolCreationTimestamp: 0,
    protocols: [],
  }

  try {
    revenueData = await getHistoricalRevenue(defiDataForRevenue, 365)
  } catch (error) {
    console.error('Error getting historical revenue:', error)
    revenueData = {
      revenueHistory: [],
      currentRevenue: 0,
      citizenRevenue: 0,
      teamRevenue: 0,
      defiRevenue: 0,
      stakingRevenue: 0,
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
    const { citizens, listings, jobs, teams, projects, missionRows } = contractResult.value
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

    // Process missions data - simplified to just pass basic data to client
    if (missionRows && missionRows.length > 0) {
      const filteredMissionRows = missionRows.filter((mission: any) => {
        return !BLOCKED_MISSIONS.has(mission.id) && mission && mission.id
      })

      // Only fetch metadata for the first mission to reduce build time
      if (filteredMissionRows.length > 0 && filteredMissionRows[0]?.projectId) {
        try {
          const chain = DEFAULT_CHAIN_V5
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

    filteredTeams = teams || []
  }

  if (mooneyPriceResult.status === 'fulfilled') {
    mooneyPrice = mooneyPriceResult.value
  }

  if (locationResult.status === 'fulfilled') {
    citizensLocationData = locationResult.value
  }

  return {
    props: {
      newestCitizens,
      newestListings,
      newestJobs,
      citizenSubgraphData,
      aumData,
      revenueData,
      mooneyPrice,
      filteredTeams,
      currentProjects,
      missions,
      featuredMissionData,
      citizensLocationData,
    },
    revalidate: 60, // 1 minute - optimized with batched validation
  }
}
