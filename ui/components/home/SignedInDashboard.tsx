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
  ArrowRightIcon,
  SparklesIcon,
  BoltIcon,
  ChartBarIcon,
  DocumentTextIcon,
  FireIcon,
} from '@heroicons/react/24/outline'
import { useFundWallet } from '@privy-io/react-auth'
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
  USD_BUDGET,
} from 'const/config'
import { BLOCKED_MDPS, BLOCKED_PROJECTS } from 'const/whitelist'
import {
  getMissionMinimumUsdGoal,
  MISSION_MINIMUM_GOAL_TOOLTIP,
} from 'const/missionMilestones'
import dynamic from 'next/dynamic'
import Image from 'next/image'
import Link from 'next/link'
import { useRouter } from 'next/router'
import React, { useContext, useState } from 'react'
import { toast } from 'react-hot-toast'
import { useActiveAccount } from 'thirdweb/react'
import CitizenContext from '@/lib/citizen/citizen-context'
import useMissionData from '@/lib/mission/useMissionData'
import useMissionRaisedProgress from '@/lib/mission/useMissionRaisedProgress'
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
import RecentActivity from './RecentActivity'
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

// ── Premium UI primitives ──────────────────────────────────────────────────

function StatCard({
  icon,
  iconBg,
  label,
  value,
  unit,
  ctaLabel,
  onCta,
  ctaLink,
}: {
  icon: React.ReactNode
  iconBg: string
  label: string
  value: React.ReactNode
  unit?: string
  ctaLabel?: string
  onCta?: () => void
  ctaLink?: string
}) {
  return (
    <div className="group relative overflow-hidden rounded-2xl border border-white/10 bg-white/[0.03] backdrop-blur-xl p-4 sm:p-5 hover:border-white/20 transition-colors">
      <div className="flex items-start justify-between mb-3">
        <div
          className={`w-10 h-10 rounded-xl bg-gradient-to-br ${iconBg} flex items-center justify-center`}
        >
          {icon}
        </div>
        {ctaLabel && (ctaLink ? (
          <Link
            href={ctaLink}
            className="text-xs font-medium text-white/50 hover:text-white transition-colors"
          >
            {ctaLabel} →
          </Link>
        ) : (
          <button
            onClick={onCta}
            className="text-xs font-medium text-white/50 hover:text-white transition-colors"
          >
            {ctaLabel} →
          </button>
        ))}
      </div>
      <p className="text-white/50 text-xs font-medium uppercase tracking-wider mb-1">
        {label}
      </p>
      <div className="flex items-baseline gap-1.5">
        <p className="text-white text-xl sm:text-2xl font-bold leading-none">{value}</p>
        {unit && <span className="text-white/40 text-xs font-medium">{unit}</span>}
      </div>
    </div>
  )
}

function SectionHeader({
  title,
  subtitle,
  icon,
  actions,
  small,
}: {
  title: string
  subtitle?: string
  icon?: React.ReactNode
  actions?: React.ReactNode
  small?: boolean
}) {
  return (
    <div
      className={`flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 ${small ? 'mb-4' : 'mb-5 sm:mb-6'}`}
    >
      <div className="min-w-0 flex-1">
        <h3
          className={`font-bold text-white flex items-center gap-2 ${small ? 'text-lg' : 'text-xl sm:text-2xl'}`}
        >
          {icon}
          <span className="truncate">{title}</span>
        </h3>
        {subtitle && (
          <p className={`text-white/55 ${small ? 'text-xs' : 'text-sm'} mt-1 leading-snug`}>
            {subtitle}
          </p>
        )}
      </div>
      {actions && <div className="flex-shrink-0">{actions}</div>}
    </div>
  )
}

function SubtleButton({
  children,
  link,
  onClick,
  color = 'blue',
}: {
  children: React.ReactNode
  link?: string
  onClick?: () => void
  color?: 'blue' | 'purple' | 'indigo' | 'teal' | 'white'
}) {
  const colorMap: Record<string, string> = {
    blue: 'bg-blue-500/10 hover:bg-blue-500/20 text-blue-200 border-blue-400/20',
    purple: 'bg-purple-500/10 hover:bg-purple-500/20 text-purple-200 border-purple-400/20',
    indigo: 'bg-indigo-500/10 hover:bg-indigo-500/20 text-indigo-200 border-indigo-400/20',
    teal: 'bg-teal-500/10 hover:bg-teal-500/20 text-teal-200 border-teal-400/20',
    white: 'bg-white/5 hover:bg-white/10 text-white/80 border-white/10',
  }
  const cls = `inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg border transition-all whitespace-nowrap ${colorMap[color]}`
  if (link) {
    const isExternal = link.startsWith('http')
    if (isExternal) return <a href={link} target="_blank" rel="noreferrer" className={cls}>{children}</a>
    return <Link href={link} className={cls}>{children}</Link>
  }
  return <button onClick={onClick} className={cls}>{children}</button>
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
    if (!BLOCKED_PROJECTS.has(projects[i].id) && !BLOCKED_MDPS.has(projects[i].MDP)) {
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

  const account = useActiveAccount()
  const address = account?.address

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

  const {
    raisedUsd: featuredRaisedUsd,
    milestoneProgressPercent: featuredMilestoneProgress,
    milestoneCaption: featuredMilestoneCaption,
    isLoading: isLoadingFeaturedRaised,
  } = useMissionRaisedProgress({
    projectId: featuredMission?.projectId,
    missionId: featuredMission?.id,
    subgraphVolume: featuredMissionSubgraphData?.volume,
  })

  return (
    <Container>
      <div className="max-w-7xl mx-auto px-4 py-4">

        {/* ── Mobile-only hero bar ─────────────────────────── */}
        <div className="lg:hidden flex items-center gap-3 mb-4 bg-white/5 backdrop-blur-xl border border-white/10 rounded-2xl p-4">
          {/* Avatar */}
          <div className="w-12 h-12 rounded-xl overflow-hidden flex-shrink-0">
            {citizen?.metadata?.image ? (
              <IPFSRenderer
                src={citizen.metadata.image}
                alt={citizen?.metadata?.name || 'Citizen'}
                className="w-full h-full object-cover"
                width={48}
                height={48}
              />
            ) : (
              <div className="w-full h-full bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center text-white font-bold text-lg">
                {citizen?.metadata?.name?.[0] || address?.[2] || 'M'}
              </div>
            )}
          </div>
          {/* Name + greeting */}
          <div className="flex-1 min-w-0">
            <p className="text-white font-semibold truncate">
              {citizen?.metadata?.name || 'Welcome back'}
            </p>
            <p className="text-white/50 text-xs">MoonDAO Citizen</p>
          </div>
          {/* Edit profile link */}
          <Link
            href={
              citizen?.metadata?.name && (citizen?.metadata?.id ?? citizen?.id)
                ? `/citizen/${generatePrettyLinkWithId(
                    citizen.metadata.name,
                    citizen.metadata?.id ?? citizen.id
                  )}`
                : '/join'
            }
            className="flex-shrink-0 text-xs text-blue-300 hover:text-blue-200 transition-colors px-3 py-1.5 bg-blue-500/10 rounded-lg border border-blue-500/20"
          >
            Profile
          </Link>
        </div>

        {/* ──────────────── PREMIUM HERO: Greeting + KPIs ──────────────── */}
        <div className="hidden lg:block mb-6">
          {/* Welcome banner */}
          <div className="relative overflow-hidden bg-gradient-to-br from-indigo-900/40 via-blue-900/30 to-purple-900/40 backdrop-blur-xl border border-white/10 rounded-2xl p-4 mb-4">
            {/* decorative gradient blobs */}
            <div className="absolute -top-24 -right-24 w-72 h-72 bg-blue-500/15 rounded-full blur-3xl pointer-events-none" />
            <div className="absolute -bottom-24 -left-24 w-72 h-72 bg-purple-500/15 rounded-full blur-3xl pointer-events-none" />

            <div className="relative flex items-center justify-between gap-6">
              {/* Avatar + Greeting */}
              <div className="flex items-center gap-4 min-w-0">
                {citizen?.metadata?.image ? (
                  <Link
                    href={
                      citizen?.metadata?.name && (citizen?.metadata?.id ?? citizen?.id)
                        ? `/citizen/${generatePrettyLinkWithId(citizen.metadata.name, citizen.metadata?.id ?? citizen.id)}`
                        : '/join'
                    }
                    className="flex-shrink-0"
                  >
                    <div className="w-12 h-12 rounded-xl overflow-hidden ring-2 ring-white/20 shadow-lg shadow-blue-500/20 hover:ring-blue-400/40 transition-all">
                      <IPFSRenderer
                        src={citizen.metadata.image}
                        alt={citizen.metadata.name}
                        className="w-full h-full object-cover"
                        width={48}
                        height={48}
                      />
                    </div>
                  </Link>
                ) : (
                  <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center flex-shrink-0 ring-2 ring-white/20 shadow-lg shadow-blue-500/20">
                    <span className="text-white font-bold text-xl">
                      {citizen?.metadata?.name?.[0] || address?.[2]?.toUpperCase() || 'M'}
                    </span>
                  </div>
                )}
                <div className="min-w-0">
                  <p className="text-white/40 text-xs font-semibold uppercase tracking-widest mb-1">
                    Welcome back
                  </p>
                  <h2 className="text-white text-2xl xl:text-3xl font-bold truncate leading-tight">
                    {citizen?.metadata?.name || 'Explorer'}
                  </h2>
                  {!citizen && (
                    <Link
                      href="/join"
                      className="inline-flex items-center gap-1 mt-1 px-2 py-0.5 bg-purple-500/15 border border-purple-400/30 rounded-md text-purple-300 text-xs font-medium hover:bg-purple-500/25 transition-colors"
                    >
                      <SparklesIcon className="w-3.5 h-3.5" />
                      Become a Citizen →
                    </Link>
                  )}
                </div>
              </div>

              {/* Contribution CTA box */}
              <div className="flex items-center gap-4 flex-shrink-0 bg-white/[0.04] border border-white/10 rounded-xl px-5 py-3.5">
                <div>
                  <p className="text-white text-sm font-semibold">What did you get done this week?</p>
                  <p className="text-white/40 text-xs mt-0.5">Earn ETH & vMOONEY rewards each quarter.</p>
                </div>
                <a
                  href="https://docs.google.com/forms/d/e/1FAIpQLSdtHRzqDAAe1TOZ7Bp03TKVbxLFZzJeeKSUDQ-BpIZtDPxJWw/viewform"
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center gap-2 px-5 py-2.5 bg-gradient-to-r from-blue-500 to-purple-500 hover:from-blue-400 hover:to-purple-400 text-white text-sm font-bold rounded-xl shadow-lg shadow-blue-500/30 transition-all whitespace-nowrap flex-shrink-0"
                >
                  <TrophyIcon className="w-4 h-4" />
                  Submit Contribution
                </a>
              </div>
            </div>
          </div>

        </div>

        {/* ──────────────── ROW 1: Activity + Citizens/Teams + Wallet/Rewards ──────────────── */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-stretch">
          {/* LEFT — Recent Activity (6 cols) */}
          <div className="lg:col-span-6 order-2 lg:order-1">
            <div className="bg-white/[0.03] backdrop-blur-xl border border-white/10 rounded-2xl p-5 sm:p-6 h-full">
              <SectionHeader
                title="Recent Activity"
                subtitle="Latest happenings across the network"
                icon={<NewspaperIcon className="w-6 h-6 text-blue-400" />}
                actions={
                  <div className="flex gap-2">
                    <SubtleButton color="blue" link="/news">News</SubtleButton>
                    <SubtleButton color="purple" onClick={() => setNewsletterModalOpen(true)}>Subscribe</SubtleButton>
                    <SubtleButton color="indigo" link="/townhall">Town Hall</SubtleButton>
                  </div>
                }
              />
              <RecentActivity
                newestCitizens={newestCitizens}
                newestJobs={newestJobs}
                newestListings={newestListings}
                newestTeams={filteredTeams}
                proposals={proposals}
                maxItems={11}
              />
            </div>
          </div>

          {/* MIDDLE — New Citizens + Featured Teams (3 cols) */}
          <div className="lg:col-span-3 flex flex-col gap-6 order-3 lg:order-2 min-w-0">
            {newestCitizens && newestCitizens.length > 0 && (
              <div className="bg-white/[0.03] backdrop-blur-xl border border-white/10 rounded-2xl p-4 flex-1">
                <SectionHeader
                  small
                  title="New Citizens"
                  icon={<UserGroupIcon className="w-5 h-5 text-green-400" />}
                  actions={<SubtleButton color="teal" link="/citizens">All →</SubtleButton>}
                />
                <div className="grid grid-cols-2 gap-2 mt-2">
                  {newestCitizens.slice(0, 8).map((c: any) => {
                    const name = c.name || c.metadata?.name || `Citizen #${c.id}`
                    const image = c.image || c.metadata?.image
                    const location = getCitizenLocation(c)
                    const href = name && c.id
                      ? `/citizen/${generatePrettyLinkWithId(name, c.id)}`
                      : `/citizen/${c.id}`
                    return (
                      <Link
                        key={c.id}
                        href={href}
                        className="group flex flex-col items-center gap-2 py-3 px-1 rounded-xl hover:bg-white/[0.05] transition-all text-center"
                      >
                        <div className="w-20 h-20 rounded-xl overflow-hidden flex-shrink-0 ring-2 ring-white/10 group-hover:ring-green-400/40 transition-all">
                          {image ? (
                            <IPFSRenderer
                              src={image}
                              alt={name}
                              width={80}
                              height={80}
                              className="w-full h-full object-cover"
                            />
                          ) : (
                            <div className="w-full h-full bg-gradient-to-br from-green-500 to-teal-600 flex items-center justify-center">
                              <span className="text-white font-bold text-xl">{name[0]?.toUpperCase()}</span>
                            </div>
                          )}
                        </div>
                        <p className="text-white text-xs font-medium truncate w-full">{name}</p>
                      </Link>
                    )
                  })}
                </div>
              </div>
            )}

            {filteredTeams && filteredTeams.length > 0 && (
              <div className="bg-white/[0.03] backdrop-blur-xl border border-white/10 rounded-2xl p-4 flex-1">
                <SectionHeader
                  small
                  title="Featured Teams"
                  icon={<UserGroupIcon className="w-5 h-5 text-purple-400" />}
                  actions={<SubtleButton color="purple" link="/teams">All →</SubtleButton>}
                />
                <div className="flex flex-col gap-2 mt-2">
                  {filteredTeams.slice(0, 5).map((t: any) => {
                    const name = t.name || t.metadata?.name || `Team #${t.id}`
                    const image = t.image || t.metadata?.image
                    const description = (t.description || t.metadata?.description || '')
                      .replace(/<[^>]*>/g, '').trim()
                    const href = name && t.id
                      ? `/team/${generatePrettyLink(name)}-${t.id}`
                      : `/team/${t.id}`
                    return (
                      <Link
                        key={t.id}
                        href={href}
                        className="group flex items-center gap-2 p-2 rounded-xl bg-white/[0.02] hover:bg-white/[0.06] border border-white/5 hover:border-white/15 transition-all"
                      >
                        <div className="w-9 h-9 rounded-lg overflow-hidden flex-shrink-0 ring-2 ring-white/10 group-hover:ring-purple-400/30 transition-all">
                          {image ? (
                            <IPFSRenderer
                              src={image}
                              alt={name}
                              width={36}
                              height={36}
                              className="w-full h-full object-cover"
                            />
                          ) : (
                            <div className="w-full h-full bg-gradient-to-br from-purple-500 to-indigo-600 flex items-center justify-center">
                              <UserGroupIcon className="w-4 h-4 text-white/70" />
                            </div>
                          )}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-white text-xs font-semibold truncate">{name}</p>
                          {description && (
                            <p className="text-white/50 text-[10px] truncate">
                              {description.length > 40 ? description.slice(0, 37) + '…' : description}
                            </p>
                          )}
                        </div>
                        <ArrowRightIcon className="w-3.5 h-3.5 text-white/20 group-hover:text-white/50 flex-shrink-0 transition-colors" />
                      </Link>
                    )
                  })}
                </div>
              </div>
            )}
          </div>

          {/* RIGHT — Wallet + Rewards (3 cols, same height as activity) */}
          <div className="lg:col-span-3 flex flex-col gap-6 order-1 lg:order-3 min-w-0">
            {/* Retroactive Rewards (above wallet) */}
            {address && <ClaimRewardsSection />}

            {/* Wallet */}
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

            {/* Weekly Reward Pool — flex-1 so it fills remaining height */}
            <div className="flex-1 min-h-0">
              <WeeklyRewardPool />
            </div>
          </div>
        </div>

        {/* ──────────────── ROW 2: Proposals + Events ──────────────── */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 mt-6 items-stretch">
          {/* Active Proposals (8 cols) */}
          <div className="lg:col-span-8 order-2 lg:order-1 flex flex-col">
            <div className="bg-white/[0.03] backdrop-blur-xl border border-white/10 rounded-2xl p-5 sm:p-6 flex-1">
              <SectionHeader
                title="Active Proposals"
                subtitle="Vote on the future of MoonDAO"
                icon={<DocumentTextIcon className="w-6 h-6 text-purple-400" />}
                actions={<SubtleButton color="white" link="/projects">View All →</SubtleButton>}
              />
              <ProposalList
                noPagination
                compact
                feedCardStyle
                projects={proposals.slice(0, 4)}
              />
            </div>
          </div>

          {/* Upcoming Events (4 cols) */}
          <div className="lg:col-span-4 order-1 lg:order-2 min-w-0 flex flex-col">
            <div className="bg-white/[0.03] backdrop-blur-xl border border-white/10 rounded-2xl p-5 sm:p-6 flex-1">
              <SectionHeader
                small
                title="Upcoming Events"
                icon={<CalendarDaysIcon className="w-5 h-5 text-indigo-400" />}
                actions={
                  <SubtleButton color="indigo" link="https://lu.ma/moondao">
                    All →
                  </SubtleButton>
                }
              />
              <Link
                href="https://lu.ma/moondao"
                target="_blank"
                rel="noreferrer"
                className="sm:hidden flex items-center gap-3 bg-black/20 hover:bg-black/40 border border-white/10 rounded-xl p-4 transition-all"
              >
                <CalendarDaysIcon className="w-6 h-6 text-indigo-400" />
                <span className="text-white text-sm font-medium">Open Community Calendar</span>
                <ArrowUpRightIcon className="w-4 h-4 text-white/40 ml-auto" />
              </Link>
              <div className="relative h-[460px] hidden sm:block">
                <div
                  id="luma-loading-side"
                  className="absolute inset-0 bg-gray-800/20 rounded-lg flex items-center justify-center z-10"
                >
                  <div className="text-white text-center">
                    <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white mx-auto mb-2" />
                    <p className="text-xs">Loading events…</p>
                  </div>
                </div>
                <iframe
                  src="https://lu.ma/embed/calendar/cal-7mKdy93TZVlA0Xh/events?lt=dark"
                  className="rounded-lg absolute inset-0 w-full h-full"
                  style={{ border: '1px solid #ffffff20' }}
                  loading="lazy"
                  referrerPolicy="no-referrer-when-downgrade"
                  allowFullScreen
                  title="MoonDAO Events Calendar"
                  onLoad={() => {
                    const el = document.getElementById('luma-loading-side')
                    if (el) el.style.display = 'none'
                  }}
                />
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
                      {featuredMilestoneProgress != null && (
                        <div className="space-y-2">
                          <div className="flex justify-between items-center">
                            <span className="text-blue-200 text-xs font-medium">
                              Funding Progress
                            </span>
                            <span className="text-white font-bold text-sm">
                              {Math.round(featuredMilestoneProgress)}%
                            </span>
                          </div>
                          <div className="w-full bg-blue-900/30 rounded-full h-2 overflow-hidden">
                            <div
                              className="bg-gradient-to-r from-blue-500 to-purple-500 h-full rounded-full transition-all duration-1000"
                              style={{
                                width: `${Math.min(100, featuredMilestoneProgress)}%`,
                              }}
                            />
                          </div>
                          {featuredMilestoneCaption && (
                            <p className="text-blue-200/60 text-xs">
                              {featuredMilestoneCaption}
                            </p>
                          )}
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
                            {isLoadingFeaturedRaised || featuredRaisedUsd == null ? (
                              <LoadingSpinner width="w-4" height="h-4" />
                            ) : (
                              `$${Math.round(featuredRaisedUsd).toLocaleString()}`
                            )}
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
        <div className="bg-white/[0.03] backdrop-blur-xl border border-white/10 rounded-2xl p-5 sm:p-6 mt-8 mb-8">
          <SectionHeader
            title="Quests"
            subtitle="Complete quests to earn XP and level up"
            icon={<TrophyIcon className="w-6 h-6 text-yellow-400" />}
            actions={<SubtleButton color="white" link="/quests">View All →</SubtleButton>}
          />
          <DashboardQuests selectedChain={selectedChain} />
        </div>

        {/* Active Projects Section - Full Width */}
        <DashboardActiveProjects
          currentProjects={currentProjects}
          usdBudget={USD_BUDGET}
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

        {/* Open Jobs Section - Full Width */}
        <div className="mt-8 mb-8">
          <div className="bg-white/[0.03] backdrop-blur-xl border border-white/10 rounded-2xl p-5 sm:p-6">
            <SectionHeader
              title="Open Jobs"
              subtitle="Find open positions within the MoonDAO Network"
              icon={<BriefcaseIcon className="w-6 h-6 text-blue-400" />}
              actions={<SubtleButton color="white" link="/jobs">View All →</SubtleButton>}
            />
            {newestJobs && newestJobs.length > 0 ? (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                {newestJobs.slice(0, 6).map((job: any) => (
                  <Link
                    key={job.id}
                    href={job?.contactInfo || '/jobs'}
                    className="flex items-center gap-3 bg-black/20 hover:bg-black/40 border border-white/5 hover:border-white/10 rounded-xl p-3 transition-all"
                  >
                    <div className="w-10 h-10 bg-gradient-to-br from-blue-500 to-purple-600 rounded-lg flex items-center justify-center text-white flex-shrink-0">
                      <BriefcaseIcon className="w-5 h-5" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <h4 className="text-white font-medium text-sm truncate">{job?.title || 'Open Position'}</h4>
                      {job?.description && typeof job.description === 'string' && (
                        <p className="text-gray-400 text-xs truncate mt-0.5">{job.description}</p>
                      )}
                    </div>
                    <ArrowRightIcon className="w-4 h-4 text-gray-400 flex-shrink-0" />
                  </Link>
                ))}
              </div>
            ) : (
              <div className="flex items-center justify-center py-10">
                <div className="text-center">
                  <BriefcaseIcon className="w-10 h-10 text-gray-500 mx-auto mb-2" />
                  <p className="text-gray-400 text-sm">No open positions right now</p>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Global Community Map - Enhanced */}
        <div className="bg-white/[0.03] backdrop-blur-xl border border-white/10 rounded-2xl p-5 sm:p-6 mb-8">
          <SectionHeader
            title="Global Community"
            subtitle="MoonDAO citizens around the world"
            icon={<GlobeAmericasIcon className="w-6 h-6 text-teal-400" />}
            actions={<SubtleButton color="teal" link="/map">Explore Map →</SubtleButton>}
          />

          {/* Mobile: lightweight stats grid + CTA instead of 3D globe */}
          <div className="sm:hidden">
            <div className="grid grid-cols-2 gap-3 mb-4">
              <div className="bg-white/5 rounded-xl p-4 border border-white/10 text-center">
                <div className="text-2xl font-bold text-white">
                  {citizensCount || countCitizensFromLocationData(citizensLocationData || []) || 0}
                </div>
                <div className="text-xs text-white/60 mt-1">Global Citizens</div>
              </div>
              <div className="bg-white/5 rounded-xl p-4 border border-white/10 text-center">
                <div className="text-2xl font-bold text-white">
                  {countUniqueCountries(citizensLocationData)}
                </div>
                <div className="text-xs text-white/60 mt-1">Countries</div>
              </div>
              <div className="bg-white/5 rounded-xl p-4 border border-white/10 text-center">
                <div className="text-2xl font-bold text-white">24/7</div>
                <div className="text-xs text-white/60 mt-1">Active Community</div>
              </div>
              <div className="bg-white/5 rounded-xl p-4 border border-white/10 text-center">
                <div className="text-2xl font-bold text-white">{filteredTeams?.length ?? 0}</div>
                <div className="text-xs text-white/60 mt-1">Total Teams</div>
              </div>
            </div>
            <Link
              href="/map"
              className="flex items-center justify-center gap-2 bg-teal-600/20 hover:bg-teal-600/30 border border-teal-500/30 rounded-xl py-4 transition-all text-teal-300 font-semibold"
            >
              <GlobeAmericasIcon className="w-5 h-5" />
              Explore the Community Map
            </Link>
          </div>

          {/* Desktop: full 3-D globe */}
          <div
            className={`relative w-full h-[400px] sm:h-[500px] lg:h-[650px] xl:h-[700px] ${networkCard.base} overflow-hidden hidden sm:block`}
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
          </div>{/* /desktop globe */}
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
