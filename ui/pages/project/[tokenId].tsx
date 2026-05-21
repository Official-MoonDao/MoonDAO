import Safe from '@safe-global/protocol-kit'
import CitizenABI from 'const/abis/Citizen.json'
import HatsABI from 'const/abis/Hats.json'
import ProjectABI from 'const/abis/Project.json'

import ProposalsABI from 'const/abis/Proposals.json'
import {
  CITIZEN_ADDRESSES,
  DEFAULT_CHAIN_V5,
  HATS_ADDRESS,
  PROJECT_ADDRESSES,
  PROPOSALS_ADDRESSES,
  NON_PROJECT_PROPOSAL_TABLE_NAMES,
  PROJECT_TABLE_NAMES,
} from 'const/config'
import { BLOCKED_MDPS, BLOCKED_PROJECTS } from 'const/whitelist'
import { GetServerSideProps } from 'next'
import Image from 'next/image'
import Link from 'next/link'
import { useRouter } from 'next/router'
import { useContext, useEffect, useState } from 'react'
import { getContract, readContract } from 'thirdweb'
import { getRpcUrlForChain } from 'thirdweb/chains'
import { useActiveAccount } from 'thirdweb/react'
import { useSubHats } from '@/lib/hats/useSubHats'
import { PROJECT_PENDING } from '@/lib/nance/types'
import { getProposalStatus, STATUS_CONFIG, STATUS_DISPLAY_LABELS, ProposalStatus } from '@/lib/nance/useProposalStatus'
import { getProjectDisplayName } from '@/lib/project/getProjectDisplayName'
import useProjectData, { Project } from '@/lib/project/useProjectData'
import useSafe from '@/lib/safe/useSafe'
import queryTable from '@/lib/tableland/queryTable'
import { DistributionVote } from '@/lib/tableland/types'
import { getChainSlug } from '@/lib/thirdweb/chain'
import ChainContextV5 from '@/lib/thirdweb/chain-context-v5'
import { serverClient } from '@/lib/thirdweb/client'
import { useChainDefault } from '@/lib/thirdweb/hooks/useChainDefault'
import useContract from '@/lib/thirdweb/hooks/useContract'
import { fetchTotalVMOONEYs } from '@/lib/tokens/hooks/useTotalVMOONEY'
import { isFetchableUrl } from '@/lib/utils/links'
import { runQuadraticVoting } from '@/lib/utils/rewards'
import Container from '@/components/layout/Container'
import ContentLayout from '@/components/layout/ContentLayout'
import Head from '@/components/layout/Head'
import { NoticeFooter } from '@/components/layout/NoticeFooter'
import SectionCard from '@/components/layout/SectionCard'
import SlidingCardMenu from '@/components/layout/SlidingCardMenu'
import MarkdownWithTOC from '@/components/nance/MarkdownWithTOC'

import VotingResults from '@/components/nance/VotingResults'
import ProposalEditSection from '@/components/nance/ProposalEditSection'
import AuthorCitizenLink from '@/components/project/AuthorCitizenLink'
import CloseAndTallyButton from '@/components/project/CloseAndTallyButton'
import MemberVoteSidebar from '@/components/project/MemberVoteSidebar'
import SenateVote from '@/components/project/SenateVote'
import SenateVoteSidebar from '@/components/project/SenateVoteSidebar'
import TeamManageMembers from '@/components/subscription/TeamManageMembers'
import TeamMembers from '@/components/subscription/TeamMembers'
import TeamTreasury from '@/components/subscription/TeamTreasury'

function ProposalStatusBadge({ status }: { status: ProposalStatus }) {
  const config = STATUS_CONFIG[status as keyof typeof STATUS_CONFIG] || {
    bg: 'bg-gray-500/10',
    border: 'border-gray-500/30',
    text: 'text-gray-400',
    dot: 'bg-gray-500',
  }
  const displayLabel = STATUS_DISPLAY_LABELS[status] ?? status
  return (
    <div
      className={`inline-flex items-center gap-1.5 sm:gap-2 h-7 sm:h-9 px-2 sm:px-3 rounded-lg border ${config.bg} ${config.border}`}
    >
      <div className={`w-1.5 h-1.5 sm:w-2 sm:h-2 rounded-full ${config.dot}`} />
      <span className={`text-xs sm:text-sm font-medium ${config.text} uppercase tracking-wider`}>
        {displayLabel}
      </span>
    </div>
  )
}

type ProjectProfileProps = {
  tokenId: string
  project: Project
  safeAddress: string
  safeOwners: string[]
  proposalJSON: any
  votes: any[]
  voteOutcome: any
  proposalStatus: any
  // address (lowercased or checksummed — we look up both) -> quadratic
  // voting power (sqrt of vMOONEY at the voting-window close).
  // Empty object when the proposal has no votes yet or isn't a
  // non-project proposal.
  addressToVotingPower: { [address: string]: number }
  tempCheckApprovedTimestamp?: string
  pending?: boolean
}

export default function ProjectProfile({
  tokenId,
  project,
  safeAddress,
  safeOwners,
  proposalJSON,
  votes,
  voteOutcome,
  proposalStatus,
  addressToVotingPower,
  tempCheckApprovedTimestamp,
  pending,
}: ProjectProfileProps) {
  const router = useRouter()
  const account = useActiveAccount()
  const address = account?.address

  const { selectedChain } = useContext(ChainContextV5)
  const chainSlug = getChainSlug(selectedChain)

  //Contracts
  const hatsContract = useContract({
    address: HATS_ADDRESS,
    abi: HatsABI as any,
    chain: selectedChain,
  })
  const projectContract = useContract({
    address: PROJECT_ADDRESSES[chainSlug],
    abi: ProjectABI as any,
    chain: selectedChain,
  })
  const citizenContract = useContract({
    address: CITIZEN_ADDRESSES[chainSlug],
    abi: CitizenABI as any,
    chain: selectedChain,
  })

  const {
    adminHatId,
    managerHatId,
    isManager,
    isActive,
    finalReportMarkdown,
    totalBudget,
    MDP,
    isLoading: isLoadingProjectData,
  } = useProjectData(projectContract, hatsContract, project)

  const safeData = useSafe(safeAddress)
  const isSigner = safeOwners.includes(address || '')
  //Hats
  const hats = useSubHats(selectedChain, adminHatId, true)

  useChainDefault()

  // If this is a pending proposal that hasn't been indexed yet, show a loading state
  // and auto-retry after a few seconds
  useEffect(() => {
    if (!pending) return
    const timer = setTimeout(() => {
      router.replace(`/project/${tokenId}?new=1`)
    }, 5000)
    return () => clearTimeout(timer)
  }, [pending, tokenId, router])

  // Tabbed main column. The right rail (Senate + Member vote
  // sidebars) is intentionally outside the tab system so the
  // primary action stays visible across all three tabs.
  type ProjectTab = 'proposal' | 'treasury' | 'team'
  const [tab, setTab] = useState<ProjectTab>('proposal')

  // Hydrate from `?tab=` so deep links land on the right tab and
  // browser back/forward navigates between tabs the user has
  // already visited.
  useEffect(() => {
    const urlTab = router.query.tab
    if (
      typeof urlTab === 'string' &&
      (urlTab === 'proposal' ||
        urlTab === 'treasury' ||
        urlTab === 'team')
    ) {
      setTab(urlTab)
    }
  }, [router.query.tab])

  const handleTabChange = (next: string) => {
    const nextTab = next as ProjectTab
    setTab(nextTab)
    // `shallow + scroll: false`: don't re-run getServerSideProps
    // and don't yank the user back to the top of the page when
    // they're switching tabs — the rail is sticky and the tab
    // strip itself sits inside the main column.
    const { tab: _omit, ...restQuery } = router.query
    router.replace(
      {
        pathname: router.pathname,
        query:
          nextTab === 'proposal'
            ? restQuery
            : { ...restQuery, tab: nextTab },
      },
      undefined,
      { shallow: true, scroll: false }
    )
  }

  if (pending) {
    return (
      <Container>
        <Head title="Proposal Submitted" />
        <div className="flex flex-col items-center justify-center min-h-[60vh] text-center px-4">
          <img
            src="/assets/MoonDAO-Loading-Animation.svg"
            alt="Loading..."
            className="w-20 h-20 mb-6"
          />
          <h1 className="text-2xl font-bold text-white mb-3 font-GoodTimes">
            Setting Up Your Proposal...
          </h1>
          <p className="text-gray-300 text-lg mb-2 max-w-md">
            Your proposal (MDP-{tokenId}) was submitted successfully and is being set up on-chain.
          </p>
          <p className="text-gray-500 text-sm">
            This page will automatically refresh. It usually takes a few seconds.
          </p>
          <div className="mt-6 flex items-center gap-2 text-gray-400 text-sm">
            <svg className="animate-spin h-4 w-4" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
            </svg>
            Waiting for on-chain confirmation...
          </div>
        </div>
      </Container>
    )
  }

  const body = proposalJSON?.body || ''
  const submittedDate = body.match(/^Date:\s*(.+)$/m)?.[1]?.trim() || null
  const authorName = body.match(/^Author:\s*(.+)$/m)?.[1]?.trim() || null
  const displayName = getProjectDisplayName(project, proposalJSON)

  const totalBudgetDisplay = (() => {
    const match = body.match(/\*{0,2}Total\s+Budget\*{0,2}[:\s|]+(.+?)(?:\s*\||\s*$)/im)
    if (match) return match[1].replace(/\*{1,2}/g, '').trim()
    if (!proposalJSON?.budget || proposalJSON.budget.length === 0) return null
    const totals: Record<string, number> = {}
    proposalJSON.budget.forEach((item: any) => {
      totals[item.token] = (totals[item.token] || 0) + Number(item.amount)
    })
    return Object.entries(totals)
      .map(([token, amount]) => `${amount.toLocaleString()} ${token.toUpperCase()}`)
      .join(' + ')
  })()

  return (
    <Container>
      <Head title={displayName} description={project.description} />
      <ContentLayout
        header={displayName}
        headerSize="max(20px, 3vw)"
        maxWidth="1050px"
        description={
          <div className="flex flex-col gap-4">
            <div className="flex flex-wrap items-center gap-1.5 sm:gap-2">
              {proposalJSON?.authorAddress && (
                <AuthorCitizenLink
                  authorAddress={proposalJSON.authorAddress}
                  citizenContract={citizenContract}
                  authorName={authorName}
                />
              )}
              <span className="inline-flex items-center h-7 sm:h-9 text-xs sm:text-sm font-mono text-gray-400 bg-white/5 border border-white/10 rounded-lg px-2 sm:px-3">
                MDP-{project.MDP}
              </span>
              {project.quarter && project.year && (
                <span className="inline-flex items-center h-7 sm:h-9 text-xs sm:text-sm text-gray-400 bg-white/5 border border-white/10 rounded-lg px-2 sm:px-3">
                  Q{project.quarter} {project.year}
                </span>
              )}
              {submittedDate && (
                <span className="inline-flex items-center h-7 sm:h-9 text-xs sm:text-sm text-gray-400 bg-white/5 border border-white/10 rounded-lg px-2 sm:px-3">
                  {submittedDate}
                </span>
              )}
              {totalBudgetDisplay && (
                <span className="inline-flex items-center h-7 sm:h-9 text-xs sm:text-sm text-gray-400 bg-white/5 border border-white/10 rounded-lg px-2 sm:px-3">
                  Budget:&nbsp;<span className="text-gray-200">{totalBudgetDisplay}</span>
                </span>
              )}
              <ProposalStatusBadge status={proposalStatus} />
              <ProposalEditSection
                proposalJSON={proposalJSON}
                projectName={project.name}
                mdp={project.MDP}
              />
            </div>
          </div>
        }
        mainPadding
        mode="compact"
        popOverEffect={false}
        isProfile
        preFooter={
          <NoticeFooter
            defaultImage="../assets/MoonDAO-Logo-White.svg"
            defaultTitle="Need Help?"
            defaultDescription="Submit a ticket in the support channel on MoonDAO's Discord!"
            defaultButtonText="Submit a Ticket"
            defaultButtonLink="https://discord.com/channels/914720248140279868/1212113005836247050"
            imageWidth={200}
            imageHeight={200}
          />
        }
      >
        {(() => {
          // Non-project proposals get the Snapshot/Nance-style two-column
          // layout: proposal body on the left, a sticky vote sidebar
          // running down the right with the live voter list and quadratic
          // voting power. Project proposals fall back to a single column.
          const showVoteSidebar = Boolean(proposalJSON?.nonProjectProposal)
          const sidebarMode: 'voting' | 'closed' | 'inactive' =
            project.active === PROJECT_PENDING && proposalStatus === 'Voting'
              ? 'voting'
              : project.active !== PROJECT_PENDING
              ? 'closed'
              : 'inactive'

          // Proposal tab — proposal-lifecycle content. Final Report
          // (post-completion), Senate Vote interactive section
          // (Temperature Check only), the proposal body itself, and
          // Voting Results (post-tally, non-project proposals only).
          const proposalPane = (
            <div className="flex flex-col gap-4 sm:gap-6 min-w-0">
              {finalReportMarkdown && (
                <SectionCard
                  header="Final Report"
                  iconSrc="/assets/icon-star.svg"
                >
                  <div className="prose prose-invert max-w-none">
                    <MarkdownWithTOC body={finalReportMarkdown} />
                  </div>
                </SectionCard>
              )}

              {/* Senate Vote Section — only renders during Temperature
                  Check, when senators still need the interactive 👍/👎
                  buttons and OPERATORS need the Close Senate Vote
                  control. Once the senate has tallied, the read-only
                  breakdown lives in the right-rail `SenateVoteSidebar`
                  (so it's persistent across Voting / Approved /
                  Cancelled without consuming main-column real estate).
                  Project proposals don't carry the on-chain Senate
                  vote in the same way, so they're excluded. */}
              {project.active === PROJECT_PENDING &&
                proposalStatus === 'Temperature Check' && (
                  <SectionCard
                    header="Senate Vote"
                    iconSrc="/assets/icon-star.svg"
                  >
                    <div className="bg-dark-cool lg:bg-darkest-cool rounded-[20px] p-4 sm:p-6">
                      <SenateVote mdp={project.MDP} />
                    </div>
                  </SectionCard>
                )}

              {/* Proposal body. The "Proposal" tab is the navigation;
                  no need for a duplicate `Proposal` SectionCard
                  header inside it. Just render the markdown on the
                  same SectionCard surface for visual continuity. */}
              <div className="md:bg-gradient-to-br md:from-slate-700/20 md:to-slate-800/30 md:backdrop-blur-xl md:border md:border-white/10 md:rounded-xl px-4 py-3 md:p-6 md:shadow-lg w-full">
                <div className="px-0 sm:px-4 md:px-8 w-full">
                  <div className="prose prose-base prose-invert max-w-none">
                    <MarkdownWithTOC
                      body={(() => {
                        const full = proposalJSON.body || ''
                        const idx = full.search(/^#{1,6}\s*Abstract/im)
                        if (idx !== -1) return full.slice(idx)
                        const plainIdx = full.search(
                          /^\*{0,2}Abstract\*{0,2}\s*$/im
                        )
                        if (plainIdx !== -1) return full.slice(plainIdx)
                        return full
                      })()}
                    />
                  </div>
                </div>
              </div>

              {/* Voting Results Section - Only show for completed
                  proposals. Aggregate verdict card; the right rail
                  still carries the per-voter detail. */}
              {project.active !== PROJECT_PENDING &&
                proposalJSON?.nonProjectProposal && (
                  <SectionCard
                    header="Voting Results"
                    iconSrc="/assets/icon-star.svg"
                  >
                    <div className="bg-dark-cool lg:bg-darkest-cool rounded-[20px] p-5">
                      <VotingResults
                        voteOutcome={voteOutcome}
                        votes={votes}
                        threshold={0}
                      />
                    </div>
                  </SectionCard>
                )}
            </div>
          )

          // Treasury tab — drop the SectionCard wrapper so the tab
          // (already labelled "Treasury") is the only title, then
          // re-create the SectionCard surface inline. `hideHeader`
          // keeps TeamTreasury from rendering its own internal h2.
          const treasuryPane = (
            <div className="md:bg-gradient-to-br md:from-slate-700/20 md:to-slate-800/30 md:backdrop-blur-xl md:border md:border-white/10 md:rounded-xl md:shadow-lg w-full">
              <TeamTreasury
                isSigner={isSigner}
                safeData={safeData}
                multisigAddress={safeAddress}
                safeOwners={safeOwners}
                projectActive={project.active}
                hideHeader
              />
            </div>
          )

          // Team tab — same pattern. The Manage Members button (only
          // visible to managers) stays anchored to the top-right of
          // the card so it doesn't get lost without a SectionCard
          // header to host it.
          const teamPane = (
            <div className="md:bg-gradient-to-br md:from-slate-700/20 md:to-slate-800/30 md:backdrop-blur-xl md:border md:border-white/10 md:rounded-xl px-4 py-3 md:p-6 md:shadow-lg w-full">
              {isManager && (
                <div className="flex justify-end mb-3 md:mb-5">
                  <TeamManageMembers
                    account={account}
                    hats={hats}
                    hatsContract={hatsContract}
                    teamContract={projectContract}
                    teamId={tokenId}
                    selectedChain={selectedChain}
                    multisigAddress={safeAddress}
                    adminHatId={adminHatId}
                    managerHatId={managerHatId}
                  />
                </div>
              )}
              <SlidingCardMenu>
                <div className="flex gap-2 md:gap-4">
                  {hats?.[0].id && (
                    <TeamMembers
                      hats={hats}
                      hatsContract={hatsContract}
                      citizenContract={citizenContract}
                    />
                  )}
                </div>
              </SlidingCardMenu>
            </div>
          )

          // Underline-style tab bar matching the Mission/Launchpad
          // pattern (`MissionInfo.tsx`): text-only, gray-500
          // inactive, white + 2px indigo underline active, sitting
          // on a thin `border-b`. `overflow-x-auto` keeps it
          // single-row on phones.
          const tabButton = (key: ProjectTab, label: string) => {
            const isActive = tab === key
            return (
              <button
                key={key}
                type="button"
                onClick={() => handleTabChange(key)}
                className={`relative px-5 py-3 text-base md:text-lg font-semibold tracking-wide whitespace-nowrap transition-all duration-200 ${
                  isActive
                    ? 'text-white'
                    : 'text-gray-500 hover:text-gray-300'
                }`}
              >
                {label}
                {isActive && (
                  <div className="absolute bottom-0 left-1/2 -translate-x-1/2 w-3/4 h-[2px] bg-indigo-400 rounded-full" />
                )}
              </button>
            )
          }

          const mainColumn = (
            <div className="flex flex-col gap-4 sm:gap-6 min-w-0">
              <div className="flex items-center gap-1 border-b border-white/[0.08] overflow-x-auto max-w-full -mx-1 px-1">
                {tabButton('proposal', 'Proposal')}
                {tabButton('treasury', 'Treasury')}
                {tabButton('team', 'Team')}
              </div>

              {tab === 'proposal' && proposalPane}
              {tab === 'treasury' && treasuryPane}
              {tab === 'team' && teamPane}
            </div>
          )

          if (!showVoteSidebar) {
            return (
              <div
                id="page-container"
                className="pt-2 sm:pt-3 md:pt-4 pb-4 sm:pb-6 md:pb-8"
              >
                {mainColumn}
              </div>
            )
          }

          // The sidebar appears *first* in source order so on mobile the
          // active CTA (Vote button) is above the proposal body — same
          // reasoning as Snapshot's mobile layout. On lg+ the grid
          // rebalances it to the right column. The Senate and Member
          // Vote cards stack inside one sticky wrapper so they scroll
          // together as a single unit (two independent `position:
          // sticky` siblings would race each other for `top: 24px`).
          return (
            <div
              id="page-container"
              className="pt-2 sm:pt-3 md:pt-4 pb-4 sm:pb-6 md:pb-8 grid grid-cols-1 lg:grid-cols-3 gap-4 sm:gap-6"
            >
              <div className="lg:order-2 lg:col-span-1 lg:sticky lg:top-24 lg:self-start flex flex-col gap-4">
                {/* Member Vote sits on top while it's the active step
                    — that's the primary action members can take right
                    now, so it gets the eye-catching styling. The
                    Senate Vote slot below renders as a "completed"
                    reference card so members can still see how the
                    proposal got past senate approval. Once voting is
                    closed, the emphasis lifts and both panels render
                    as peers. */}
                <MemberVoteSidebar
                  project={project}
                  votes={votes}
                  addressToVotingPower={addressToVotingPower}
                  proposalStatus={proposalStatus}
                  mode={sidebarMode}
                  footer={
                    sidebarMode === 'voting' ? (
                      <CloseAndTallyButton
                        mdp={project.MDP}
                        tempCheckApprovedTimestamp={tempCheckApprovedTimestamp}
                      />
                    ) : null
                  }
                />
                <SenateVoteSidebar
                  mdp={project.MDP}
                  secondary={sidebarMode === 'voting'}
                />
              </div>
              <div className="lg:order-1 lg:col-span-2">{mainColumn}</div>
            </div>
          )
        })()}
      </ContentLayout>
    </Container>
  )
}

export const getServerSideProps: GetServerSideProps = async ({ params, query: pageQuery }) => {
  try {
    const rawTokenId = params?.tokenId
    const tokenId = Number.parseInt(String(rawTokenId), 10)

    const chain = DEFAULT_CHAIN_V5
    const chainSlug = getChainSlug(chain)

    if (Number.isNaN(tokenId)) {
      return {
        notFound: true,
      }
    }

    const projectTableName = PROJECT_TABLE_NAMES[chainSlug]
    const proposalContract = getContract({
      client: serverClient,
      address: PROPOSALS_ADDRESSES[chainSlug],
      abi: ProposalsABI.abi as any,
      chain: chain,
    })

    // If this is a newly submitted or updated proposal, retry a few times to allow Tableland to index
    const isNewSubmission = pageQuery?.new === '1'
    const isUpdated = pageQuery?.updated === '1'
    const maxRetries = (isNewSubmission || isUpdated) ? 4 : 1
    const retryDelay = 3000 // 3 seconds between retries

    let project: Project | undefined
    for (let attempt = 0; attempt < maxRetries; attempt++) {
      if (attempt > 0) {
        await new Promise((resolve) => setTimeout(resolve, retryDelay))
      }

      let projects = (
        await queryTable(chain, `SELECT * FROM ${projectTableName} WHERE MDP = ${tokenId}`)
      ).filter(
        (p: Project) =>
          !BLOCKED_PROJECTS.has(Number(p.id)) && !BLOCKED_MDPS.has(Number(p.MDP))
      )

      if (!projects[0]) {
        projects = (
          await queryTable(chain, `SELECT * FROM ${projectTableName} WHERE id = ${tokenId}`)
        ).filter(
          (p: Project) =>
            !BLOCKED_PROJECTS.has(Number(p.id)) && !BLOCKED_MDPS.has(Number(p.MDP))
        )
      }

      if (projects[0]) {
        project = projects[0]
        break
      }
    }

    if (!project) {
      // If this was a new submission and we still couldn't find it, show a pending page
      if (isNewSubmission) {
        return {
          props: {
            pending: true,
            tokenId: String(tokenId),
            project: {} as any,
            safeAddress: '',
            safeOwners: [],
            votes: [],
            proposalStatus: 'Discussion',
            proposalJSON: {},
            voteOutcome: {},
            tempCheckApprovedTimestamp: '0',
          },
        }
      }
      return {
        notFound: true,
      }
    }

    const mdp = project?.MDP

    let tempCheckApproved: any = false
    let tempCheckFailed: any = false
    let tempCheckApprovedTimestamp: any = '0'
    try {
      tempCheckApproved = await readContract({
        contract: proposalContract,
        method: 'tempCheckApproved' as string,
        params: [mdp],
      })
      tempCheckFailed = await readContract({
        contract: proposalContract,
        method: 'tempCheckFailed' as string,
        params: [mdp],
      })
      tempCheckApprovedTimestamp = await readContract({
        contract: proposalContract,
        method: 'tempCheckApprovedTimestamp' as string,
        params: [mdp],
      })
    } catch (error) {
      console.error(`Failed to read proposal contract for MDP ${mdp}:`, error)
    }

    let proposalStatus = getProposalStatus(project.active, tempCheckApproved, tempCheckFailed)

    let proposalJSON: any = {}
    if (isFetchableUrl(project.proposalIPFS)) {
      try {
        const proposalResponse = await fetch(project.proposalIPFS)
        if (!proposalResponse.ok) {
          console.error(
            `Failed to fetch proposal IPFS: ${proposalResponse.status}`
          )
        } else {
          proposalJSON = await proposalResponse.json()
        }
      } catch (error) {
        console.error('Error fetching proposal IPFS:', error)
      }
    }

    // Non-project proposals do not exist in nance and are tallied on-chain
    // via the NonProjectProposal Tableland table, so the nance status overlay
    // would only mask the correct on-chain status. Skip it for those.
    if (
      proposalStatus === 'Temperature Check' &&
      !proposalJSON?.nonProjectProposal
    ) {
      try {
        const { NANCE_API_URL, NANCE_SPACE_NAME } = await import('@/lib/nance/constants')
        const nanceRes = await fetch(`${NANCE_API_URL}/${NANCE_SPACE_NAME}/proposal/${mdp}`)
        if (nanceRes.ok) {
          const nanceData = await nanceRes.json()
          const nanceStatus = nanceData?.data?.status
          if (nanceStatus && nanceStatus !== 'Temperature Check') {
            proposalStatus = nanceStatus
          }
        }
      } catch {
        // Nance API unavailable, use on-chain status
      }
    }

    let votes: DistributionVote[] = []
    let voteOutcome = {}
    // address -> quadratic voting power (sqrt of vMOONEY at the voting
    // window close). Same number we'd use to tally on-chain, so the
    // sidebar list stays consistent with the eventual outcome. Empty
    // object when there are no voters yet (or this is a project
    // proposal that doesn't carry vote rows).
    let addressToVotingPower: { [address: string]: number } = {}
    if (proposalJSON?.nonProjectProposal) {
      try {
        const voteStatement = `SELECT * FROM ${NON_PROJECT_PROPOSAL_TABLE_NAMES[chainSlug]} WHERE MDP = ${mdp}`
        votes = (await queryTable(chain, voteStatement)) as DistributionVote[]
        const voteAddresses = votes.map((v) => v.address)
        // Voting window is 5 days after temp-check approval. Must match
        // pages/api/proposals/nonProjectVote.ts so the previewed outcome
        // here matches the tallied outcome there.
        const votingPeriodClosedTimestamp = parseInt(tempCheckApprovedTimestamp) + 60 * 60 * 24 * 5

        if (voteAddresses.length > 0) {
          const vMOONEYs = await fetchTotalVMOONEYs(voteAddresses, votingPeriodClosedTimestamp)
          addressToVotingPower = Object.fromEntries(
            voteAddresses.map((address, index) => [address, Math.sqrt(vMOONEYs[index])])
          )
          const SUM_TO_ONE_HUNDRED = 100
          voteOutcome = runQuadraticVoting(votes, addressToVotingPower, SUM_TO_ONE_HUNDRED)
        }
      } catch (error) {
        console.error('Error fetching votes:', error)
      }
    }

    let safeAddress = ''
    try {
      const projectContract = getContract({
        client: serverClient,
        address: PROJECT_ADDRESSES[chainSlug],
        abi: ProjectABI as any,
        chain: chain,
      })

      safeAddress = await readContract({
        contract: projectContract,
        method: 'ownerOf' as string,
        params: [project.id],
      })
    } catch (error) {
      console.error(`Failed to read ownerOf for project ${project.id}:`, error)
    }

    let safeOwners: string[] = []
    if (safeAddress) {
      try {
        const rpcUrl = getRpcUrlForChain({
          client: serverClient,
          chain: chain,
        })
        const safe = await Safe.init({
          provider: rpcUrl,
          safeAddress: safeAddress,
        })
        safeOwners = await safe.getOwners()
      } catch (error) {
        console.error('Error initializing Safe:', error)
      }
    }

    return {
      props: {
        project,
        tokenId,
        safeAddress,
        safeOwners,
        votes,
        proposalStatus,
        proposalJSON,
        voteOutcome,
        addressToVotingPower,
        tempCheckApprovedTimestamp: tempCheckApprovedTimestamp
          ? tempCheckApprovedTimestamp.toString()
          : '0',
      },
    }
  } catch (error) {
    console.error('Error in getServerSideProps:', error)
    return {
      notFound: true,
    }
  }
}
