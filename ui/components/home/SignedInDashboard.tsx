import {
  RocketLaunchIcon,
  BanknotesIcon,
  CheckBadgeIcon,
  UserGroupIcon,
  ShoppingBagIcon,
  NewspaperIcon,
  GlobeAmericasIcon,
  BriefcaseIcon,
  TrophyIcon,
  CalendarDaysIcon,
  WalletIcon,
  ClipboardDocumentIcon,
  PlusIcon,
  ArrowUpRightIcon,
} from '@heroicons/react/24/outline'
import { useFundWallet, usePrivy } from '@privy-io/react-auth'
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
import {
  getMissionMinimumUsdGoal,
  MISSION_MINIMUM_GOAL_TOOLTIP,
} from 'const/missionMilestones'
import dynamic from 'next/dynamic'
import Image from 'next/image'
import Link from 'next/link'
import { useRouter } from 'next/router'
import { useContext, useMemo, useState } from 'react'
import { toast } from 'react-hot-toast'
import { useActiveAccount } from 'thirdweb/react'
import CitizenContext from '@/lib/citizen/citizen-context'
import { shouldShowTeamsSection } from '@/lib/dashboard/shouldShowTeamsSection'
import { useNewsletters } from '@/lib/home/useHomeData'
import { useTeamWearer } from '@/lib/hats/useTeamWearer'
import { getLinkedEvmAddresses } from '@/lib/privy/linkedEvmAddresses'
import useMissionData from '@/lib/mission/useMissionData'
import { PROJECT_ACTIVE, PROJECT_PENDING } from '@/lib/nance/types'
import { generatePrettyLink, generatePrettyLinkWithId } from '@/lib/subscription/pretty-links'
import { getChainSlug } from '@/lib/thirdweb/chain'
import ChainContextV5 from '@/lib/thirdweb/chain-context-v5'
import useContract from '@/lib/thirdweb/hooks/useContract'
import { useNativeBalance } from '@/lib/thirdweb/hooks/useNativeBalance'
import { useTotalLockedMooney } from '@/lib/tokens/hooks/useTotalLockedMooney'
import { useTotalMooneyBalance } from '@/lib/tokens/hooks/useTotalMooneyBalance'
import { useTotalVMOONEY } from '@/lib/tokens/hooks/useTotalVMOONEY'
import { useTotalVP } from '@/lib/tokens/hooks/useTotalVP'
import { truncateTokenValue } from '@/lib/utils/numbers'
import { networkCard } from '@/lib/layout/styles'
import ClaimRewardsSection from '@/components/home/ClaimRewardsSection'
import WalletInfoCard from '@/components/home/WalletInfoCard'
import Container from '@/components/layout/Container'
import { ExpandedFooter } from '@/components/layout/ExpandedFooter'
import { LoadingSpinner } from '@/components/layout/LoadingSpinner'
import StandardButton from '@/components/layout/StandardButton'
import Tooltip from '@/components/layout/Tooltip'
import { NewsletterSubModal } from '@/components/newsletter/NewsletterSubModal'
import { SendModal } from '@/components/privy/PrivyConnectWallet'
import { useWalletTokens } from '@/components/privy/PrivyConnectWallet'
import ProjectCard from '@/components/project/ProjectCard'
import CitizenMetadataModal from '@/components/subscription/CitizenMetadataModal'
import WeeklyRewardPool from '@/components/tokens/WeeklyRewardPool'
import IPFSRenderer from '../layout/IPFSRenderer'
import ProposalList from '../nance/ProposalList'
import NewMarketplaceListings from '../subscription/NewMarketplaceListings'
import DashboardActiveProjects from '../project/DashboardActiveProjects'
import DashboardQuests from './DashboardQuests'
import DashboardTeams from './DashboardTeams'
import LazyEarth from '@/components/globe/LazyEarth'

// Parse citizen location from Tableland (can be JSON or plain string)
function getCitizenLocation(citizen: any): string | null {
  const loc = citizen?.location ?? citizen?.metadata?.attributes?.find((a: any) => a.trait_type === 'location')?.value
  if (!loc || typeof loc !== 'string') return null
  const trimmed = loc.trim()
  if (!trimmed || trimmed.startsWith('[object')) return null
  try {
    if (trimmed.startsWith('{')) {
      const parsed = JSON.parse(trimmed)
      return parsed?.name || null
    }
    return trimmed
  } catch {
    return trimmed
  }
}

// Get citizen metadata for card (location, or fallback to twitter/discord handle)
function getCitizenMetadata(citizen: any): string | null {
  const location = getCitizenLocation(citizen)
  if (location) return location
  const twitter = citizen?.twitter ?? citizen?.metadata?.attributes?.find((a: any) => a.trait_type === 'twitter')?.value
  if (twitter) {
    const handle = twitter.includes('twitter.com/') ? '@' + twitter.split('twitter.com/').pop()?.split(/[?/]/)[0] : twitter
    return handle?.length > 25 ? handle.slice(0, 22) + '…' : handle
  }
  const discord = citizen?.discord ?? citizen?.metadata?.attributes?.find((a: any) => a.trait_type === 'discord')?.value
  if (discord) return discord.length > 25 ? discord.slice(0, 22) + '…' : discord
  return null
}

// Get team metadata for card (description preview, communications, or website)
function getTeamMetadata(team: any): string | null {
  const desc = (team?.description ?? team?.metadata?.description ?? '').replace(/<[^>]*>/g, '').trim()
  if (desc) return desc.length > 60 ? desc.slice(0, 57) + '…' : desc
  const comms = team?.communications ?? team?.metadata?.attributes?.find((a: any) => a.trait_type === 'communications')?.value
  if (comms) return comms.length > 40 ? comms.slice(0, 37) + '…' : comms
  const website = team?.website ?? team?.metadata?.attributes?.find((a: any) => a.trait_type === 'website')?.value
  if (website) {
    try {
      const url = new URL(website.startsWith('http') ? website : `https://${website}`)
      return url.hostname.replace(/^www\./, '')
    } catch {
      return website.length > 30 ? website.slice(0, 27) + '…' : website
    }
  }
  return null
}

// Count citizens from location data (sum of citizens in each group)
function countCitizensFromLocationData(locations: any[]): number {
  if (!locations || locations.length === 0) return 0
  try {
    return locations.reduce((sum, g) => sum + (g.citizens?.length || 0), 0)
  } catch {
    return 0
  }
}

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
  filteredTeams,
  projects,
  missions,
  featuredMissionData,
  citizensLocationData = [],
  citizensCount = 0,
}: any) {
  const proposals = []
  const currentProjects = []
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
  currentProjects.sort((a, b) => {
    if (a.eligible === b.eligible) {
      return 0
    }
    return a.eligible ? 1 : -1
  })
  const selectedChain = DEFAULT_CHAIN_V5
  const chainSlug = getChainSlug(selectedChain)

  const router = useRouter()
  const { fundWallet } = useFundWallet()

  const { citizen } = useContext(CitizenContext)

  // Send modal state
  const [sendModalEnabled, setSendModalEnabled] = useState(false)

  // Newsletter modal state
  const [newsletterModalOpen, setNewsletterModalOpen] = useState(false)

  // Citizen metadata modal state
  const [citizenMetadataModalEnabled, setCitizenMetadataModalEnabled] = useState(false)

  // Newsletter data (fetched via SWR with caching)
  const { newsletters: clientNewsletters, isLoading: newslettersLoading } = useNewsletters()

  const account = useActiveAccount()
  const address = account?.address
  const { user } = usePrivy()
  const wearerAddresses = useMemo(
    () => getLinkedEvmAddresses(user, account?.address),
    [user, account?.address]
  )

  // Hooks for SendModal
  const { nativeBalance } = useNativeBalance()
  const { tokens: walletTokens } = useWalletTokens(address, chainSlug)

  const { balance: MOONEYBalance, isLoading: isLoadingMOONEY } = useTotalMooneyBalance(address)
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
    wearerAddresses
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
  })

  const featuredMinUsdGoal = getMissionMinimumUsdGoal(featuredMission?.id)

  return (
    <Container>
      <div className="max-w-7xl mx-auto px-4 py-4">
        {/* Main Content - Facebook Style Three Column Layout */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 lg:items-start lg:h-full">
          {/* Left Sidebar - Key Metrics & Quick Actions */}
          <div className="lg:col-span-3 flex flex-col space-y-4 h-full order-2 lg:order-1">
            {/* Your Profile */}
            <div className="bg-white/5 backdrop-blur-xl border border-white/10 rounded-2xl p-6 order-1">
              <div className="flex items-center justify-between mb-4">
                <h3 className="font-semibold text-white text-lg">Your Profile</h3>
                {citizen && (
                  <StandardButton
                    className="text-blue-300 text-sm hover:text-blue-200 transition-all"
                    link={
                      citizen?.metadata?.name && (citizen?.metadata?.id ?? citizen?.id)
                        ? `/citizen/${generatePrettyLinkWithId(
                            citizen.metadata.name,
                            citizen.metadata?.id ?? citizen.id
                          )}`
                        : '/join'
                    }
                  >
                    View profile
                  </StandardButton>
                )}
              </div>
              {citizen ? (
                <Link
                  href={
                    citizen?.metadata?.name && (citizen?.metadata?.id ?? citizen?.id)
                      ? `/citizen/${generatePrettyLinkWithId(
                          citizen.metadata.name,
                          citizen.metadata?.id ?? citizen.id
                        )}`
                      : '/join'
                  }
                  className="flex items-center gap-3 hover:bg-white/5 rounded-xl transition-all cursor-pointer p-3"
                >
                  <div className="w-12 h-12 rounded-lg overflow-hidden flex-shrink-0 flex items-center justify-center">
                    {citizen?.metadata?.image ? (
                      <IPFSRenderer
                        src={citizen.metadata.image}
                        alt={citizen.metadata.name}
                        className="w-full h-full object-cover"
                        width={48}
                        height={48}
                      />
                    ) : (
                      <div className="w-full h-full bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center">
                        <span className="text-white font-bold text-lg">
                          {citizen?.metadata?.name?.[0] || address?.[2] || 'M'}
                        </span>
                      </div>
                    )}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-white font-medium truncate">
                      {citizen?.metadata?.name || 'Anonymous'}
                    </p>
                    <p className="text-white/60 text-sm truncate">Edit profile & settings</p>
                  </div>
                  <ArrowUpRightIcon className="w-4 h-4 text-white/40 flex-shrink-0" />
                </Link>
              ) : (
                <Link
                  href="/join"
                  className="flex items-center gap-3 hover:bg-white/5 rounded-xl transition-all cursor-pointer p-3 border border-dashed border-white/20"
                >
                  <div className="w-12 h-12 rounded-lg bg-white/5 flex items-center justify-center flex-shrink-0">
                    <UserGroupIcon className="w-6 h-6 text-white/40" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-white font-medium">Become a citizen</p>
                    <p className="text-white/60 text-sm">Create your profile to join the network</p>
                  </div>
                  <ArrowUpRightIcon className="w-4 h-4 text-white/40 flex-shrink-0" />
                </Link>
              )}
            </div>

            {/* Weekly Reward Pool - Enhanced UI */}
            <div className="order-2">
              <WeeklyRewardPool />
            </div>

            {/* New Citizens */}
            <div className="bg-white/5 backdrop-blur-xl border border-white/10 rounded-2xl p-4 flex-grow flex flex-col min-h-[320px] order-5">
              <div className="flex items-center justify-between mb-2">
                <h3 className="font-semibold text-white text-xl">New Citizens</h3>
                <StandardButton
                  className="text-blue-300 text-sm hover:text-blue-200 transition-all py-1 px-2"
                  link="/network?tab=citizens"
                >
                  See all
                </StandardButton>
              </div>

              <div className="flex flex-col gap-1 flex-1 min-h-0">
                {newestCitizens && newestCitizens.length > 0 ? (
                  newestCitizens.slice(0, 8).map((citizen: any) => {
                    const metadata = getCitizenMetadata(citizen)
                    const bio = (citizen.description || citizen.metadata?.description || '')
                      .replace(/<[^>]*>/g, '')
                      .trim()
                    const bioPreview = bio ? (bio.length > 60 ? `${bio.slice(0, 60)}…` : bio) : null
                    return (
                      <Link
                        key={citizen.id}
                        href={`/citizen/${
                          citizen.name && citizen.id
                            ? generatePrettyLinkWithId(citizen.name, citizen.id)
                            : citizen.id || 'anonymous'
                        }`}
                        className="flex items-start gap-3 hover:bg-white/5 rounded-lg transition-all cursor-pointer p-2"
                      >
                        <div className="w-16 h-16 rounded-lg overflow-hidden flex-shrink-0 flex items-center justify-center">
                          {citizen.image || citizen.metadata?.image ? (
                            <IPFSRenderer
                              src={citizen.image || citizen.metadata?.image}
                              alt={citizen.name}
                              className="w-full h-full object-cover"
                              width={64}
                              height={64}
                            />
                          ) : (
                            <div className="w-full h-full bg-gradient-to-br from-green-500 to-blue-600 rounded-lg flex items-center justify-center text-white font-bold text-lg">
                              {citizen.name?.[0] || 'C'}
                            </div>
                          )}
                        </div>
                        <div className="min-w-0 flex-1">
                          <h4 className="text-white font-medium text-base truncate">
                            {citizen.name || 'Anonymous'}
                          </h4>
                          {(metadata || bioPreview) && (
                            <p className="text-white/50 text-sm leading-snug mt-0.5 line-clamp-2">
                              {[metadata, bioPreview].filter(Boolean).join(' · ')}
                            </p>
                          )}
                        </div>
                      </Link>
                    )
                  })
                ) : (
                  <div className="text-gray-400 text-sm py-4 text-center">Loading...</div>
                )}
              </div>
            </div>
          </div>

          {/* Center Column - Main Feed */}
          <div className="lg:col-span-6 flex flex-col space-y-6 h-full min-h-[800px] order-1 lg:order-2">
            {/* Activity Feed */}
            <div className="bg-white/5 backdrop-blur-xl border border-white/10 rounded-2xl p-6 order-1">
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
                  <StandardButton
                    className="bg-indigo-600/20 hover:bg-indigo-600/40 text-indigo-300 text-sm px-4 py-2 rounded-lg transition-all whitespace-nowrap"
                    link="/townhall"
                  >
                    Town Hall
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

              <div className="flex flex-col gap-4">
                <ProposalList noPagination compact projects={proposals.slice(0, 3)} />
              </div>
            </div>
          </div>

          {/* Right Sidebar - Community & Stats */}
          <div className="lg:col-span-3 flex flex-col space-y-4 h-full min-h-[800px] order-4 lg:order-3 min-w-0">
            {/* Wallet Info Card */}
            {address && (
              <WalletInfoCard
                unlockedMooney={MOONEYBalance ?? 0}
                lockedMooney={lockedMooneyAmount ?? 0}
                votingPower={walletVP}
                totalVMOONEY={totalVMOONEY ?? 0}
                isUnlockedLoading={isLoadingMOONEY}
                isLockedLoading={isLoadingLockedMooney}
                isVotingPowerLoading={!!isLoadingVP}
                isVMOONEYLoading={isLoadingVMOONEY}
                setSendModalEnabled={setSendModalEnabled}
              />
            )}

            {/* Retroactive Rewards Section - Moved from left sidebar */}
            {address && <ClaimRewardsSection />}

            {/* Featured Teams */}
            <div className="bg-white/5 backdrop-blur-xl border border-white/10 rounded-2xl p-4 flex-grow flex flex-col min-h-[320px]">
              <div className="flex items-center justify-between mb-2">
                <h3 className="font-semibold text-white text-xl">Featured Teams</h3>
                <StandardButton
                  className="text-blue-300 text-sm hover:text-blue-200 transition-all py-1 px-2"
                  link="/network?tab=teams"
                >
                  See all
                </StandardButton>
              </div>

              <div className="flex flex-col gap-1 flex-1 min-h-0">
                {filteredTeams && filteredTeams.length > 0 ? (
                  filteredTeams.slice(0, 8).map((team: any, index: number) => {
                    const metadata = getTeamMetadata(team)
                    return (
                      <Link
                        key={team.id || index}
                        href={`/team/${generatePrettyLink(team.name)}`}
                        className="flex items-start gap-3 hover:bg-white/5 rounded-lg transition-all cursor-pointer p-2"
                      >
                        <div className="w-16 h-16 rounded-lg overflow-hidden flex-shrink-0 flex items-center justify-center">
                          {team.image ? (
                            <IPFSRenderer
                              src={team.image}
                              alt={team.name}
                              className="w-full h-full object-cover"
                              width={64}
                              height={64}
                            />
                          ) : (
                            <div className="w-full h-full bg-gradient-to-br from-blue-500 to-purple-600 rounded-lg flex items-center justify-center text-white font-bold text-lg">
                              {team.name?.[0] || 'T'}
                            </div>
                          )}
                        </div>
                        <div className="min-w-0 flex-1">
                          <h4 className="text-white font-medium text-base truncate">
                            {team.name || 'Team'}
                          </h4>
                          {metadata && (
                            <p className="text-white/50 text-sm leading-snug mt-0.5 line-clamp-2">
                              {metadata}
                            </p>
                          )}
                        </div>
                      </Link>
                    )
                  })
                ) : (
                  <div className="flex items-center gap-3 p-2">
                    <div className="w-16 h-16 bg-gradient-to-br from-blue-500 to-purple-600 rounded-lg flex items-center justify-center text-white flex-shrink-0">
                      M
                    </div>
                    <h4 className="text-white font-medium text-base">Mission Control</h4>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Launchpad Feature - Featured Mission */}
        {FEATURED_MISSION && (
        <div className="bg-gradient-to-br from-blue-600/20 to-blue-800/20 backdrop-blur-xl border border-blue-500/20 rounded-2xl p-4 sm:p-6 lg:p-8 mt-8">
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

          <div className="bg-black/20 rounded-xl p-4 sm:p-5 lg:p-6 border border-blue-500/20">
            {featuredMission ? (
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-5 sm:gap-6 lg:gap-8 items-start">
                {/* Mission image — full grid cell width; no max-w/mx-auto (was shrinking vs stats) */}
                <div className="w-full min-w-0">
                  <div className="relative w-full aspect-square rounded-2xl overflow-hidden shadow-xl">
                    {featuredMission.metadata?.logoUri ? (
                      <IPFSRenderer
                        src={featuredMission.metadata.logoUri}
                        alt={featuredMission.metadata.name || 'Mission'}
                        className="w-full h-full object-cover"
                        width={720}
                        height={720}
                      />
                    ) : (
                      <div className="w-full h-full bg-gradient-to-br from-blue-600/30 to-purple-600/30 flex items-center justify-center">
                        <RocketLaunchIcon className="w-16 h-16 text-blue-400/60" />
                      </div>
                    )}
                    <div className="absolute inset-0 bg-gradient-to-t from-black/50 to-transparent" />

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

                {/* Mission copy + funding — same width track as image */}
                <div className="w-full min-w-0 space-y-4">
                  {/* Mission Title */}
                  <div>
                    <h4 className="font-bold text-white text-xl lg:text-2xl mb-2 leading-tight">
                      {featuredMission.metadata.name}
                    </h4>
                    {featuredMission.metadata.tagline && (
                      <p className="text-blue-200/80 text-sm md:text-base mb-3 leading-relaxed">
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
                            {featuredMinUsdGoal != null ? (
                              <Tooltip
                                compact
                                text={MISSION_MINIMUM_GOAL_TOOLTIP}
                                buttonClassName="!h-3.5 !w-3.5 !text-[8px] !pl-0 -ml-0.5"
                              >
                                ?
                              </Tooltip>
                            ) : null}
                          </div>
                          <p className="text-white font-bold text-sm">
                            {featuredMinUsdGoal != null
                              ? `$${featuredMinUsdGoal.toLocaleString('en-US')}`
                              : featuredMissionFundingGoal
                                ? truncateTokenValue(featuredMissionFundingGoal / 1e18, 'ETH')
                                : '0'}
                            {featuredMinUsdGoal != null ? '' : ' ETH'}
                          </p>
                        </div>

                        {/* Contributions */}
                        <div className="bg-blue-900/20 rounded-lg p-3 border border-blue-500/10">
                          <div className="flex items-center gap-2 mb-2">
                            <UserGroupIcon className="w-4 h-4 text-blue-400" />
                            <span className="text-blue-200 text-xs font-medium">Contributions</span>
                          </div>
                          <p className="text-white font-bold text-sm">
                            {featuredMissionSubgraphData?.paymentsCount || 0}
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

        {/* Quests Section */}
        <div className="flex-grow order-5 bg-white/5 backdrop-blur-xl border border-white/10 rounded-2xl p-3 sm:p-4 md:p-6 mt-6 sm:mt-8 mb-6 sm:mb-8">
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
        <DashboardActiveProjects
          currentProjects={currentProjects}
          ethBudget={ETH_BUDGET}
          showBudget={true}
          maxProjects={6}
        />

        {/* Marketplace Section - Full Width */}
        <div className="mt-8 mb-8">
          <NewMarketplaceListings
            selectedChain={selectedChain}
            teamContract={teamContract}
            marketplaceTableContract={marketplaceTableContract}
            initialListings={newestListings}
          />
        </div>

        {/* Events and Your Teams Section - Side by Side (Teams hidden when user has none) */}
        <div
          className={`grid gap-8 mt-8 mb-8 ${
            shouldShowTeamsSection(teamHats, isLoadingTeams) ? 'grid-cols-1 lg:grid-cols-2' : 'grid-cols-1'
          }`}
        >
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

          {/* Your Teams Section - only shown when user is a member of at least one team */}
          {shouldShowTeamsSection(teamHats, isLoadingTeams) && (
            <div
              data-testid="dashboard-your-teams-section"
              className="bg-white/5 backdrop-blur-xl border border-white/10 rounded-2xl p-4 sm:p-5"
            >
              <div className="mb-3">
                <div className="min-w-0 flex-1">
                  <h3 className="text-base sm:text-lg font-bold text-white mb-1 flex items-center gap-2">
                    <UserGroupIcon className="w-4 h-4 sm:w-5 sm:h-5 flex-shrink-0" />
                    <span className="leading-tight">Your Teams</span>
                  </h3>
                </div>
              </div>

              <div className="space-y-2">
                <DashboardTeams
                  selectedChain={selectedChain}
                  hatsContract={hatsContract}
                  teamContract={teamContract}
                />
              </div>
            </div>
          )}
        </div>

        {/* Open Jobs - Full Width */}
        <div className="mb-6">
          <div className="bg-white/5 backdrop-blur-xl border border-white/10 rounded-2xl p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-semibold text-white text-lg">Open Jobs</h3>
              <StandardButton
                className="text-blue-300 text-sm hover:text-blue-200 transition-all"
                link="/jobs"
              >
                See all
              </StandardButton>
            </div>

            <div className="space-y-3">
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

          <div
            className={`relative w-full h-[400px] sm:h-[500px] lg:h-[650px] xl:h-[700px] ${networkCard.base} overflow-hidden`}
          >
            <div className="absolute inset-0 flex items-center justify-center">
              <div className="flex items-center justify-center">
                <LazyEarth
                  pointsData={citizensLocationData || []}
                  width={undefined}
                  height={undefined}
                />
              </div>
            </div>

            {/* Enhanced Stats overlay with optimized glassmorphism */}
            <div
              className="absolute top-3 left-3 sm:top-4 sm:left-4 lg:top-6 lg:left-6 bg-black/60 backdrop-blur-sm rounded-xl sm:rounded-2xl p-3 sm:p-4 lg:p-6 border border-white/10 max-w-[120px] sm:max-w-none"
              style={{ contain: 'paint' }}
            >
              <div className="text-white">
                <div className="text-lg sm:text-2xl lg:text-3xl font-bold mb-1 leading-tight">
                  {citizensCount ||
                    countCitizensFromLocationData(citizensLocationData || []) ||
                    0}
                </div>
                <div className="text-xs sm:text-sm opacity-90 leading-tight">Global Citizens</div>
              </div>
            </div>

            <div
              className="absolute top-3 right-3 sm:top-4 sm:right-4 lg:top-6 lg:right-6 bg-black/60 backdrop-blur-sm rounded-xl sm:rounded-2xl p-3 sm:p-4 lg:p-6 border border-white/10 max-w-[120px] sm:max-w-none"
              style={{ contain: 'paint' }}
            >
              <div className="text-white">
                <div className="text-lg sm:text-2xl lg:text-3xl font-bold mb-1 leading-tight">
                  {countUniqueCountries(citizensLocationData)} {/* Unique countries */}
                </div>
                <div className="text-xs sm:text-sm opacity-90 leading-tight">Countries</div>
              </div>
            </div>

            <div
              className="absolute bottom-3 left-3 sm:bottom-4 sm:left-4 lg:bottom-6 lg:left-6 bg-black/60 backdrop-blur-sm rounded-xl sm:rounded-2xl p-3 sm:p-4 lg:p-6 border border-white/10 max-w-[120px] sm:max-w-none"
              style={{ contain: 'paint' }}
            >
              <div className="text-white">
                <div className="text-lg sm:text-2xl lg:text-3xl font-bold mb-1 leading-tight">
                  24/7
                </div>
                <div className="text-xs sm:text-sm opacity-90 leading-tight">Active Community</div>
              </div>
            </div>

            <div
              className="absolute bottom-3 right-3 sm:bottom-4 sm:right-4 lg:bottom-6 lg:right-6 bg-black/60 backdrop-blur-sm rounded-xl sm:rounded-2xl p-3 sm:p-4 lg:p-6 border border-white/10 max-w-[120px] sm:max-w-none"
              style={{ contain: 'paint' }}
            >
              <div className="text-white">
                <div className="text-lg sm:text-2xl lg:text-3xl font-bold mb-1 leading-tight">
                  {filteredTeams?.length ?? 0}
                </div>
                <div className="text-xs sm:text-sm opacity-90 leading-tight">Total Teams</div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Newsletter Modal */}
      {newsletterModalOpen && <NewsletterSubModal setEnabled={setNewsletterModalOpen} />}

      {/* Send Modal */}
      {sendModalEnabled && (
        <SendModal
          account={account}
          selectedChain={selectedChain}
          setEnabled={setSendModalEnabled}
          networkIcon={
            <Image
              src={`/icons/networks/${chainSlug}.svg`}
              width={20}
              height={20}
              alt="Network Icon"
              className="object-contain"
            />
          }
          nativeBalance={nativeBalance}
          tokens={walletTokens}
        />
      )}

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
