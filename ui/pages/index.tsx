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
import { BLOCKED_MISSIONS } from 'const/whitelist'
import dynamic from 'next/dynamic'
import { getContract, readContract } from 'thirdweb'
import { getAUMHistory, getMooneyPrice } from '@/lib/coinstats'
import { getIPFSGateway } from '@/lib/ipfs/gateway'
import { getCitizensLocationData } from '@/lib/map'
import { getAllNetworkTransfers } from '@/lib/network/networkSubgraph'
import { Project } from '@/lib/project/useProjectData'
import queryTable from '@/lib/tableland/queryTable'
import { getChainSlug } from '@/lib/thirdweb/chain'
import { serverClient } from '@/lib/thirdweb/client'
import Container from '../components/layout/Container'
import WebsiteHead from '../components/layout/Head'
import { LoadingSpinner } from '../components/layout/LoadingSpinner'

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

export default function Home({
  newestCitizens,
  newestListings,
  newestJobs,
  citizenSubgraphData,
  aumData,
  mooneyPrice,
  filteredTeams,
  allProjects,
  missions,
  featuredMissionData,
  citizensLocationData,
}: any) {
  return (
    <>
      <WebsiteHead
        title="Welcome"
        description="MoonDAO is accelerating our multiplanetary future with an open platform to fund, collaborate, and compete on challenges that get us closer to a lunar settlement."
      />
      <SignedInDashboard
        newestCitizens={newestCitizens}
        newestListings={newestListings}
        newestJobs={newestJobs}
        citizenSubgraphData={citizenSubgraphData}
        aumData={aumData}
        mooneyPrice={mooneyPrice}
        filteredTeams={filteredTeams}
        projects={allProjects}
        missions={missions}
        featuredMissionData={featuredMissionData}
        citizensLocationData={citizensLocationData}
      />
    </>
  )
}

export async function getStaticProps() {
  const CitizenTableABI = (await import('const/abis/CitizenTable.json')).default
  const JBV5Controller = (await import('const/abis/JBV5Controller.json')).default
  const MarketplaceTableABI = (await import('const/abis/MarketplaceTable.json')).default
  const JobTableABI = (await import('const/abis/JobBoardTable.json')).default
  const TeamTableABI = (await import('const/abis/TeamTable.json')).default
  const ProjectTableABI = (await import('const/abis/ProjectTable.json')).default
  const MissionTableABI = (await import('const/abis/MissionTable.json')).default

  let transferData: any = { citizenTransfers: [], teamTransfers: [] }
  let citizenSubgraphData: any = { transfers: [], createdAt: Date.now() }
  let aumData = null
  let newestCitizens: any = []
  let newestListings: any = []
  let newestJobs: any = []
  let mooneyPrice = 0
  let newestTeams: any = []
  let filteredTeams: any = []
  let allProjects: Project[] = []
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

      const [
        citizenTableName,
        marketplaceTableName,
        jobTableName,
        teamTableName,
        projectTableName,
        missionTableName,
      ] = await Promise.all([
        readContract({ contract: citizenTableContract, method: 'getTableName' }).catch(() => ''),
        readContract({ contract: marketplaceTableContract, method: 'getTableName' }).catch(() => ''),
        readContract({ contract: jobTableContract, method: 'getTableName' }).catch(() => ''),
        readContract({ contract: teamTableContract, method: 'getTableName' }).catch(() => ''),
        readContract({ contract: projectTableContract, method: 'getTableName' }).catch(() => ''),
        readContract({ contract: missionTableContract, method: 'getTableName' }).catch(() => ''),
      ])

      const [citizens, listings, jobs, teams, projects, missionRows] = await Promise.all([
        citizenTableName
          ? queryTable(chain, `SELECT * FROM ${citizenTableName} ORDER BY id DESC LIMIT 8`)
          : Promise.resolve([]),
        marketplaceTableName
          ? queryTable(
              chain,
              `SELECT * FROM ${marketplaceTableName} WHERE (startTime = 0 OR startTime <= ${Math.floor(Date.now() / 1000)}) AND (endTime = 0 OR endTime >= ${Math.floor(Date.now() / 1000)}) ORDER BY id DESC LIMIT 5`
            )
          : Promise.resolve([]),
        jobTableName
          ? queryTable(
              chain,
              `SELECT * FROM ${jobTableName} WHERE (endTime = 0 OR endTime >= ${Math.floor(Date.now() / 1000)}) ORDER BY id DESC LIMIT 5`
            )
          : Promise.resolve([]),
        teamTableName
          ? queryTable(chain, `SELECT * FROM ${teamTableName} ORDER BY id DESC`)
          : Promise.resolve([]),
        projectTableName
          ? queryTable(chain, `SELECT * FROM ${projectTableName} ORDER BY id DESC`)
          : Promise.resolve([]),
        missionTableName
          ? queryTable(chain, `SELECT * FROM ${missionTableName} ORDER BY id DESC LIMIT 1`)
          : Promise.resolve([]),
      ])

      return { citizens, listings, jobs, teams, projects, missionRows }
    } catch (error) {
      console.error('Contract operations failed:', error)
      return { citizens: [], listings: [], jobs: [], teams: [], projects: [], missionRows: [] }
    }
  }

  const [transferResult, contractResult, aumResult, mooneyPriceResult, locationResult] =
    await Promise.allSettled([
      getAllNetworkTransfers().catch(() => ({ citizenTransfers: [], teamTransfers: [] })),
      contractOperations(),
      getAUMHistory(365).catch(() => null),
      getMooneyPrice()
        .then((d) => d?.price || 0)
        .catch(() => 0),
      getCitizensLocationData().catch(() => []),
    ])

  transferData =
    transferResult.status === 'fulfilled'
      ? transferResult.value
      : { citizenTransfers: [], teamTransfers: [] }
  aumData = aumResult.status === 'fulfilled' ? aumResult.value : null

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
    allProjects = projects

    if (missionRows && missionRows.length > 0) {
      const filteredMissionRows = missionRows.filter((mission: any) => {
        return !BLOCKED_MISSIONS.has(mission.id) && mission && mission.id
      })
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
          }).catch(() => null)

          if (metadataURI) {
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

            featuredMissionData = {
              mission: missions[0],
              projectMetadata: metadata,
            }
          }
        } catch (error) {
          console.warn('Failed to fetch featured mission metadata:', error)
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
      mooneyPrice,
      filteredTeams,
      allProjects,
      missions,
      featuredMissionData,
      citizensLocationData,
    },
    revalidate: 60,
  }
}
