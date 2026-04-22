import {
  CITIZEN_TABLE_ADDRESSES,
  CITIZEN_TABLE_NAMES,
  DEFAULT_CHAIN_V5,
  JBV5_CONTROLLER_ADDRESS,
  JOBS_TABLE_ADDRESSES,
  JOBS_TABLE_NAMES,
  MARKETPLACE_TABLE_ADDRESSES,
  MARKETPLACE_TABLE_NAMES,
  MISSION_TABLE_ADDRESSES,
  MISSION_TABLE_NAMES,
  PROJECT_TABLE_ADDRESSES,
  PROJECT_TABLE_NAMES,
  TEAM_TABLE_ADDRESSES,
  TEAM_TABLE_NAMES,
} from 'const/config'
import { BLOCKED_CITIZENS, BLOCKED_MISSIONS, BLOCKED_PROJECTS } from 'const/whitelist'
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
  mooneyPrice,
  filteredTeams,
  allProjects,
  missions,
  featuredMissionData,
  citizensLocationData,
  citizensCount,
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
        mooneyPrice={mooneyPrice}
        filteredTeams={filteredTeams}
        projects={allProjects}
        missions={missions}
        featuredMissionData={featuredMissionData}
        citizensLocationData={citizensLocationData}
        citizensCount={citizensCount}
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
  let allProjects: Project[] = []
  let missions: any = []
  let featuredMissionData: any = null
  let citizensLocationData: any[] = []

  const contractOperations = async () => {
    try {
      const chain = DEFAULT_CHAIN_V5
      const chainSlug = getChainSlug(chain)

      const citizenTableContract = CITIZEN_TABLE_ADDRESSES[chainSlug]
        ? getContract({
            client: serverClient,
            address: CITIZEN_TABLE_ADDRESSES[chainSlug],
            chain: chain,
            abi: CitizenTableABI as any,
          })
        : null

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

      const teamTableContract = TEAM_TABLE_ADDRESSES[chainSlug]
        ? getContract({
            client: serverClient,
            address: TEAM_TABLE_ADDRESSES[chainSlug],
            chain: chain,
            abi: TeamTableABI as any,
          })
        : null

      const projectTableContract = PROJECT_TABLE_ADDRESSES[chainSlug]
        ? getContract({
            client: serverClient,
            address: PROJECT_TABLE_ADDRESSES[chainSlug],
            chain: chain,
            abi: ProjectTableABI as any,
          })
        : null

      const missionTableContract = MISSION_TABLE_ADDRESSES[chainSlug]
        ? getContract({
            client: serverClient,
            address: MISSION_TABLE_ADDRESSES[chainSlug],
            chain: chain,
            abi: MissionTableABI as any,
          })
        : null

      // Table queries - use config names as fallback when contract unavailable
      const [
        citizenTableNameResolved,
        marketplaceTableName,
        jobTableName,
        teamTableNameResolved,
        projectTableNameResolved,
        missionTableNameResolved,
      ] = await Promise.all([
        citizenTableContract
          ? readContract({
              contract: citizenTableContract,
              method: 'getTableName',
            }).catch((error) => {
              console.error('Error reading citizen table name:', error)
              return ''
            })
          : Promise.resolve(''),
        readContract({
          contract: marketplaceTableContract,
          method: 'getTableName',
        }).catch((error) => {
          console.error('Error reading marketplace table name:', error)
          return ''
        }),
        readContract({ contract: jobTableContract, method: 'getTableName' }).catch((error) => {
          console.error('Error reading job table name:', error)
          return ''
        }),
        teamTableContract
          ? readContract({ contract: teamTableContract, method: 'getTableName' }).catch((error) => {
              console.error('Error reading team table name:', error)
              return ''
            })
          : Promise.resolve(''),
        projectTableContract
          ? readContract({
              contract: projectTableContract,
              method: 'getTableName',
            }).catch((error) => {
              console.error('Error reading project table name:', error)
              return ''
            })
          : Promise.resolve(''),
        missionTableContract
          ? readContract({
              contract: missionTableContract,
              method: 'getTableName',
            }).catch((error) => {
              console.error('Error reading mission table name:', error)
              return ''
            })
          : Promise.resolve(''),
      ])

      const citizenTableName = citizenTableNameResolved || CITIZEN_TABLE_NAMES[chainSlug] || ''
      const teamTableName = teamTableNameResolved || TEAM_TABLE_NAMES[chainSlug] || ''
      const projectTableName =
        projectTableNameResolved || PROJECT_TABLE_NAMES[chainSlug] || ''
      const missionTableName =
        missionTableNameResolved || MISSION_TABLE_NAMES[chainSlug] || ''
      // Marketplace and Jobs tables previously had no fallback. When the
      // on-chain `getTableName()` read fails (RPC blip / ISR build hiccup),
      // queries silently returned empty arrays — the dashboard would say
      // "No open positions" and "No new listings" even with live data.
      const marketplaceTableNameWithFallback =
        marketplaceTableName || MARKETPLACE_TABLE_NAMES[chainSlug] || ''
      const jobTableNameWithFallback =
        jobTableName || JOBS_TABLE_NAMES[chainSlug] || ''

      const blockedIds = BLOCKED_CITIZENS.size > 0
        ? ` WHERE id NOT IN (${Array.from(BLOCKED_CITIZENS).join(',')})`
        : ''
      const [citizens, citizensCountResult, listings, jobs, teams, projects, missionRows] =
        await Promise.all([
          citizenTableName ? queryTable(chain, `SELECT * FROM ${citizenTableName} ORDER BY id DESC LIMIT 8`).catch((error) => {
            console.error('Error querying citizen table:', error)
            return []
          }) : Promise.resolve([]),
          citizenTableName ? queryTable(chain, `SELECT COUNT(*) as count FROM ${citizenTableName}${blockedIds}`).catch((error) => {
            console.error('Error querying citizen count:', error)
            return [{ count: 0 }]
          }) : Promise.resolve([{ count: 0 }]),
        marketplaceTableNameWithFallback ? queryTable(
          chain,
          `SELECT * FROM ${marketplaceTableNameWithFallback} WHERE (startTime = 0 OR startTime <= ${Math.floor(
            Date.now() / 1000
          )}) AND (endTime = 0 OR endTime >= ${Math.floor(
            Date.now() / 1000
          )}) ORDER BY id DESC LIMIT 5`
        ).catch((error) => {
          console.error('Error querying marketplace table:', error)
          return []
        }) : Promise.resolve([]),
        jobTableNameWithFallback ? queryTable(
          chain,
          `SELECT * FROM ${jobTableNameWithFallback} WHERE (endTime = 0 OR endTime >= ${Math.floor(
            Date.now() / 1000
          )}) ORDER BY id DESC LIMIT 5`
        ).catch((error) => {
          console.error('Error querying job board table:', error)
          return []
        }) : Promise.resolve([]),
        teamTableName ? queryTable(chain, `SELECT * FROM ${teamTableName} ORDER BY id DESC`).catch((error) => {
          console.error('Error querying team table:', error)
          return []
        }) : Promise.resolve([]),
        projectTableName ? queryTable(chain, `SELECT * FROM ${projectTableName} ORDER BY id DESC`).catch((error) => {
          console.error('Error querying project table:', error)
          return []
        }) : Promise.resolve([]),
        missionTableName ? queryTable(chain, `SELECT * FROM ${missionTableName} ORDER BY id DESC LIMIT 1`).catch((error) => {
          console.error('Error querying mission table:', error)
          return []
        }) : Promise.resolve([]),
      ])

      const citizensCount = Number(citizensCountResult?.[0]?.count ?? 0)
      return { citizens, citizensCount, listings, jobs, teams, projects, missionRows }
    } catch (error) {
      console.error('Contract operations failed:', error)
      return {
        citizens: [],
        citizensCount: 0,
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

  let citizensCount = 0
  if (contractResult.status === 'fulfilled') {
    const { citizens, listings, jobs, teams, projects, missionRows } = contractResult.value
    newestCitizens = citizens.filter((c: any) => !BLOCKED_CITIZENS.has(c.id))
    newestListings = listings
    newestJobs = jobs
    newestTeams = teams
    allProjects = projects

    // Process missions data - simplified to just pass basic data to client.
    // Always populate `missions` + `featuredMissionData` from the table row so
    // the dashboard can render *something* even when JB controller / IPFS
    // calls fail. The client fills in richer details after hydration.
    if (missionRows && missionRows.length > 0) {
      const filteredMissionRows = missionRows.filter((mission: any) => {
        return !BLOCKED_MISSIONS.has(mission.id) && mission && mission.id
      })
      if (filteredMissionRows.length > 0 && filteredMissionRows[0]?.projectId) {
        const baseRow = filteredMissionRows[0]
        const fallbackMission = {
          id: baseRow.id,
          teamId: baseRow.teamId,
          projectId: baseRow.projectId,
          fundingGoal: baseRow.fundingGoal || 0,
          deadline: baseRow.deadline || null,
          stage: baseRow.stage || 1,
          metadata: {
            name: 'Featured Mission',
            description: 'Loading mission details...',
            image: '/assets/placeholder-mission.png',
          },
        }

        // Seed with the basic row first so the section renders even if any
        // of the downstream calls below fail.
        missions = [fallbackMission]
        featuredMissionData = {
          mission: fallbackMission,
          projectMetadata: fallbackMission.metadata,
        }

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
            params: [baseRow.projectId],
          }).catch((error) => {
            console.error('Failed to fetch featured mission metadata URI:', error)
            return null
          })

          if (metadataURI) {
            try {
              const metadataRes = await fetch(getIPFSGateway(metadataURI))
              if (metadataRes.ok) {
                const metadata = await metadataRes.json()
                const enrichedMission = {
                  ...fallbackMission,
                  metadata,
                }
                missions = [enrichedMission]
                featuredMissionData = {
                  mission: enrichedMission,
                  projectMetadata: metadata,
                }
              }
            } catch (ipfsError) {
              console.warn(
                'Failed to fetch featured mission metadata from IPFS:',
                ipfsError
              )
            }
          }
        } catch (error) {
          console.warn('Failed to enrich featured mission metadata:', error)
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
      citizensCount,
    },
    revalidate: 60, // 1 minute - optimized with batched validation
  }
}
