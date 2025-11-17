import CitizenTableABI from 'const/abis/CitizenTable.json'
import JBV5Controller from 'const/abis/JBV5Controller.json'
import JBV5Directory from 'const/abis/JBV5Directory.json'
import JBV5Token from 'const/abis/JBV5Token.json'
import JBV5Tokens from 'const/abis/JBV5Tokens.json'
import JobTableABI from 'const/abis/JobBoardTable.json'
import LaunchPadPayHookABI from 'const/abis/LaunchPadPayHook.json'
import MarketplaceTableABI from 'const/abis/MarketplaceTable.json'
import MissionCreator from 'const/abis/MissionCreator.json'
import MissionTableABI from 'const/abis/MissionTable.json'
import ProjectTableABI from 'const/abis/ProjectTable.json'
import TeamTableABI from 'const/abis/TeamTable.json'
import {
  CITIZEN_TABLE_ADDRESSES,
  DEFAULT_CHAIN_V5,
  JBV5_CONTROLLER_ADDRESS,
  JBV5_DIRECTORY_ADDRESS,
  JBV5_TOKENS_ADDRESS,
  JB_NATIVE_TOKEN_ADDRESS,
  JOBS_TABLE_ADDRESSES,
  MARKETPLACE_TABLE_ADDRESSES,
  MISSION_CREATOR_ADDRESSES,
  MISSION_TABLE_ADDRESSES,
  PROJECT_TABLE_ADDRESSES,
  TEAM_TABLE_ADDRESSES,
  ZERO_ADDRESS,
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
import { getBackers } from '@/lib/mission'
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
import Hero from '../components/home/Hero'
import LaunchpadSection from '../components/home/LaunchpadSection'
import PartnerSection from '../components/home/PartnerSection'
import SpeakerSection from '../components/home/SpeakerSection'
import Timeline from '../components/home/Timeline'
import Container from '../components/layout/Container'
import { ExpandedFooter } from '../components/layout/ExpandedFooter'
import WebsiteHead from '../components/layout/Head'
import PageEnder from '../components/layout/PreFooter'
import FeaturedMissionSection from '@/components/home/FeaturedMissionSection'
import SignedInDashboard from '@/components/home/SignedInDashboard'
import { PROJECT_ACTIVE } from '@/lib/nance/types'

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
  featuredMissionData,
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
          featuredMissionData={featuredMissionData}
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
        <FeaturedMissionSection
          missions={missions}
          featuredMissionData={featuredMissionData}
        />
        <Callout1 />
        <Callout2 />
        <Feature />
        <LaunchpadSection />
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
  let featuredMissionData: any = null

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

      const [citizens, listings, jobs] = await Promise.all([
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
      ])

      await new Promise((resolve) => setTimeout(resolve, 200))

      const [teams, projects, missionRows] = await Promise.all([
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
          if (
            project.active === PROJECT_ACTIVE &&
            !BLOCKED_PROJECTS.has(project.id)
          ) {
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

        // Fetch featured mission data (first mission with active funding, or first mission)
        const featuredMission =
          missions.find(
            (mission: any) =>
              mission.projectId &&
              mission.projectId > 0 &&
              mission.fundingGoal &&
              mission.fundingGoal > 0
          ) || (missions.length > 0 ? missions[0] : null)

        if (featuredMission && featuredMission.projectId) {
          try {
            const chain = DEFAULT_CHAIN_V5
            const chainSlug = getChainSlug(chain)

            const jbControllerContract = getContract({
              client: serverClient,
              address: JBV5_CONTROLLER_ADDRESS,
              abi: JBV5Controller.abi as any,
              chain: chain,
            })

            const jbDirectoryContract = getContract({
              client: serverClient,
              address: JBV5_DIRECTORY_ADDRESS,
              abi: JBV5Directory.abi as any,
              chain: chain,
            })

            const missionCreatorContract = getContract({
              client: serverClient,
              address: MISSION_CREATOR_ADDRESSES[chainSlug],
              abi: MissionCreator.abi as any,
              chain: chain,
            })

            const jbTokensContract = getContract({
              client: serverClient,
              address: JBV5_TOKENS_ADDRESS,
              abi: JBV5Tokens.abi as any,
              chain: chain,
            })

            const [
              stage,
              payHookAddress,
              tokenAddress,
              primaryTerminalAddress,
              ruleset,
            ] = await Promise.all([
              readContract({
                contract: missionCreatorContract,
                method: 'stage' as string,
                params: [featuredMission.id],
              }).catch(() => null),
              readContract({
                contract: missionCreatorContract,
                method: 'missionIdToPayHook' as string,
                params: [featuredMission.id],
              }).catch(() => null),
              readContract({
                contract: jbTokensContract,
                method: 'tokenOf' as string,
                params: [featuredMission.projectId],
              }).catch(() => null),
              readContract({
                contract: jbDirectoryContract,
                method: 'primaryTerminalOf' as string,
                params: [featuredMission.projectId, JB_NATIVE_TOKEN_ADDRESS],
              }).catch(() => ZERO_ADDRESS),
              readContract({
                contract: jbControllerContract,
                method: 'currentRulesetOf' as string,
                params: [featuredMission.projectId],
              }).catch(() => null),
            ])

            let deadline: number | undefined = undefined
            let refundPeriod: number | undefined = undefined

            if (payHookAddress && payHookAddress !== ZERO_ADDRESS) {
              try {
                const payHookContract = getContract({
                  client: serverClient,
                  address: payHookAddress,
                  chain: chain,
                  abi: LaunchPadPayHookABI.abi as any,
                })

                const [dl, rp] = await Promise.all([
                  readContract({
                    contract: payHookContract,
                    method: 'deadline' as string,
                    params: [],
                  }).catch(() => null),
                  readContract({
                    contract: payHookContract,
                    method: 'refundPeriod' as string,
                    params: [],
                  }).catch(() => null),
                ])

                if (dl) deadline = +dl.toString() * 1000
                if (rp) refundPeriod = +rp.toString() * 1000
              } catch (error) {
                console.warn('Failed to fetch deadline/refundPeriod:', error)
              }
            }

            let tokenData: any = {
              tokenAddress: tokenAddress || '',
              tokenName: '',
              tokenSymbol: '',
              tokenSupply: '',
            }

            if (tokenAddress && tokenAddress !== ZERO_ADDRESS) {
              try {
                const tokenContract = getContract({
                  client: serverClient,
                  address: tokenAddress,
                  abi: JBV5Token as any,
                  chain: chain,
                })

                const [nameResult, symbolResult, supplyResult] =
                  await Promise.allSettled([
                    readContract({
                      contract: tokenContract,
                      method: 'name' as string,
                      params: [],
                    }),
                    readContract({
                      contract: tokenContract,
                      method: 'symbol' as string,
                      params: [],
                    }),
                    readContract({
                      contract: tokenContract,
                      method: 'totalSupply' as string,
                      params: [],
                    }),
                  ])

                if (nameResult.status === 'fulfilled' && nameResult.value) {
                  tokenData.tokenName = nameResult.value
                }
                if (symbolResult.status === 'fulfilled' && symbolResult.value) {
                  tokenData.tokenSymbol = symbolResult.value
                }
                if (supplyResult.status === 'fulfilled' && supplyResult.value) {
                  tokenData.tokenSupply = supplyResult.value.toString()
                }
              } catch (error) {
                console.warn('Failed to fetch token data:', error)
              }
            }

            const _ruleset = ruleset
              ? [
                  { weight: +ruleset[0].weight.toString() },
                  { reservedPercent: +ruleset[1].reservedPercent.toString() },
                ]
              : null

            let _backers: any[] = []
            try {
              _backers = await getBackers(
                featuredMission.projectId,
                featuredMission.id
              )
            } catch (err) {
              console.warn('Failed to fetch backers:', err)
            }

            featuredMissionData = {
              mission: featuredMission,
              _stage: stage ? +stage.toString() : 1,
              _deadline: deadline,
              _refundPeriod: refundPeriod,
              _primaryTerminalAddress: primaryTerminalAddress,
              _token: tokenData,
              _fundingGoal: featuredMission.fundingGoal || 0,
              _ruleset: _ruleset,
              _backers: _backers,
              projectMetadata: featuredMission.metadata,
            }
          } catch (error) {
            console.warn('Failed to fetch featured mission data:', error)
          }
        }
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
      featuredMissionData,
    },
    revalidate: 300,
  }
}
