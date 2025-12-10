import {
  RocketLaunchIcon,
  BanknotesIcon,
  CheckBadgeIcon,
  UserGroupIcon,
  ShoppingBagIcon,
  NewspaperIcon,
  GlobeAmericasIcon,
  PencilIcon,
  BriefcaseIcon,
  TrophyIcon,
} from '@heroicons/react/24/outline'
import HatsABI from 'const/abis/Hats.json'
import JBV5Controller from 'const/abis/JBV5Controller.json'
import JBV5Directory from 'const/abis/JBV5Directory.json'
import JBV5Tokens from 'const/abis/JBV5Tokens.json'
import MarketplaceTableABI from 'const/abis/MarketplaceTable.json'
import MissionCreator from 'const/abis/MissionCreator.json'
import MissionTableABI from 'const/abis/MissionTable.json'
import ProjectsABI from 'const/abis/Project.json'
import TeamABI from 'const/abis/Team.json'
import {
  DEFAULT_CHAIN_V5,
  FEATURED_MISSION,
  HATS_ADDRESS,
  JBV5_CONTROLLER_ADDRESS,
  JBV5_DIRECTORY_ADDRESS,
  PROJECT_ADDRESSES,
  JBV5_TOKENS_ADDRESS,
  MARKETPLACE_TABLE_ADDRESSES,
  MISSION_CREATOR_ADDRESSES,
  MISSION_TABLE_ADDRESSES,
  TEAM_ADDRESSES,
  ETH_BUDGET,
} from 'const/config'
import { BLOCKED_PROJECTS } from 'const/whitelist'
import dynamic from 'next/dynamic'
import Link from 'next/link'
import { useContext, useState, useEffect } from 'react'
import { useActiveAccount } from 'thirdweb/react'
import CitizenContext from '@/lib/citizen/citizen-context'
import { useTeamWearer } from '@/lib/hats/useTeamWearer'
import useMissionData from '@/lib/mission/useMissionData'
import { PROJECT_ACTIVE, PROJECT_PENDING } from '@/lib/nance/types'
import { useVoteCountOfAddress } from '@/lib/snapshot'
import { generatePrettyLink, generatePrettyLinkWithId } from '@/lib/subscription/pretty-links'
import { getChainSlug } from '@/lib/thirdweb/chain'
import useContract from '@/lib/thirdweb/hooks/useContract'
import { useTotalLockedMooney } from '@/lib/tokens/hooks/useTotalLockedMooney'
import { useTotalMooneyBalance } from '@/lib/tokens/hooks/useTotalMooneyBalance'
import { useTotalVMOONEY } from '@/lib/tokens/hooks/useTotalVMOONEY'
import { useTotalVP } from '@/lib/tokens/hooks/useTotalVP'
import { truncateTokenValue } from '@/lib/utils/numbers'
import { AUMChart } from '@/components/dashboard/treasury/AUMChart'
import { RevenueChart } from '@/components/dashboard/treasury/RevenueChart'
import ClaimRewardsSection from '@/components/home/ClaimRewardsSection'
import MooneyBalances from '@/components/home/MooneyBalances'
import ChartModal from '@/components/layout/ChartModal'
import Container from '@/components/layout/Container'
import { ExpandedFooter } from '@/components/layout/ExpandedFooter'
import { LoadingSpinner } from '@/components/layout/LoadingSpinner'
import StandardButton from '@/components/layout/StandardButton'
import { NewsletterSubModal } from '@/components/newsletter/NewsletterSubModal'
import ProjectCard from '@/components/project/ProjectCard'
import CitizenMetadataModal from '@/components/subscription/CitizenMetadataModal'
import CitizensChart from '@/components/subscription/CitizensChart'
import WeeklyRewardPool from '@/components/tokens/WeeklyRewardPool'
import IPFSRenderer from '../layout/IPFSRenderer'
import ProposalList from '../nance/ProposalList'
import NewMarketplaceListings from '../subscription/NewMarketplaceListings'
import DashboardQuests from './DashboardQuests'
import DashboardTeams from './DashboardTeams'

const Earth = dynamic(() => import('@/components/globe/Earth'), { ssr: false })

// Function to count unique countries from location data
function countUniqueCountries(locations: any[]): number {
  if (!locations || locations.length === 0) return 25

  try {
    const countries = new Set(
      locations
        .map((loc) => loc.country || loc.formattedAddress?.split(',').pop()?.trim() || 'Unknown')
        .filter((country) => country && country !== 'Unknown' && country !== '')
    )

    // Return fallback of 25 if no valid countries found
    return countries.size > 0 ? countries.size : 25
  } catch (error) {
    console.error('Error counting countries:', error)
    return 25
  }
}

export default function SignedInDashboard({
  newestCitizens,
  newestListings,
  newestJobs,
  citizenSubgraphData,
  aumData,
  revenueData,
  filteredTeams,
  projects,
  missions,
  featuredMissionData,
  citizensLocationData = [],
}: any) {
  const proposals = []
  const currentProjects = []
  console.log('projects', projects)
  for (let i = 0; i < projects.length; i++) {
    if (!BLOCKED_PROJECTS.has(projects[i].id)) {
      const activeStatus = projects[i].active
      if (activeStatus == PROJECT_PENDING) {
        proposals.push(projects[i])
      } else if (activeStatus == PROJECT_ACTIVE) {
        currentProjects.push(projects[i])
      }
    }
  }
  console.log('proposals', proposals)
  currentProjects.sort((a, b) => {
    if (a.eligible === b.eligible) {
      return 0
    }
    return a.eligible ? 1 : -1
  })
  const selectedChain = DEFAULT_CHAIN_V5
  const chainSlug = getChainSlug(selectedChain)

  const { citizen, isLoading: isLoadingCitizen } = useContext(CitizenContext)

  // Modal state for charts
  const [chartModalOpen, setChartModalOpen] = useState(false)
  const [chartModalComponent, setChartModalComponent] = useState<React.ReactNode>(null)
  const [chartModalTitle, setChartModalTitle] = useState('')

  // Newsletter modal state
  const [newsletterModalOpen, setNewsletterModalOpen] = useState(false)

  // Citizen metadata modal state
  const [citizenMetadataModalEnabled, setCitizenMetadataModalEnabled] = useState(false)

  // Client-side newsletter state (fetch on client-side)
  const [clientNewsletters, setClientNewsletters] = useState<any[]>([])
  const [newslettersLoading, setNewslettersLoading] = useState(false)

  // Fetch newsletters on client-side to get real ConvertKit data
  useEffect(() => {
    const fetchNewsletters = async () => {
      setNewslettersLoading(true)
      try {
        const response = await fetch('/api/newsletters')
        if (response.ok) {
          const data = await response.json()
          setClientNewsletters(data.newsletters || [])
        }
      } catch (error) {
        console.error('Failed to fetch newsletters:', error)
      } finally {
        setNewslettersLoading(false)
      }
    }

    fetchNewsletters()
  }, [])

  // Chart modal handlers
  const openCitizensChart = () => {
    setChartModalComponent(
      <CitizensChart
        transfers={citizenSubgraphData.transfers}
        isLoading={false}
        height={400}
        compact={false}
        createdAt={citizenSubgraphData.createdAt}
        defaultRange={365}
      />
    )
    setChartModalTitle('CITIZENS')
    setChartModalOpen(true)
  }

  const openAUMChart = () => {
    setChartModalComponent(
      <AUMChart
        data={aumData?.aumHistory || []}
        compact={false}
        height={400}
        isLoading={false}
        defaultRange={365}
      />
    )
    setChartModalTitle('ASSETS UNDER MANAGEMENT')
    setChartModalOpen(true)
  }

  const openRevenueChart = () => {
    setChartModalComponent(
      <RevenueChart
        data={revenueData?.revenueHistory || []}
        compact={false}
        height={400}
        isLoading={false}
        defaultRange={365}
      />
    )
    setChartModalTitle('ANNUAL REVENUE')
    setChartModalOpen(true)
  }

  const account = useActiveAccount()
  const address = account?.address

  const { data: voteCount, isValidating: isLoadingVoteCount } = useVoteCountOfAddress(address)

  const MOONEYBalance = useTotalMooneyBalance(address)
  const {
    totalLockedMooney: lockedMooneyAmount,
    nextUnlockDate: lockedMooneyUnlockDate,
    breakdown: lockedMooneyBreakdown,
    isLoading: isLoadingLockedMooney,
  } = useTotalLockedMooney(address)

  const { totalVMOONEY, isLoading: isLoadingVMOONEY } = useTotalVMOONEY(
    address,
    lockedMooneyBreakdown
  )

  const { walletVP, isLoading: isLoadingVP, isError: isErrorVP } = useTotalVP(address || '')

  const teamContract = useContract({
    address: TEAM_ADDRESSES[chainSlug],
    abi: TeamABI,
    chain: selectedChain,
  })

  const { userTeams: teamHats, isLoading: isLoadingTeams } = useTeamWearer(
    teamContract,
    selectedChain,
    address
  )
  const marketplaceTableContract = useContract({
    address: MARKETPLACE_TABLE_ADDRESSES[chainSlug],
    abi: MarketplaceTableABI as any,
    chain: selectedChain,
  })

  // Mission contracts - exactly like launchpad
  const missionTableContract = useContract({
    address: MISSION_TABLE_ADDRESSES[chainSlug],
    abi: MissionTableABI,
    chain: selectedChain,
  })

  const missionCreatorContract = useContract({
    address: MISSION_CREATOR_ADDRESSES[chainSlug],
    abi: MissionCreator.abi,
    chain: selectedChain,
  })

  const jbControllerContract = useContract({
    address: JBV5_CONTROLLER_ADDRESS,
    abi: JBV5Controller.abi,
    chain: selectedChain,
  })

  const jbDirectoryContract = useContract({
    address: JBV5_DIRECTORY_ADDRESS,
    abi: JBV5Directory.abi,
    chain: selectedChain,
  })

  const jbTokensContract = useContract({
    address: JBV5_TOKENS_ADDRESS,
    abi: JBV5Tokens.abi,
    chain: selectedChain,
  })

  const hatsContract = useContract({
    address: HATS_ADDRESS,
    abi: HatsABI as any,
    chain: selectedChain,
  })

  const projectContract = useContract({
    address: PROJECT_ADDRESSES[chainSlug],
    abi: ProjectsABI,
    chain: selectedChain,
  })

  // Find the best mission to feature - one with active funding, otherwise the newest one
  const featuredMission =
    featuredMissionData?.mission ||
    missions?.find(
      (mission: any) =>
        mission.projectId && mission.projectId > 0 && mission.fundingGoal && mission.fundingGoal > 0
    ) ||
    (missions?.length > 0 ? missions[0] : null)

  // Featured mission data - exactly like launchpad
  const {
    subgraphData: featuredMissionSubgraphData,
    fundingGoal: featuredMissionFundingGoal,
    backers: featuredMissionBackers,
    deadline: featuredMissionDeadline,
  } = useMissionData({
    mission: featuredMission,
    missionTableContract,
    missionCreatorContract,
    jbControllerContract,
    jbDirectoryContract,
    jbTokensContract,
    projectMetadata: featuredMissionData?.projectMetadata,
    _stage: featuredMissionData?._stage,
    _deadline: featuredMissionData?._deadline,
    _refundPeriod: featuredMissionData?._refundPeriod,
    _primaryTerminalAddress: featuredMissionData?._primaryTerminalAddress,
    _token: featuredMissionData?._token,
    _fundingGoal: featuredMissionData?._fundingGoal,
    _ruleset: featuredMissionData?._ruleset,
    _backers: featuredMissionData?._backers,
  })

  return (
    <Container>
      <div className="max-w-7xl mx-auto px-4 py-4">
        {/* Compact All-in-One Header */}
        <div className="relative bg-gradient-to-r from-blue-600 via-purple-600 to-indigo-700 rounded-2xl p-4 sm:p-6 mb-6 overflow-hidden">
          <div className="absolute inset-0 bg-black/20 rounded-2xl"></div>

          <div className="relative z-10 flex flex-col xl:flex-row lg:items-center gap-4 lg:gap-6">
            {/* Left Side - Profile & Title */}
            <div className="flex items-center gap-3 sm:gap-4 flex-shrink-0">
              {/* Profile Picture */}
              <div className="relative flex-shrink-0">
                <div className="w-16 h-16 sm:w-20 sm:h-20 rounded-full overflow-hidden border-3 border-white shadow-xl bg-white relative">
                  {citizen?.metadata?.image ? (
                    <IPFSRenderer
                      src={citizen.metadata.image}
                      alt={citizen.metadata.name}
                      className="w-full h-full object-cover"
                      width={100}
                      height={100}
                    />
                  ) : (
                    <div className="w-full h-full bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center">
                      <span className="text-white font-bold text-base sm:text-lg">
                        {citizen?.metadata?.name ||
                          `${address?.slice(0, 6)}...${address?.slice(-4)}` ||
                          ''}
                      </span>
                    </div>
                  )}
                  {/* Online status indicator */}
                  <div className="absolute bottom-0 right-0 w-3 h-3 sm:w-4 sm:h-4 bg-green-500 border-2 border-white rounded-full"></div>
                </div>

                {/* Edit Profile Button */}
                {citizen && (
                  <button
                    className="absolute -top-1 -right-1 w-6 h-6 sm:w-7 sm:h-7 bg-blue-600 hover:bg-blue-700 rounded-full flex items-center justify-center transition-colors shadow-lg border-2 border-white"
                    onClick={() => setCitizenMetadataModalEnabled(true)}
                    title="Edit Profile"
                  >
                    <PencilIcon className="w-3 h-3 sm:w-4 sm:h-4 text-white" />
                  </button>
                )}
              </div>

              {/* Title */}
              <div className="min-w-0">
                <h1 className="text-lg sm:text-xl lg:text-2xl font-bold text-white drop-shadow-lg leading-tight max-w-[350px] break-words">
                  {isLoadingCitizen ? (
                    <span className="flex items-center gap-2">
                      Welcome...
                      <LoadingSpinner width="w-4" height="h-4" />
                    </span>
                  ) : citizen ? (
                    `Welcome, ${citizen.metadata.name}`
                  ) : (
                    'Welcome to MoonDAO'
                  )}
                </h1>
              </div>
            </div>

            {/* Center - Balance constellation */}
            {address && (
              <div className="">
                <MooneyBalances
                  unlockedMooney={MOONEYBalance}
                  lockedMooney={lockedMooneyAmount}
                  totalVMOONEY={totalVMOONEY}
                  votingPower={walletVP}
                  isLockedLoading={!!isLoadingLockedMooney}
                  isVMOONEYLoading={isLoadingVMOONEY}
                  isVotingPowerLoading={!!isLoadingVP}
                />
              </div>
            )}

            {/* Right Side - Votes & Teams */}
            {address && (
              <div className="flex items-center gap-2 sm:gap-3 flex-shrink-0">
                <Link
                  href="/governance"
                  className="flex items-center gap-1.5 hover:text-white transition-colors cursor-pointer group font-GoodTimes"
                >
                  <CheckBadgeIcon className="h-5 w-5 text-white/80 group-hover:text-white" />
                  {isLoadingVoteCount ? (
                    <LoadingSpinner width="w-4" height="h-4" />
                  ) : (
                    <span className="font-medium whitespace-nowrap text-white/80 group-hover:text-white">
                      {voteCount || 0}
                    </span>
                  )}
                  <span className="text-white/60 group-hover:underline">Votes</span>
                </Link>
                <div className="h-4 w-px bg-white/20" />
                <Link
                  href="/network"
                  className="flex items-center gap-1.5 hover:text-white transition-colors cursor-pointer group font-GoodTimes"
                >
                  <UserGroupIcon className="h-5 w-5 text-white/80 group-hover:text-white" />
                  {isLoadingTeams ? (
                    <LoadingSpinner width="w-4" height="h-4" />
                  ) : (
                    <span className="font-medium whitespace-nowrap text-white/80 group-hover:text-white">
                      {teamHats?.length || 0}
                    </span>
                  )}
                  <span className="text-white/60 group-hover:underline">
                    {teamHats?.length === 1 ? 'Team' : 'Teams'}
                  </span>
                </Link>
              </div>
            )}
          </div>
        </div>

        {/* Launchpad Feature - Featured Mission */}
        {FEATURED_MISSION && (
          <div className="bg-gradient-to-br from-blue-600/20 to-blue-800/20 backdrop-blur-xl border border-blue-500/20 rounded-2xl p-4 sm:p-6 lg:p-8 mb-6">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
              <div className="min-w-0 flex-1">
                <h3 className="text-lg sm:text-xl lg:text-2xl font-bold text-white mb-2 flex items-center gap-2">
                  <RocketLaunchIcon className="w-5 h-5 sm:w-6 sm:h-6 lg:w-7 lg:h-7 flex-shrink-0" />
                  <span className="leading-tight">Featured Mission</span>
                </h3>
                <p className="text-blue-200 text-sm sm:text-base leading-tight">
                  Support MoonDAO's latest space mission
                </p>
              </div>
              <StandardButton
                className="bg-blue-600/20 hover:bg-blue-600/40 text-blue-300 text-sm px-4 py-2 rounded-lg transition-all"
                link="/launchpad"
              >
                View Launchpad
              </StandardButton>
            </div>

            <div className="bg-black/20 rounded-xl p-6 border border-blue-500/20">
              {featuredMission ? (
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 h-full items-stretch">
                  {/* Left Column - Mission Image */}
                  <div className="flex justify-center lg:justify-start h-full">
                    <div className="relative w-full max-w-sm h-full">
                      <div className="relative rounded-2xl overflow-hidden shadow-xl h-full min-h-[300px]">
                        {featuredMission.metadata?.logoUri ? (
                          <IPFSRenderer
                            src={featuredMission.metadata.logoUri}
                            alt={featuredMission.metadata.name || 'Mission'}
                            className="w-full h-full object-cover"
                            width={400}
                            height={400}
                          />
                        ) : (
                          <div className="w-full h-full bg-gradient-to-br from-blue-600/30 to-purple-600/30 flex items-center justify-center">
                            <RocketLaunchIcon className="w-16 h-16 text-blue-400/60" />
                          </div>
                        )}
                        <div className="absolute inset-0 bg-gradient-to-t from-black/50 to-transparent"></div>

                        {/* Mission Status Badge */}
                        <div className="absolute top-3 right-3">
                          <span
                            className={`px-3 py-1 rounded-full text-xs font-medium backdrop-blur-sm ${
                              featuredMission.projectId && featuredMission.projectId > 0
                                ? 'bg-green-500/20 text-green-300 border border-green-500/30'
                                : 'bg-gray-500/20 text-gray-300 border border-gray-500/30'
                            }`}
                          >
                            {featuredMission.projectId && featuredMission.projectId > 0
                              ? 'Active'
                              : 'Completed'}
                          </span>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Right Column - Mission Info */}
                  <div className="space-y-4">
                    {/* Mission Title */}
                    <div>
                      <h4 className="font-bold text-white text-xl lg:text-2xl mb-2 leading-tight">
                        {featuredMission.metadata.name}
                      </h4>
                      {featuredMission.metadata.tagline && (
                        <p className="text-blue-200/80 text-sm mb-3">
                          {featuredMission.metadata.tagline}
                        </p>
                      )}
                    </div>
                    {/* Mission Description */}
                    <div>
                      <p className="text-blue-200 text-sm leading-relaxed">
                        {(() => {
                          // Strip HTML tags from description
                          const description =
                            featuredMission.metadata.description ||
                            "Support MoonDAO's mission to democratize space exploration"
                          const strippedDescription = description.replace(/<[^>]*>/g, '').trim()
                          return strippedDescription.length > 200
                            ? `${strippedDescription.substring(0, 200)}...`
                            : strippedDescription
                        })()}
                      </p>
                    </div>{' '}
                    {/* Mission Stats - Exact same as launchpad */}
                    {featuredMission.projectId && featuredMission.projectId > 0 ? (
                      <div className="space-y-4">
                        {/* Progress Bar */}
                        {featuredMissionFundingGoal && featuredMissionFundingGoal > 0 && (
                          <div className="space-y-2">
                            <div className="flex justify-between items-center">
                              <span className="text-blue-200 text-xs font-medium">
                                Funding Progress
                              </span>
                              <span className="text-white font-bold text-sm">
                                {Math.round(
                                  (Number(featuredMissionSubgraphData?.volume || 0) /
                                    featuredMissionFundingGoal) *
                                    100
                                )}
                                %
                              </span>
                            </div>
                            <div className="w-full bg-blue-900/30 rounded-full h-2 overflow-hidden">
                              <div
                                className="bg-gradient-to-r from-blue-500 to-purple-500 h-full rounded-full transition-all duration-1000"
                                style={{
                                  width: `${Math.min(
                                    100,
                                    Math.round(
                                      (Number(featuredMissionSubgraphData?.volume || 0) /
                                        featuredMissionFundingGoal) *
                                        100
                                    )
                                  )}%`,
                                }}
                              />
                            </div>
                          </div>
                        )}

                        {/* Stats Grid */}
                        <div className="grid grid-cols-2 gap-3">
                          {/* Raised - shown first like on launch page */}
                          <div className="bg-blue-900/20 rounded-lg p-3 border border-blue-500/10">
                            <div className="flex items-center gap-2 mb-2">
                              <BanknotesIcon className="w-4 h-4 text-blue-400" />
                              <span className="text-blue-200 text-xs font-medium">Raised</span>
                            </div>
                            <p className="text-white font-bold text-sm">
                              {featuredMissionFundingGoal ? (
                                truncateTokenValue(
                                  Number(featuredMissionSubgraphData?.volume || 0) / 1e18,
                                  'ETH'
                                )
                              ) : (
                                <LoadingSpinner width="w-4" height="h-4" />
                              )}{' '}
                              ETH
                            </p>
                          </div>

                          {/* Goal - shown second like on launch page */}
                          <div className="bg-blue-900/20 rounded-lg p-3 border border-blue-500/10">
                            <div className="flex items-center gap-2 mb-2">
                              <TrophyIcon className="w-4 h-4 text-blue-400" />
                              <span className="text-blue-200 text-xs font-medium">Goal</span>
                            </div>
                            <p className="text-white font-bold text-sm">
                              {featuredMissionFundingGoal
                                ? truncateTokenValue(featuredMissionFundingGoal / 1e18, 'ETH')
                                : '0'}{' '}
                              ETH
                            </p>
                          </div>

                          {/* Backers */}
                          <div className="bg-blue-900/20 rounded-lg p-3 border border-blue-500/10">
                            <div className="flex items-center gap-2 mb-2">
                              <UserGroupIcon className="w-4 h-4 text-blue-400" />
                              <span className="text-blue-200 text-xs font-medium">Backers</span>
                            </div>
                            <p className="text-white font-bold text-sm">
                              {featuredMissionBackers?.length || 0}
                            </p>
                          </div>

                          {/* Time */}
                          <div className="bg-blue-900/20 rounded-lg p-3 border border-blue-500/10">
                            <div className="flex items-center gap-2 mb-2">
                              <TrophyIcon className="w-4 h-4 text-blue-400" />
                              <span className="text-blue-200 text-xs font-medium">Time</span>
                            </div>
                            <p className="text-white font-bold text-sm">
                              {(() => {
                                if (!featuredMissionDeadline)
                                  return (
                                    <span className="flex items-left gap-2">
                                      <LoadingSpinner width="w-4" height="h-4" />
                                    </span>
                                  )

                                const now = Date.now()
                                if (featuredMissionDeadline <= now) return 'Expired'

                                const daysLeft = Math.floor(
                                  (featuredMissionDeadline - now) / (1000 * 60 * 60 * 24)
                                )
                                return daysLeft > 0 ? `${daysLeft}d left` : 'Less than 1d left'
                              })()}
                            </p>
                          </div>
                        </div>
                      </div>
                    ) : (
                      <div className="bg-blue-900/20 rounded-lg p-4 border border-blue-500/10 text-center">
                        <p className="text-blue-200 text-sm mb-2">Mission in Planning</p>
                        <p className="text-white font-medium text-xs">
                          This mission is being prepared for launch
                        </p>
                      </div>
                    )}
                    {/* Action Buttons */}
                    <div className="flex gap-3 pt-2">
                      <StandardButton
                        className="bg-gradient-to-r from-[#6C407D] to-[#5F4BA2] hover:from-[#7A4A8C] hover:to-[#6B57B7] text-white px-4 py-2 rounded-lg text-sm font-medium transition-all w-full"
                        link={`/mission/${featuredMission.id}`}
                      >
                        Contribute
                      </StandardButton>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="text-center py-8">
                  <div className="w-16 h-16 bg-blue-600/20 rounded-xl flex items-center justify-center text-blue-400 mx-auto mb-4">
                    <RocketLaunchIcon className="w-8 h-8" />
                  </div>
                  <h4 className="font-bold text-white text-xl mb-2">Missions Loading</h4>
                  <p className="text-blue-200 text-sm mb-4">
                    We're preparing exciting new missions for space exploration.
                  </p>
                  <div className="text-blue-300 text-xs">Stay tuned for mission updates!</div>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Main Content - Facebook Style Three Column Layout */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 lg:items-start lg:h-full">
          {/* Left Sidebar - Key Metrics & Quick Actions */}
          <div className="lg:col-span-3 flex flex-col space-y-4 h-full order-2 lg:order-1">
            {/* Weekly Reward Pool - Enhanced UI */}
            <div className="order-2">
              <WeeklyRewardPool />
            </div>

            {/* Key Metrics Card */}
            <div className="bg-white/5 backdrop-blur-xl border border-white/10 rounded-2xl p-6 flex-grow order-5">
              <h3 className="font-semibold text-white mb-8 text-lg">DAO Metrics</h3>
              <div className="space-y-8 h-full">
                {citizenSubgraphData?.transfers && citizenSubgraphData?.transfers.length > 0 && (
                  <div
                    className="cursor-pointer transition-all duration-200 hover:bg-white/5 rounded-xl p-6 border border-white/5"
                    onClick={openCitizensChart}
                    title="Click to view full chart"
                  >
                    <div className="flex items-center justify-between mb-5">
                      <span className="text-gray-300 font-medium">Citizens</span>
                      <span className="text-white font-bold text-2xl">
                        {citizenSubgraphData?.transfers?.length || '2,341'}
                      </span>
                    </div>
                    <div className="h-20">
                      <CitizensChart
                        transfers={citizenSubgraphData.transfers}
                        isLoading={false}
                        height={80}
                        compact={true}
                        createdAt={citizenSubgraphData.createdAt}
                      />
                    </div>
                  </div>
                )}

                {aumData && aumData.aumHistory.length > 0 && (
                  <div
                    className="cursor-pointer transition-all duration-200 hover:bg-white/5 rounded-xl p-6 border border-white/5"
                    onClick={openAUMChart}
                    title="Click to view full chart"
                  >
                    <div className="flex items-center justify-between mb-5">
                      <span className="text-gray-300 font-medium">AUM</span>
                      <span className="text-white font-bold text-2xl">
                        ${Math.round(aumData.aum).toLocaleString()}
                      </span>
                    </div>
                    <div className="h-20">
                      <AUMChart compact={true} height={80} data={aumData.aumHistory} />
                    </div>
                  </div>
                )}

                {revenueData && revenueData.revenueHistory.length > 0 && (
                  <div
                    className="cursor-pointer transition-all duration-200 hover:bg-white/5 rounded-xl p-6 border border-white/5"
                    onClick={openRevenueChart}
                    title="Click to view full chart"
                  >
                    <div className="flex items-center justify-between mb-5">
                      <span className="text-gray-300 font-medium">Annual Revenue</span>
                      <span className="text-white font-bold text-2xl">
                        ${Math.round(revenueData.currentRevenue).toLocaleString()}
                      </span>
                    </div>
                    <div className="h-20">
                      <RevenueChart
                        data={revenueData.revenueHistory}
                        compact={true}
                        height={80}
                        isLoading={false}
                      />
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Center Column - Main Feed */}
          <div className="lg:col-span-6 flex flex-col space-y-6 h-full min-h-[800px] order-1 lg:order-2">
            {/* Quick Actions */}
            <div className="bg-white/5 backdrop-blur-xl border border-white/10 rounded-2xl p-6 order-1">
              <div className="flex items-center gap-4 mb-4">
                <div className="w-12 h-12 rounded-full overflow-hidden">
                  {citizen?.metadata?.image ? (
                    <IPFSRenderer
                      src={citizen.metadata.image}
                      alt={citizen.metadata.name}
                      className="w-full h-full object-cover"
                      width={100}
                      height={100}
                    />
                  ) : (
                    <div className="w-full h-full bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center text-white font-bold">
                      {citizen?.metadata?.name?.[0] || address?.[2] || 'G'}
                    </div>
                  )}
                </div>
                <div className="flex-1">
                  <h3 className="text-lg font-semibold text-white mb-1">Quick Actions</h3>
                  <p className="text-white/70 text-sm">What would you like to do today?</p>
                </div>
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <StandardButton
                  className="bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-700 hover:to-blue-800 text-white py-3 rounded-xl font-medium transition-all duration-200 w-full h-12 flex items-center justify-center text-sm gap-1 whitespace-nowrap"
                  link="/proposals"
                >
                  <CheckBadgeIcon className="w-4 h-4" />
                  Propose
                </StandardButton>
                <StandardButton
                  className="bg-gradient-to-r from-purple-600 to-purple-700 hover:from-purple-700 hover:to-purple-800 text-white py-3 rounded-xl font-medium transition-all duration-200 w-full h-12 flex items-center justify-center text-sm gap-1 whitespace-nowrap"
                  link="/launchpad"
                >
                  <RocketLaunchIcon className="w-4 h-4" />
                  Launch
                </StandardButton>
                <StandardButton
                  className="bg-gradient-to-r from-green-600 to-green-700 hover:from-green-700 hover:to-green-800 text-white py-3 rounded-xl font-medium transition-all duration-200 w-full h-12 flex items-center justify-center text-sm gap-1 whitespace-nowrap"
                  link="/team"
                >
                  <UserGroupIcon className="w-4 h-4" />
                  Join Team
                </StandardButton>
                <StandardButton
                  className="bg-gradient-to-r from-orange-600 to-orange-700 hover:from-orange-700 hover:to-orange-800 text-white py-3 rounded-xl font-medium transition-all duration-200 w-full h-12 flex items-center justify-center text-sm gap-1 whitespace-nowrap"
                  link="/marketplace"
                >
                  <ShoppingBagIcon className="w-4 h-4" />
                  Shop
                </StandardButton>
              </div>
            </div>

            {/* Activity Feed */}
            <div className="bg-white/5 backdrop-blur-xl border border-white/10 rounded-2xl p-6 order-2">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between mb-6 gap-3 sm:gap-0">
                <h3 className="text-xl font-bold text-white whitespace-nowrap">
                  Recent Newsletters
                </h3>
                <div className="flex gap-2 flex-shrink-0">
                  <StandardButton
                    className="bg-blue-600/20 hover:bg-blue-600/40 text-blue-300 text-sm px-4 py-2 rounded-lg transition-all whitespace-nowrap"
                    link="/news"
                  >
                    View All
                  </StandardButton>
                  <StandardButton
                    className="bg-purple-600/20 hover:bg-purple-600/40 text-purple-300 text-sm px-4 py-2 rounded-lg transition-all whitespace-nowrap"
                    onClick={() => setNewsletterModalOpen(true)}
                  >
                    Subscribe
                  </StandardButton>
                </div>
              </div>

              <div className="space-y-4">
                {newslettersLoading ? (
                  <div className="text-center py-8">
                    <div className="text-white/60">Loading newsletters...</div>
                  </div>
                ) : clientNewsletters && clientNewsletters.length > 0 ? (
                  clientNewsletters.slice(0, 4).map((newsletter: any, index: number) => (
                    <div
                      key={newsletter.id || index}
                      className="bg-white/5 rounded-xl p-4 hover:bg-white/10 transition-all cursor-pointer border border-white/5"
                      onClick={() => {
                        if (
                          newsletter.url &&
                          newsletter.url !== 'https://news.moondao.com/posts' &&
                          newsletter.url !== 'https://moondao.kit.com/posts' &&
                          newsletter.url.includes('http')
                        ) {
                          window.open(newsletter.url, '_blank')
                        } else {
                          window.open('https://news.moondao.com/posts', '_blank')
                        }
                      }}
                    >
                      <div className="flex items-start gap-4">
                        <div className="w-12 h-12 rounded-full overflow-hidden flex items-center justify-center bg-blue-600">
                          {newsletter.image ? (
                            <IPFSRenderer
                              src={newsletter.image}
                              alt={newsletter.title}
                              className="w-full h-full object-cover"
                              width={100}
                              height={100}
                            />
                          ) : (
                            <NewspaperIcon className="w-6 h-6 text-white" />
                          )}
                        </div>
                        <div className="flex-1">
                          <p className="text-white font-medium mb-1">
                            {newsletter.title || 'Newsletter Update'}
                          </p>
                          {newsletter.description && (
                            <p className="text-gray-300 text-sm mb-2 line-clamp-2">
                              {newsletter.description}
                            </p>
                          )}
                          <div className="flex items-center gap-4 text-sm text-gray-400">
                            <span>
                              {newsletter.publishedAt
                                ? new Date(newsletter.publishedAt).toLocaleDateString()
                                : 'Recently'}
                            </span>
                            {newsletter.views && newsletter.views > 0 && (
                              <>
                                <span>•</span>
                                <span>{newsletter.views} recipients</span>
                              </>
                            )}
                            {newsletter.readTime && (
                              <>
                                <span>•</span>
                                <span>{newsletter.readTime} min read</span>
                              </>
                            )}
                            {newsletter.isArchived && (
                              <>
                                <span>•</span>
                                <span className="text-orange-400">Archive</span>
                              </>
                            )}
                          </div>
                        </div>
                        <div
                          className="text-gray-400 hover:text-white transition-colors"
                          title="Click to view newsletter"
                        >
                          <svg
                            className="w-5 h-5"
                            fill="none"
                            stroke="currentColor"
                            viewBox="0 0 24 24"
                          >
                            <path
                              strokeLinecap="round"
                              strokeLinejoin="round"
                              strokeWidth={2}
                              d="M19 20H5a2 2 0 01-2-2V6a2 2 0 012-2h10a2 2 0 012 2v1m2 13a2 2 0 01-2-2V7m2 13a2 2 0 002-2V9a2 2 0 00-2-2h-2m-4-3H9M7 16h6M7 8h6v4H7V8z"
                            />
                          </svg>
                        </div>
                      </div>
                    </div>
                  ))
                ) : (
                  <div className="text-center py-16 min-h-[300px] flex flex-col justify-center">
                    <NewspaperIcon className="w-12 h-12 text-gray-500 mx-auto mb-3" />
                    <p className="text-gray-400 text-sm">No newsletters available</p>
                    <p className="text-gray-500 text-xs mt-1">Check back soon for updates</p>
                  </div>
                )}
              </div>
            </div>

            {/* Active Proposals Card */}
            <div className="bg-white/5 backdrop-blur-xl border border-white/10 rounded-2xl p-6 flex-grow order-4">
              <div className="flex items-center justify-between mb-6">
                <h3 className="text-xl font-bold text-white">Latest Proposals</h3>
                <StandardButton
                  className="bg-blue-600/20 hover:bg-blue-600/40 text-blue-300 text-sm px-4 py-2 rounded-lg transition-all"
                  link="/projects"
                >
                  View All
                </StandardButton>
              </div>

              <ProposalList noPagination compact proposalLimit={2} projects={proposals} />
            </div>
          </div>

          {/* Right Sidebar - Community & Stats */}
          <div className="lg:col-span-3 flex flex-col space-y-4 h-full min-h-[800px] order-4 lg:order-3">
            {/* Claim Rewards Section */}
            {address && <ClaimRewardsSection />}

            {/* Recent Citizens */}
            <div className="bg-white/5 backdrop-blur-xl border border-white/10 rounded-2xl p-6">
              <div className="flex items-center justify-between mb-4">
                <h3 className="font-semibold text-white text-lg">New Citizens</h3>
                <StandardButton
                  className="text-blue-300 text-sm hover:text-blue-200 transition-all"
                  link="/network?tab=citizens"
                >
                  See all
                </StandardButton>
              </div>

              <div className="space-y-3">
                {newestCitizens && newestCitizens.length > 0 ? (
                  newestCitizens.slice(0, 5).map((citizen: any) => (
                    <Link
                      key={citizen.id}
                      href={`/citizen/${
                        citizen.name && citizen.id
                          ? generatePrettyLinkWithId(citizen.name, citizen.id)
                          : citizen.id || 'anonymous'
                      }`}
                      className="flex items-center gap-3 p-3 hover:bg-white/5 rounded-xl transition-all cursor-pointer"
                    >
                      <div className="w-10 h-10 rounded-lg overflow-hidden flex items-center justify-center">
                        {citizen.image ? (
                          <IPFSRenderer
                            src={citizen.image}
                            alt={citizen.name}
                            className="w-full h-full object-cover"
                            width={100}
                            height={100}
                          />
                        ) : (
                          <div className="w-full h-full bg-gradient-to-br from-green-500 to-blue-600 rounded-lg flex items-center justify-center text-white font-bold text-sm">
                            {citizen.name?.[0] || 'C'}
                          </div>
                        )}
                      </div>
                      <div className="flex-1 min-w-0">
                        <h4 className="text-white font-medium text-sm truncate">
                          {citizen.name || 'Anonymous'}
                        </h4>
                      </div>
                    </Link>
                  ))
                ) : (
                  <div className="text-gray-400 text-sm text-center py-4">Loading...</div>
                )}
              </div>
            </div>

            {/* Featured Teams */}
            <div className="bg-white/5 backdrop-blur-xl border border-white/10 rounded-2xl p-6">
              <div className="flex items-center justify-between mb-4">
                <h3 className="font-semibold text-white text-lg">Featured Teams</h3>
                <StandardButton
                  className="text-blue-300 text-sm hover:text-blue-200 transition-all"
                  link="/network?tab=teams"
                >
                  See all
                </StandardButton>
              </div>

              <div className="space-y-3">
                {filteredTeams && filteredTeams.length > 0 ? (
                  filteredTeams.slice(0, 5).map((team: any, index: number) => (
                    <Link key={team.id || index} href={`/team/${generatePrettyLink(team.name)}`}>
                      <div className="flex items-center gap-3 p-3 hover:bg-white/5 rounded-xl transition-all cursor-pointer">
                        <div className="w-10 h-10 rounded-lg overflow-hidden flex items-center justify-center">
                          {team.image ? (
                            <IPFSRenderer
                              src={team.image}
                              alt={team.name}
                              className="w-full h-full object-cover"
                              width={100}
                              height={100}
                            />
                          ) : (
                            <div className="w-full h-full bg-gradient-to-br from-blue-500 to-purple-600 rounded-lg flex items-center justify-center text-white font-bold text-sm">
                              {team.name?.[0] || 'T'}
                            </div>
                          )}
                        </div>
                        <div className="flex-1 min-w-0">
                          <h4 className="text-white font-medium text-sm truncate">
                            {team.name || 'Team'}
                          </h4>
                        </div>
                      </div>
                    </Link>
                  ))
                ) : (
                  <div className="flex items-center gap-3 p-3 hover:bg-white/5 rounded-xl transition-all cursor-pointer">
                    <div className="w-10 h-10 bg-gradient-to-br from-blue-500 to-purple-600 rounded-lg flex items-center justify-center text-white">
                      M
                    </div>
                    <div className="flex-1">
                      <h4 className="text-white font-medium text-sm">Mission Control</h4>
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* Open Jobs */}
            <div className="bg-white/5 backdrop-blur-xl border border-white/10 rounded-2xl p-6 flex-grow">
              <div className="flex items-center justify-between mb-4">
                <h3 className="font-semibold text-white text-lg">Open Jobs</h3>
                <StandardButton
                  className="text-blue-300 text-sm hover:text-blue-200 transition-all"
                  link="/jobs"
                >
                  See all
                </StandardButton>
              </div>

              <div className="space-y-3 h-full overflow-y-auto">
                {newestJobs && newestJobs.length > 0 ? (
                  <Link href={newestJobs[0]?.contactInfo || '/jobs'} className="block">
                    <div className="flex items-center gap-3 p-3 hover:bg-white/5 rounded-xl transition-all cursor-pointer">
                      <div className="w-10 h-10 rounded-lg overflow-hidden flex items-center justify-center">
                        <div className="w-full h-full bg-gradient-to-br from-blue-500 to-purple-600 rounded-lg flex items-center justify-center text-white font-bold text-sm">
                          <BriefcaseIcon className="w-5 h-5" />
                        </div>
                      </div>
                      <div className="flex-1 min-w-0">
                        <h4 className="text-white font-medium text-sm truncate">
                          {newestJobs[0]?.title}
                        </h4>
                        <p className="text-gray-400 text-xs">
                          {newestJobs.length > 1
                            ? `+${newestJobs.length - 1} more positions`
                            : 'Click to apply'}
                        </p>
                      </div>
                    </div>
                  </Link>
                ) : (
                  <Link href="/jobs" className="block">
                    <div className="flex items-center gap-3 p-3 hover:bg-white/5 rounded-xl transition-all cursor-pointer">
                      <div className="w-10 h-10 bg-gradient-to-br from-blue-500 to-purple-600 rounded-lg flex items-center justify-center text-white">
                        <BriefcaseIcon className="w-5 h-5" />
                      </div>
                      <div className="flex-1">
                        <h4 className="text-white font-medium text-sm">No open positions</h4>
                        <p className="text-gray-400 text-xs">Check back soon for opportunities</p>
                      </div>
                    </div>
                  </Link>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Quests Section */}
        <div className="flex-grow order-5 bg-white/5 backdrop-blur-xl border border-white/10 rounded-2xl p-6 mt-8 mb-8">
          <div className="flex flex-col gap-4">
            <div>
              <h3 className="text-2xl font-bold text-white flex items-center gap-2">
                <TrophyIcon className="w-7 h-7 text-yellow-400" />
                Quests
              </h3>
              <p className="text-slate-300 text-sm mt-2">Complete quests to earn XP and level up</p>
            </div>

            <DashboardQuests selectedChain={selectedChain} />
          </div>
        </div>

        {/* Active Projects Section - Full Width */}
        <div className="bg-gradient-to-br from-green-600/20 to-emerald-800/20 backdrop-blur-xl border border-green-500/20 rounded-2xl p-8 mt-8 mb-8">
          <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-6 mb-8">
            <div className="flex flex-col lg:flex-row lg:items-center gap-6">
              <div>
                <h3 className="text-3xl font-bold text-white flex items-center gap-3 mb-3">
                  <RocketLaunchIcon className="w-8 h-8" />
                  Active Projects
                </h3>
                <p className="text-green-200 text-base">
                  Contribute to space exploration initiatives and make history
                </p>
              </div>

              {/* Stats next to title */}
              <div className="flex gap-4">
                <div className="bg-black/20 rounded-xl px-5 py-3 border border-green-500/20">
                  <div className="text-xl font-bold text-white">{Math.round(ETH_BUDGET)} ETH</div>
                  <div className="text-green-200 text-sm">Quarterly Budget</div>
                </div>
                <div className="bg-black/20 rounded-xl px-5 py-3 border border-green-500/20">
                  <div className="text-xl font-bold text-white">{currentProjects?.length || 0}</div>
                  <div className="text-green-200 text-sm">Total Projects</div>
                </div>
              </div>
            </div>

            {/* Buttons on the right */}
            <div className="flex gap-4">
              <StandardButton
                className="bg-blue-600/20 hover:bg-blue-600/40 text-blue-300 px-8 py-4 rounded-xl font-medium transition-all text-base"
                link="/proposals"
              >
                Propose Project
              </StandardButton>
              <StandardButton
                className="bg-green-600 hover:bg-green-700 text-white px-8 py-4 rounded-xl font-semibold shadow-lg transition-all text-base"
                link="/projects"
              >
                View All Projects
              </StandardButton>
            </div>
          </div>

          {currentProjects && currentProjects.length > 0 ? (
            <div>
              {/* Projects Grid - Larger cards with fewer columns for better visibility */}
              <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
                {currentProjects.slice(0, 6).map((project: any, index: number) => (
                  <div key={index}>
                    <ProjectCard
                      project={project}
                      projectContract={projectContract}
                      hatsContract={hatsContract}
                      userHasVotingPower={!!walletVP}
                      isVotingPeriod={false}
                      distribute={false}
                    />
                  </div>
                ))}

                {/* Show more projects indicator if there are more than 6 */}
                {currentProjects.length > 6 && (
                  <div className="bg-black/30 rounded-xl p-6 border border-green-500/10 min-h-[200px] flex items-center justify-center hover:bg-black/40 hover:border-green-500/20 transition-all duration-300">
                    <div className="text-center">
                      <div className="text-2xl font-bold text-green-300 mb-2">
                        +{currentProjects.length - 6}
                      </div>
                      <p className="text-green-200 text-sm mb-4">More Projects Available</p>
                      <StandardButton
                        className="bg-green-600/30 hover:bg-green-600/50 text-green-300 text-sm px-6 py-3 rounded-xl transition-all font-medium"
                        link="/projects"
                      >
                        View All Projects
                      </StandardButton>
                    </div>
                  </div>
                )}
              </div>
            </div>
          ) : (
            <div className="bg-black/20 rounded-xl p-12 border border-green-500/20 min-h-[300px] flex items-center justify-center">
              <div className="text-center max-w-md">
                <RocketLaunchIcon className="w-20 h-20 text-gray-500 mx-auto mb-6" />
                <h4 className="font-bold text-white text-2xl mb-3">No Active Projects</h4>
                <p className="text-gray-400 text-base mb-6 leading-relaxed">
                  Check back soon for new space exploration initiatives and opportunities to
                  contribute to groundbreaking missions
                </p>
                <div className="flex flex-col sm:flex-row gap-3 justify-center">
                  <StandardButton
                    className="bg-green-600/20 hover:bg-green-600/40 text-green-300 px-8 py-3 rounded-xl transition-all font-medium"
                    link="/projects"
                  >
                    View All Projects
                  </StandardButton>
                  <StandardButton
                    className="bg-blue-600/20 hover:bg-blue-600/40 text-blue-300 px-8 py-3 rounded-xl transition-all font-medium"
                    link="/proposals"
                  >
                    Propose a Project
                  </StandardButton>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Marketplace Section - Full Width */}
        <div className="mt-8 mb-8">
          <NewMarketplaceListings
            selectedChain={selectedChain}
            teamContract={teamContract}
            marketplaceTableContract={marketplaceTableContract}
          />
        </div>

        {/* Events and Your Teams Section - Side by Side */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 mt-8 mb-8">
          {/* Events Section */}
          <div className="bg-white/5 backdrop-blur-xl border border-white/10 rounded-2xl p-4 sm:p-6 lg:p-8">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
              <div className="min-w-0 flex-1">
                <h3 className="text-lg sm:text-xl lg:text-2xl font-bold text-white mb-2 flex items-center gap-2">
                  <NewspaperIcon className="w-5 h-5 sm:w-6 sm:h-6 lg:w-7 lg:h-7 flex-shrink-0" />
                  <span className="leading-tight">Upcoming Events</span>
                </h3>
                <p className="text-gray-300 text-sm sm:text-base leading-tight">
                  Join the community events and discussions
                </p>
              </div>
            </div>

            <div className="relative">
              <div
                id="luma-loading-dashboard-small"
                className="absolute inset-0 bg-gray-800/20 rounded-lg flex items-center justify-center min-h-[500px]"
              >
                <div className="text-white text-center">
                  <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-white mx-auto mb-2"></div>
                  <p className="text-xs">Loading events...</p>
                </div>
              </div>
              <iframe
                src="https://lu.ma/embed/calendar/cal-7mKdy93TZVlA0Xh/events?lt=dark"
                width="100%"
                height="600"
                frameBorder="0"
                style={{ border: '1px solid #ffffff20', borderRadius: '8px' }}
                allowFullScreen
                aria-hidden="false"
                tabIndex={0}
                className="rounded-lg relative z-10"
                loading="lazy"
                referrerPolicy="no-referrer-when-downgrade"
                title="MoonDAO Events Calendar"
                onLoad={(e) => {
                  const loadingDiv = document.getElementById('luma-loading-dashboard-small')
                  if (loadingDiv) {
                    loadingDiv.style.display = 'none'
                  }
                }}
              />
            </div>
          </div>

          {/* Your Teams Section */}
          <div className="bg-white/5 backdrop-blur-xl border border-white/10 rounded-2xl p-4 sm:p-6 lg:p-8">
            <div className="mb-6">
              <div className="min-w-0 flex-1">
                <h3 className="text-lg sm:text-xl lg:text-2xl font-bold text-white mb-2 flex items-center gap-2">
                  <UserGroupIcon className="w-5 h-5 sm:w-6 sm:h-6 lg:w-7 lg:h-7 flex-shrink-0" />
                  <span className="leading-tight">Your Teams</span>
                </h3>
              </div>
            </div>

            <div className="space-y-3">
              <DashboardTeams
                selectedChain={selectedChain}
                hatsContract={hatsContract}
                teamContract={teamContract}
              />
            </div>
          </div>
        </div>

        {/* Global Community Map - Enhanced */}
        <div className="bg-white/5 backdrop-blur-xl border border-white/10 rounded-2xl p-4 sm:p-6 lg:p-8 mb-8">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
            <div className="min-w-0 flex-1">
              <h3 className="text-lg sm:text-xl lg:text-2xl font-bold text-white mb-2 flex items-center gap-2">
                <GlobeAmericasIcon className="w-5 h-5 sm:w-6 sm:h-6 lg:w-7 lg:h-7 flex-shrink-0" />
                <span className="leading-tight">Global Community</span>
              </h3>
              <p className="text-gray-300 text-sm sm:text-base leading-tight">
                MoonDAO citizens around the world
              </p>
            </div>
            <StandardButton
              className="bg-teal-600 hover:bg-teal-700 text-white px-4 py-2 sm:px-6 sm:py-3 rounded-xl font-semibold transition-all text-sm sm:text-base whitespace-nowrap flex-shrink-0"
              link="/map"
            >
              Explore Map
            </StandardButton>
          </div>

          <div className="relative w-full h-[400px] sm:h-[500px] lg:h-[650px] xl:h-[700px] bg-gradient-to-br from-blue-900/30 to-purple-900/30 rounded-2xl overflow-hidden">
            <div className="absolute inset-0 flex items-center justify-center">
              <div className="flex items-center justify-center">
                <Earth
                  pointsData={citizensLocationData || []}
                  width={undefined}
                  height={undefined}
                />
              </div>
            </div>

            {/* Enhanced Stats overlay with glassmorphism */}
            <div className="absolute top-3 left-3 sm:top-4 sm:left-4 lg:top-6 lg:left-6 bg-black/40 backdrop-blur-lg rounded-xl sm:rounded-2xl p-3 sm:p-4 lg:p-6 border border-white/10 max-w-[120px] sm:max-w-none">
              <div className="text-white">
                <div className="text-lg sm:text-2xl lg:text-3xl font-bold mb-1 leading-tight">
                  {citizenSubgraphData?.transfers?.length || '145'}
                </div>
                <div className="text-xs sm:text-sm opacity-90 leading-tight">Global Citizens</div>
              </div>
            </div>

            <div className="absolute top-3 right-3 sm:top-4 sm:right-4 lg:top-6 lg:right-6 bg-black/40 backdrop-blur-lg rounded-xl sm:rounded-2xl p-3 sm:p-4 lg:p-6 border border-white/10 max-w-[120px] sm:max-w-none">
              <div className="text-white">
                <div className="text-lg sm:text-2xl lg:text-3xl font-bold mb-1 leading-tight">
                  {countUniqueCountries(citizensLocationData)} {/* Unique countries */}
                </div>
                <div className="text-xs sm:text-sm opacity-90 leading-tight">Countries</div>
              </div>
            </div>

            <div className="absolute bottom-3 left-3 sm:bottom-4 sm:left-4 lg:bottom-6 lg:left-6 bg-black/40 backdrop-blur-lg rounded-xl sm:rounded-2xl p-3 sm:p-4 lg:p-6 border border-white/10 max-w-[120px] sm:max-w-none">
              <div className="text-white">
                <div className="text-lg sm:text-2xl lg:text-3xl font-bold mb-1 leading-tight">
                  24/7
                </div>
                <div className="text-xs sm:text-sm opacity-90 leading-tight">Active Community</div>
              </div>
            </div>

            <div className="absolute bottom-3 right-3 sm:bottom-4 sm:right-4 lg:bottom-6 lg:right-6 bg-black/40 backdrop-blur-lg rounded-xl sm:rounded-2xl p-3 sm:p-4 lg:p-6 border border-white/10 max-w-[120px] sm:max-w-none">
              <div className="text-white">
                <div className="text-lg sm:text-2xl lg:text-3xl font-bold mb-1 leading-tight">
                  {filteredTeams?.length || '0'}
                </div>
                <div className="text-xs sm:text-sm opacity-90 leading-tight">Total Teams</div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Chart Modal */}
      <ChartModal
        isOpen={chartModalOpen}
        setIsOpen={setChartModalOpen}
        chartComponent={chartModalComponent}
        chartTitle={chartModalTitle}
      />

      {/* Newsletter Modal */}
      {newsletterModalOpen && <NewsletterSubModal setEnabled={setNewsletterModalOpen} />}

      {/* Citizen Metadata Modal */}
      {citizenMetadataModalEnabled && citizen && (
        <CitizenMetadataModal
          nft={citizen}
          selectedChain={selectedChain}
          setEnabled={setCitizenMetadataModalEnabled}
        />
      )}

      {/* Extended Footer */}
      <ExpandedFooter hasCallToAction={false} darkBackground={true} isFullwidth={true} />
    </Container>
  )
}
