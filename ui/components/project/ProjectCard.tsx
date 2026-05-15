//This component dipslays a project card using project data directly from tableland
import { trimActionsFromBody } from '@nance/nance-sdk'
import { usePrivy } from '@privy-io/react-auth'
import CitizenABI from 'const/abis/Citizen.json'
import {
  CITIZEN_ADDRESSES,
  DEFAULT_CHAIN_V5,
  IS_SENATE_VOTE,
} from 'const/config'
import { getProposalVideoUrl } from 'const/proposalVideos'
import Link from 'next/link'
import { useRouter } from 'next/router'
import React, { useContext, memo, useState, useMemo, useEffect } from 'react'
import { readContract } from 'thirdweb'
import { useActiveAccount } from 'thirdweb/react'
import { useSubHats } from '@/lib/hats/useSubHats'
import useUniqueHatWearers from '@/lib/hats/useUniqueHatWearers'
import { PROJECT_ACTIVE, PROJECT_PENDING } from '@/lib/nance/types'
import useProposalJSON from '@/lib/nance/useProposalJSON'
import { getProjectDisplayName } from '@/lib/project/getProjectDisplayName'
import useProjectData, { Project } from '@/lib/project/useProjectData'
import { getChainSlug } from '@/lib/thirdweb/chain'
import ChainContextV5 from '@/lib/thirdweb/chain-context-v5'
import useContract from '@/lib/thirdweb/hooks/useContract'
import { normalizeJsonString } from '@/lib/utils/rewards'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import AuthorCitizenLink from '@/components/project/AuthorCitizenLink'
import { SenateVoteButtons, SenatorsStatus } from '@/components/project/SenateVote'
import { LoadingSpinner } from '../layout/LoadingSpinner'
import NumberStepper from '../layout/NumberStepper'
import StandardButton from '../layout/StandardButton'

// Helper to strip the first H1 heading from markdown body (to avoid title duplication)
const stripFirstHeading = (body: string): string => {
  // Match first H1 heading at the start of the body (with optional leading whitespace)
  const h1Regex = /^\s*#\s+[^\n]*\n?/
  return body.replace(h1Regex, '').trim()
}

// Proposal Markdown component with proper table support
const ProposalMarkdown = ({ body }: { body: string }) => (
  <article className="w-full break-words text-white overflow-x-hidden">
    <ReactMarkdown
      remarkPlugins={[remarkGfm]}
      components={{
        h1: ({ node, ...props }) => (
          <h1 className="font-GoodTimes text-2xl md:text-3xl mt-6 mb-4 text-white" {...props} />
        ),
        h2: ({ node, ...props }) => (
          <h2 className="font-GoodTimes text-xl md:text-2xl mt-6 mb-3 text-white" {...props} />
        ),
        h3: ({ node, ...props }) => (
          <h3 className="font-GoodTimes text-lg md:text-xl mt-5 mb-2 text-white" {...props} />
        ),
        h4: ({ node, ...props }) => (
          <h4 className="font-GoodTimes text-base md:text-lg mt-4 mb-2 text-white" {...props} />
        ),
        table: ({ node, ...props }) => (
          <div className="mb-6 overflow-x-auto -mx-2 md:mx-0">
            <div className="min-w-full inline-block md:rounded-xl overflow-hidden md:border md:border-white/10 md:bg-gradient-to-br md:from-slate-700/20 md:to-slate-800/30">
              <table className="text-left w-full min-w-[600px] border-collapse" {...props} />
            </div>
          </div>
        ),
        thead: ({ node, ...props }) => (
          <thead className="bg-slate-800/50" {...props} />
        ),
        tbody: ({ node, ...props }) => (
          <tbody {...props} />
        ),
        tr: ({ node, ...props }) => (
          <tr className="border-b border-white/10" {...props} />
        ),
        th: ({ node, ...props }) => (
          <th
            className="whitespace-normal border-b border-white/10 text-white font-semibold py-2 px-2 md:py-4 md:px-6 bg-slate-800/30 text-xs md:text-base"
            {...props}
          />
        ),
        td: ({ node, ...props }) => (
          <td
            className="whitespace-normal border-b border-white/5 text-white/90 py-2 px-2 md:py-4 md:px-6 text-xs md:text-base"
            {...props}
          />
        ),
        p: ({ node, ...props }) => <p className="text-white mb-4" {...props} />,
        strong: ({ node, children, ...props }) => (
          <strong className="text-white font-bold" {...props}>
            {children}
          </strong>
        ),
        em: ({ node, ...props }) => <em className="text-white italic" {...props} />,
        a: ({ node, ...props }) => (
          <a
            className="text-blue-400 hover:text-blue-300 underline transition-colors"
            target="_blank"
            rel="noopener noreferrer"
            {...props}
          />
        ),
        ul: ({ node, ...props }) => (
          <ul className="list-disc ml-6 mb-4 text-white" {...props} />
        ),
        ol: ({ node, ...props }) => (
          <ol className="list-decimal ml-6 mb-4 text-white" {...props} />
        ),
        li: ({ node, ...props }) => (
          <li className="text-white mb-2 leading-relaxed" {...props} />
        ),
        blockquote: ({ node, ...props }) => (
          <blockquote className="border-l-4 border-blue-500 pl-4 my-4 text-white/80 italic" {...props} />
        ),
        code: ({ node, className, children, ...props }) => {
          const isInline = !className
          return isInline ? (
            <code className="bg-slate-700/50 px-1.5 py-0.5 rounded text-sm text-orange-300" {...props}>
              {children}
            </code>
          ) : (
            <code className="block bg-slate-800/50 p-4 rounded-lg overflow-x-auto text-sm" {...props}>
              {children}
            </code>
          )
        },
        pre: ({ node, ...props }) => (
          <pre className="bg-slate-800/50 p-4 rounded-lg overflow-x-auto mb-4" {...props} />
        ),
      }}
    >
      {body}
    </ReactMarkdown>
  </article>
)

type ProjectCardProps = {
  project: Project | undefined
  projectContract: any
  hatsContract: any
  distribute?: boolean
  userContributed?: boolean
  distribution?: Record<string, number>
  handleDistributionChange?: (projectId: string, value: number) => void
  userHasVotingPower?: any
  isVotingPeriod?: boolean
  active?: boolean
  // Optional override for the senate-vote phase. Defaults to the
  // `IS_SENATE_VOTE` config constant. Operators can flip this off via the
  // operator panel without redeploying.
  isSenateVote?: boolean
  // Hide the inline status pill ("Active" / "Inactive" / budget) in the
  // card header. Useful when the surrounding tab already provides the
  // context (e.g. the Retroactive Rewards tab).
  hideStatusBadge?: boolean
  // Force the card to wrap with a Link to /project/{MDP} (navigate on
  // click) even in distribute / vote modes that would otherwise toggle
  // an in-place proposal expansion. Used by the Retroactive Rewards tab
  // to keep card behavior consistent with the standard project listings.
  linkToProjectPage?: boolean
}

const ProjectCardContent = memo(
  ({
    project,
    distribution,
    handleDistributionChange,
    distribute,
    userContributed,
    userHasVotingPower,
    isMembershipDataLoading,
    isVotingPeriod,
    active,
    isExpanded,
    onToggleExpand,
    citizenContract,
    isSenateVote = IS_SENATE_VOTE,
    hideStatusBadge = false,
  }: any) => {
    const proposalJSON = useProposalJSON(project)
    const account = useActiveAccount()
    const isProposalAuthor = Boolean(
      proposalJSON?.authorAddress &&
        account?.address &&
        proposalJSON.authorAddress.toLowerCase() === account.address.toLowerCase()
    )
    const description =
      project && project.MDP < 13 ? project.description : project?.description || ''

    const authorName = useMemo(() => {
      const body = proposalJSON?.body || ''
      return body.match(/^Author:\s*(.+)$/m)?.[1]?.trim() || null
    }, [proposalJSON?.body])

    const displayName = useMemo(
      () => getProjectDisplayName(project, proposalJSON),
      [project, proposalJSON]
    )

    // State for senator votes (passed up from SenateVoteButtons)
    const [senatorVotes, setSenatorVotes] = useState<any[]>([])
    const [senatorVotesLoading, setSenatorVotesLoading] = useState(false)

    const handleSenatorVotesChange = React.useCallback((votes: any[], loading: boolean) => {
      setSenatorVotes(votes)
      setSenatorVotesLoading(loading)
    }, [])

    // Set character limits that better match the new card height
    const [characterLimit, setCharacterLimit] = useState(600)

    useEffect(() => {
      const handleResize = () => {
        if (typeof window !== 'undefined') {
          setCharacterLimit(window.innerWidth >= 1024 ? 700 : 600)
        }
      }

      if (typeof window !== 'undefined') {
        handleResize()
        window.addEventListener('resize', handleResize)
        return () => window.removeEventListener('resize', handleResize)
      }
    }, [])

    const handleCardClick = (e: React.MouseEvent) => {
      // Handle expansion when onToggleExpand is provided (Senate Vote or distribute mode)
      if (onToggleExpand) {
        // Don't toggle if clicking on buttons or links
        const target = e.target as HTMLElement
        if (target.closest('button') || target.closest('a')) {
          return
        }
        onToggleExpand()
      }
    }

    return (
      <div
        id="card-container"
        onClick={handleCardClick}
        className={`p-3 sm:p-6 pb-3 sm:pb-4 flex flex-col gap-2 sm:gap-3 relative w-full transition-all duration-300 bg-gradient-to-br from-slate-700/20 to-slate-800/30 backdrop-blur-xl border border-white/10 rounded-lg sm:rounded-xl shadow-lg hover:bg-gradient-to-br hover:from-slate-600/30 hover:to-slate-700/40 hover:shadow-xl ${
          isExpanded 
            ? 'h-auto' 
            : 'h-full min-h-[180px] hover:scale-[1.02]'
        } ${onToggleExpand ? 'cursor-pointer' : ''}`}
      >
        <div className="flex flex-col sm:flex-row sm:justify-between sm:items-start gap-3 sm:gap-0">
          <div className="flex-1 min-w-0 flex flex-col gap-3">
            <div className="flex flex-col gap-2">
              <div className="flex flex-col sm:flex-row sm:justify-between sm:items-start gap-2">
                <div className="flex flex-col gap-1.5 min-w-0">
                  <div className="flex flex-wrap items-center gap-1.5">
                    {project?.MDP !== undefined && project?.MDP !== null && (
                      <span
                        data-testid="project-mdp-number"
                        className="w-fit px-2 py-0.5 rounded-md text-[11px] font-semibold font-mono tracking-wider uppercase bg-moon-indigo/30 text-moon-gold border border-moon-gold/30"
                      >
                        MDP-{project.MDP}
                      </span>
                    )}
                    {proposalJSON?.authorAddress && (
                      <div
                        data-testid="project-author"
                        onClick={(e) => e.stopPropagation()}
                      >
                        <AuthorCitizenLink
                          authorAddress={proposalJSON.authorAddress}
                          citizenContract={citizenContract}
                          authorName={authorName}
                          compact
                        />
                      </div>
                    )}
                  </div>
                  {onToggleExpand ? (
                    // Invert the nesting so the anchor lives inside the
                    // heading (`<h1><a/></h1>`) instead of wrapping it
                    // (`<a><h1/></a>`). The latter is "transparent content"
                    // per HTML5 but browsers' parsers re-arrange block
                    // children of an inline `<a>` during parse, which causes
                    // a hydration mismatch ("Expected server HTML to contain
                    // a matching <div> in <a>") in dev mode.
                    <h1 className="font-GoodTimes text-white text-lg sm:text-xl hover:text-moon-gold transition-colors cursor-pointer break-words">
                      <Link
                        href={`/project/${project?.MDP}`}
                        onClick={(e) => e.stopPropagation()}
                      >
                        {displayName}
                      </Link>
                    </h1>
                  ) : (
                    <h1 className="font-GoodTimes text-white text-lg sm:text-xl hover:text-moon-gold transition-colors cursor-pointer break-words">
                      {displayName}
                    </h1>
                  )}
                </div>
                {/* Only show status badge inline when NOT in Senate Vote mode
                    and the parent hasn't opted out (e.g. Retroactive Rewards
                    tab, which already implies "Active"). */}
                {!isSenateVote && !hideStatusBadge && (
                  <span
                    className={`w-fit sm:mr-4 px-3 py-1.5 rounded-lg text-sm font-medium flex-shrink-0 ${
                      project.active == PROJECT_ACTIVE
                        ? 'bg-green-500/20 text-green-300 border border-green-500/30'
                        : project.active == PROJECT_PENDING
                        ? 'bg-blue-500/20 text-blue-300 border border-blue-500/30'
                        : 'bg-gray-500/20 text-gray-300 border border-gray-500/30'
                    }`}
                  >
                    {proposalJSON?.nonProjectProposal
                      ? 'Non-project Proposal'
                      : project.active == PROJECT_ACTIVE
                      ? 'Active'
                      : project.active == PROJECT_PENDING
                      ? `Budget: $${proposalJSON?.usdBudget?.toLocaleString()}`
                      : 'Inactive'}
                  </span>
                )}
              </div>
              {/* Senator participation status - aligned with title on the left */}
              {isSenateVote && project?.MDP && project.active === PROJECT_PENDING && (
                <SenatorsStatus senatorVotes={senatorVotes} isLoading={senatorVotesLoading} />
              )}
            </div>
            <div className="flex flex-wrap items-center gap-2">
              {(project?.finalReportLink || project?.finalReportIPFS) && (
                <StandardButton
                  className={`bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 w-fit text-sm px-3 py-2 rounded-lg shadow-md hover:shadow-lg transition-all duration-200 ${
                    distribute && 'sm:mr-4'
                  }`}
                  link={
                    project?.finalReportIPFS ? `/project/${project.MDP}` : project?.finalReportLink
                  }
                  onClick={(e: any) => {
                    e.stopPropagation()
                  }}
                  hoverEffect={false}
                  target={project?.finalReportIPFS ? '_self' : '_blank'}
                >
                  <p className="text-sm font-medium">📋 Final Report</p>
                </StandardButton>
              )}
              {(() => {
                const videoUrl = getProposalVideoUrl(project?.MDP)
                if (!videoUrl) return null
                return (
                  <a
                    href={videoUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    onClick={(e) => e.stopPropagation()}
                    className="inline-flex items-center gap-1 text-xs text-white/60 hover:text-white underline underline-offset-2 transition-colors"
                  >
                    <span aria-hidden>▶</span>
                    <span>Watch presentation</span>
                  </a>
                )
              })()}
            </div>
          </div>
          {/* Senate Vote mode: show budget badge and vote buttons together on the right (desktop) or below title (mobile) */}
          {isSenateVote && project?.MDP && project.active === PROJECT_PENDING && (
            <div className="w-full sm:w-auto">
              <SenateVoteButtons 
                mdp={project.MDP} 
                budgetLabel={proposalJSON?.nonProjectProposal 
                  ? 'Non-project Proposal' 
                  : `Budget: $${proposalJSON?.usdBudget?.toLocaleString()}`
                }
                onSenatorVotesChange={handleSenatorVotesChange}
              />
            </div>
          )}
          {!isSenateVote && distribute &&
            (isProposalAuthor ? (
              <div className="flex flex-col items-start sm:items-end flex-shrink-0">
                <p className="text-gray-400 text-sm">Author</p>
              </div>
            ) : userContributed ? (
              <div className="flex flex-col items-start sm:items-end flex-shrink-0">
                <p className="text-gray-400">
                  {isMembershipDataLoading ? 'Checking...' : 'Contributed'}
                </p>
                {isMembershipDataLoading && (
                  <LoadingSpinner
                    width="w-4"
                    height="h-4"
                    className="text-gray-400 border-gray-400 border-t-transparent mt-1"
                  />
                )}
              </div>
            ) : (
              <div className="flex-shrink-0">
                <NumberStepper
                  number={distribution?.[project?.id] || 0}
                  setNumber={(value: any) => {
                    if (distribution && handleDistributionChange) {
                      handleDistributionChange(String(project?.id), value)
                    }
                  }}
                  step={1}
                  min={0}
                  max={100}
                  isDisabled={!userHasVotingPower}
                />
              </div>
            ))}
        </div>
        {/* Description Section */}
        <div className="flex-1 flex flex-col">
          {isExpanded && proposalJSON?.body ? (
            // Expanded view with full proposal (strip first heading and actions)
            <div className="description-container pr-2">
              <ProposalMarkdown body={trimActionsFromBody(stripFirstHeading(proposalJSON.body))} />
            </div>
          ) : (
            // Collapsed view with truncated description
            <div className="description-container overflow-hidden pr-2">
              <p className="text-green-100 text-sm leading-relaxed">
                {project.description?.length > characterLimit
                  ? `${project.description.substring(0, characterLimit)}...`
                  : project.description || 'No description available'}
              </p>
            </div>
          )}
        </div>

        {/* Footer - Always visible */}
        <div className="pt-3 border-t border-green-500/10 flex-shrink-0 mt-auto">
          <div className={`text-xs font-medium transition-colors flex items-center gap-1 ${
            onToggleExpand 
              ? 'text-orange-400 hover:text-orange-300' 
              : 'text-green-300 hover:text-green-200'
          }`}>
            {onToggleExpand 
              ? (isExpanded 
                  ? <><span className="text-base">▲</span> Click to collapse</> 
                  : <><span className="text-base">▼</span> Click to expand proposal</>)
              : 'Click to view details →'}
          </div>
        </div>
      </div>
    )
  }
)
ProjectCardContent.displayName = 'ProjectCardContent'

export default function ProjectCard({
  project,
  projectContract,
  hatsContract,
  distribute,
  distribution,
  handleDistributionChange,
  userHasVotingPower,
  isVotingPeriod,
  active,
  isSenateVote: isSenateVoteProp,
  hideStatusBadge,
  linkToProjectPage,
}: ProjectCardProps) {
  const isSenateVote = isSenateVoteProp ?? IS_SENATE_VOTE
  const router = useRouter()
  const account = useActiveAccount()
  const address = account?.address
  const [isExpanded, setIsExpanded] = useState(false)

  const { adminHatId } = useProjectData(projectContract, hatsContract, project)
  const { authenticated } = usePrivy()

  const { selectedChain } = useContext(ChainContextV5)
  const chainSlug = getChainSlug(selectedChain)
  const citizenContract = useContract({
    address: CITIZEN_ADDRESSES[chainSlug],
    abi: CitizenABI as any,
    chain: selectedChain,
  })
  const hats = useSubHats(selectedChain, adminHatId, !!project?.eligible)
  const wearers = useUniqueHatWearers(hats)

  // Improved contributor detection with both hat-based and rewardDistribution-based checks
  const userContributed = useMemo(() => {
    if (!address || !project || !authenticated) return false

    let isContributor = false
    if (wearers && address) {
      wearers.forEach((wearer: { address: string }) => {
        if (address.toLowerCase() === wearer['address'].toLowerCase()) {
          isContributor = true
        }
      })
    }

    let rewardDistributionContribution = false
    if (project.rewardDistribution) {
      try {
        const contributors: { [key: string]: number } = normalizeJsonString(
          project.rewardDistribution
        )
        rewardDistributionContribution = Object.keys(contributors).some(
          (contributor) => contributor.toLowerCase() === address.toLowerCase()
        )
      } catch (error) {
        console.error('Error parsing rewardDistribution:', error)
      }
    }

    return isContributor || rewardDistributionContribution
  }, [wearers, address, project])

  const isMembershipDataLoading = useMemo(() => {
    // Still loading if we have an adminHatId but no hats or wearers data yet
    const hatDataLoading = !!(adminHatId && (!hats || !wearers))

    const contributionCheckLoading =
      distribute &&
      address &&
      project &&
      !project.rewardDistribution && // No rewardDistribution data
      adminHatId && // Has adminHatId (so should have hat data)
      !wearers // But no wearers data yet

    return hatDataLoading || contributionCheckLoading
  }, [adminHatId, hats, wearers, distribute, address, project])

  if (!project) return null

  // When `linkToProjectPage` is set we want the whole card to act as a
  // navigation affordance to /project/<MDP>, but the card itself renders
  // other anchors and buttons (Final Report link, video <a>, distribute
  // controls, etc.). Wrapping in a real <Link> would produce nested <a>
  // tags (invalid HTML) and swallow clicks on those inner controls, so
  // instead the wrapper handles navigation imperatively and bails when
  // the click originated inside any interactive descendant.
  if (linkToProjectPage) {
    const handleCardClick = (
      e: React.MouseEvent<HTMLDivElement> | React.KeyboardEvent<HTMLDivElement>
    ) => {
      const target = e.target as HTMLElement | null
      if (target?.closest('a, button, input, textarea, select, label')) {
        return
      }
      if ('key' in e && e.key !== 'Enter' && e.key !== ' ') return
      e.preventDefault()
      router.push(`/project/${project?.MDP}`)
    }

    return (
      <div
        role="link"
        tabIndex={0}
        onClick={handleCardClick}
        onKeyDown={handleCardClick}
        className="h-full cursor-pointer focus:outline-none focus:ring-2 focus:ring-moon-orange/60 rounded-2xl"
        aria-label={`Open project ${project?.name || project?.MDP}`}
      >
        <ProjectCardContent
          project={project}
          distribute={distribute}
          userContributed={userContributed}
          distribution={distribution}
          handleDistributionChange={handleDistributionChange}
          userHasVotingPower={userHasVotingPower}
          isMembershipDataLoading={isMembershipDataLoading}
          isVotingPeriod={isVotingPeriod}
          active={active}
          isExpanded={false}
          citizenContract={citizenContract}
          isSenateVote={isSenateVote}
          hideStatusBadge={hideStatusBadge}
        />
      </div>
    )
  }

  return (
    <div className="h-full">
      {distribute || isSenateVote ? (
        <ProjectCardContent
          project={project}
          distribute={distribute}
          userContributed={userContributed}
          distribution={distribution}
          handleDistributionChange={handleDistributionChange}
          userHasVotingPower={userHasVotingPower}
          isMembershipDataLoading={isMembershipDataLoading}
          isVotingPeriod={isVotingPeriod}
          active={active}
          isExpanded={isExpanded}
          onToggleExpand={() => setIsExpanded(!isExpanded)}
          citizenContract={citizenContract}
          isSenateVote={isSenateVote}
          hideStatusBadge={hideStatusBadge}
        />
      ) : (
        // `ProjectCardContent` renders a top-level `<div>`, so wrapping it
        // in a `<Link>` (which renders an `<a>`) produces `<a><div/></a>`.
        // That's "transparent content" per HTML5, but browsers' parsers
        // re-arrange the tree during parse, which surfaces in dev mode as a
        // hydration error ("Expected server HTML to contain a matching
        // <div> in <a>"). It also nests other anchors/buttons inside the
        // outer `<a>`, which is invalid HTML. Mirror the imperative-
        // navigation pattern used by the `linkToProjectPage` branch above
        // so the card keeps its click-to-navigate affordance without the
        // anchor wrapper.
        <CardLinkWrapper mdp={project?.MDP} ariaLabel={project?.name || project?.MDP}>
          <ProjectCardContent
            project={project}
            userHasVotingPower={userHasVotingPower}
            isVotingPeriod={isVotingPeriod}
            active={active}
            isExpanded={false}
            citizenContract={citizenContract}
            isSenateVote={isSenateVote}
            hideStatusBadge={hideStatusBadge}
          />
        </CardLinkWrapper>
      )}
    </div>
  )
}

// Click-to-navigate wrapper used by the default (non-vote, non-distribute)
// `ProjectCard` branch. Avoids `<a><div/></a>` markup by rendering a `<div>`
// with `role="link"` and pushing imperatively. Bails when the click
// originates inside a real interactive descendant (anchor, button, form
// control) so inner controls keep their own behavior.
function CardLinkWrapper({
  mdp,
  ariaLabel,
  children,
}: {
  mdp: number | string | undefined
  ariaLabel: string | number | undefined
  children: React.ReactNode
}) {
  const router = useRouter()
  const navigate = () => {
    if (mdp === undefined || mdp === null) return
    router.push(`/project/${mdp}`)
  }
  const handleClick = (e: React.MouseEvent<HTMLDivElement>) => {
    const target = e.target as HTMLElement | null
    if (target?.closest('a, button, input, textarea, select, label')) return
    navigate()
  }
  const handleKeyDown = (e: React.KeyboardEvent<HTMLDivElement>) => {
    if (e.key !== 'Enter' && e.key !== ' ') return
    const target = e.target as HTMLElement | null
    if (target?.closest('a, button, input, textarea, select, label')) return
    e.preventDefault()
    navigate()
  }
  return (
    <div
      role="link"
      tabIndex={0}
      onClick={handleClick}
      onKeyDown={handleKeyDown}
      className="h-full cursor-pointer focus:outline-none focus:ring-2 focus:ring-moon-orange/60 rounded-2xl"
      aria-label={`Open project ${ariaLabel ?? ''}`}
    >
      {children}
    </div>
  )
}
