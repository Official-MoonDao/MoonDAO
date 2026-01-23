//This component dipslays a project card using project data directly from tableland
import { usePrivy } from '@privy-io/react-auth'
import confetti from 'canvas-confetti'
import ProposalsABI from 'const/abis/Proposals.json'
import SenatorsABI from 'const/abis/Senators.json'
import { DEFAULT_CHAIN_V5, PROPOSALS_ADDRESSES, SENATORS_ADDRESSES, IS_SENATE_VOTE } from 'const/config'
import Link from 'next/link'
import React, { useContext, memo, useState, useMemo, useEffect } from 'react'
import { prepareContractCall, sendAndConfirmTransaction, readContract } from 'thirdweb'
import { useActiveAccount } from 'thirdweb/react'
import { useSubHats } from '@/lib/hats/useSubHats'
import useUniqueHatWearers from '@/lib/hats/useUniqueHatWearers'
import { PROJECT_ACTIVE, PROJECT_PENDING } from '@/lib/nance/types'
import useProposalJSON from '@/lib/nance/useProposalJSON'
import useProjectData, { Project } from '@/lib/project/useProjectData'
import useProposalData from '@/lib/project/useProposalData'
import { getChainSlug } from '@/lib/thirdweb/chain'
import ChainContextV5 from '@/lib/thirdweb/chain-context-v5'
import useContract from '@/lib/thirdweb/hooks/useContract'
import { normalizeJsonString } from '@/lib/utils/rewards'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import { PrivyWeb3Button } from '@/components/privy/PrivyWeb3Button'
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
}

// Hook to check if the current user is a Senator
const useIsSenator = () => {
  const chain = DEFAULT_CHAIN_V5
  const chainSlug = getChainSlug(chain)
  const account = useActiveAccount()
  const { authenticated } = usePrivy()
  const [isSenator, setIsSenator] = useState(false)
  const [isLoading, setIsLoading] = useState(true)
  
  const senatorsContract = useContract({
    address: SENATORS_ADDRESSES[chainSlug],
    chain: chain,
    abi: SenatorsABI.abi as any,
  })
  
  useEffect(() => {
    async function checkSenator() {
      // Only check senator status if user is authenticated via Privy
      if (!authenticated || !account?.address || !senatorsContract) {
        setIsSenator(false)
        setIsLoading(false)
        return
      }
      
      try {
        const result = await readContract({
          contract: senatorsContract,
          method: 'isSenator' as string,
          params: [account.address],
        })
        setIsSenator(Boolean(result))
        console.log("isSenator is", Boolean(result))
      } catch (error) {
        console.error('Error checking senator status:', error)
        setIsSenator(false)
      }
      setIsLoading(false)
    }
    
    checkSenator()
  }, [authenticated, account?.address, senatorsContract])
  
  return { isSenator, isLoading }
}

// Senate Vote component for thumbs up/down voting
const SenateVoteButtons = memo(({ mdp }: { mdp: number }) => {
  const chain = DEFAULT_CHAIN_V5
  const chainSlug = getChainSlug(chain)
  const account = useActiveAccount()
  const { authenticated } = usePrivy()
  const { isSenator, isLoading: isSenatorLoading } = useIsSenator()
  
  const proposalContract = useContract({
    address: PROPOSALS_ADDRESSES[chainSlug],
    chain: chain,
    abi: ProposalsABI.abi as any,
  })
  
  const { proposalData, isLoading, refetch } = useProposalData(proposalContract, mdp)
  
  const handleVote = (pass: boolean) => {
    return async () => {
      if (!account) return
      const transaction = prepareContractCall({
        contract: proposalContract,
        method: 'voteTempCheck' as string,
        params: [mdp, pass],
      })
      await sendAndConfirmTransaction({
        transaction,
        account,
      })
      // Trigger confetti animation on successful vote
      confetti({
        particleCount: 150,
        spread: 100,
        origin: { y: 0.6 },
        shapes: ['circle', 'star'],
        colors: pass 
          ? ['#22c55e', '#4ade80', '#86efac', '#ffffff', '#FFD700'] // Green theme for thumbs up
          : ['#ef4444', '#f87171', '#fca5a5', '#ffffff', '#FFD700'], // Red theme for thumbs down
      })
      refetch()
    }
  }
  
  const approvalCount = 'tempCheckApprovalCount' in proposalData 
    ? Number(proposalData?.tempCheckApprovalCount || 0).toString() 
    : '0'
  const rejectionCount = 'tempCheckVoteCount' in proposalData 
    ? (Number(proposalData?.tempCheckVoteCount || 0) - Number(proposalData?.tempCheckApprovalCount || 0)).toString() 
    : '0'
  
  // Show loading state while checking senator status or loading proposal data
  if (isSenatorLoading || isLoading) {
    return (
      <div className="flex items-center gap-2 flex-shrink-0">
        <LoadingSpinner width="w-5" height="h-5" />
      </div>
    )
  }
  
  // Show interactive voting buttons only for authenticated senators
  // Use Privy's authenticated state as the source of truth
  if (isSenator && account && authenticated) {
    return (
      <div className="flex items-center gap-2 flex-shrink-0">
        <PrivyWeb3Button
          action={handleVote(true)}
          requiredChain={DEFAULT_CHAIN_V5}
          className="!px-3 !py-2 !min-w-0 !h-[36px] rounded-lg bg-green-600 hover:bg-green-700 text-white font-medium text-sm transition-all"
          label={`👍 ${approvalCount}`}
        />
        <PrivyWeb3Button
          action={handleVote(false)}
          requiredChain={DEFAULT_CHAIN_V5}
          className="!px-3 !py-2 !min-w-0 !h-[36px] rounded-lg bg-red-600 hover:bg-red-700 text-white font-medium text-sm transition-all"
          label={`👎 ${rejectionCount}`}
        />
      </div>
    )
  }
  
  // Default: Show read-only vote tally for non-senators and non-authenticated users
  return (
    <div className="flex items-center gap-2 flex-shrink-0">
      <div className="px-3 py-2 h-[36px] rounded-lg bg-green-600/50 text-white font-medium text-sm flex items-center">
        👍 {approvalCount}
      </div>
      <div className="px-3 py-2 h-[36px] rounded-lg bg-red-600/50 text-white font-medium text-sm flex items-center">
        👎 {rejectionCount}
      </div>
    </div>
  )
})
SenateVoteButtons.displayName = 'SenateVoteButtons'

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
  }: any) => {
    const proposalJSON = useProposalJSON(project)
    const account = useActiveAccount()
    const description =
      project && project.MDP < 13 ? project.description : project?.description || ''

    // Set character limits that better match the new card height
    const [characterLimit, setCharacterLimit] = useState(380)

    useEffect(() => {
      const handleResize = () => {
        if (typeof window !== 'undefined') {
          // Adjust limits for the new 280px height with better spacing
          setCharacterLimit(window.innerWidth >= 1024 ? 420 : 380)
        }
      }

      if (typeof window !== 'undefined') {
        handleResize()
        window.addEventListener('resize', handleResize)
        return () => window.removeEventListener('resize', handleResize)
      }
    }, [])

    const handleCardClick = (e: React.MouseEvent) => {
      // Only handle expansion for Senate Vote mode
      if (IS_SENATE_VOTE && onToggleExpand) {
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
        className={`p-4 sm:p-6 pb-4 flex flex-col gap-3 relative w-full transition-all duration-300 bg-gradient-to-br from-slate-700/20 to-slate-800/30 backdrop-blur-xl border border-white/10 rounded-xl shadow-lg hover:bg-gradient-to-br hover:from-slate-600/30 hover:to-slate-700/40 hover:shadow-xl ${
          isExpanded 
            ? 'h-auto' 
            : 'h-auto min-h-[240px] hover:scale-[1.02]'
        } ${IS_SENATE_VOTE ? 'cursor-pointer' : ''}`}
      >
        <div className="flex flex-col sm:flex-row sm:justify-between sm:items-start gap-3 sm:gap-0">
          <div className="flex-1 min-w-0 flex flex-col gap-3">
            <div className="flex flex-col sm:flex-row sm:justify-between sm:items-start gap-2">
              <Link href={`/project/${project?.MDP}`} passHref>
                <h1 className="font-GoodTimes text-white text-lg sm:text-xl hover:text-moon-gold transition-colors cursor-pointer break-words">
                  {project?.name || ''}
                </h1>
              </Link>
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
                  ? `Budget: ${proposalJSON?.ethBudget} ETH`
                  : 'Inactive'}
              </span>
            </div>
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
          </div>
          {IS_SENATE_VOTE && project?.MDP && project.active === PROJECT_PENDING && (
            <SenateVoteButtons mdp={project.MDP} />
          )}
          {!IS_SENATE_VOTE && distribute &&
            (userContributed ? (
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
          {!distribute && isVotingPeriod && (
            <div className="flex flex-col items-start sm:items-end flex-shrink-0">
              <p className="text-gray-400 text-sm">Ineligible</p>
            </div>
          )}
        </div>
        {/* Description Section */}
        <div className="flex-1 flex flex-col">
          {isExpanded && proposalJSON?.body ? (
            // Expanded view with full proposal (strip first heading to avoid title duplication)
            <div className="description-container pr-2">
              <ProposalMarkdown body={stripFirstHeading(proposalJSON.body)} />
            </div>
          ) : (
            // Collapsed view with truncated description
            <div className="description-container overflow-hidden max-h-[80px] pr-2">
              <p className="text-green-100 text-sm leading-relaxed line-clamp-4">
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
            IS_SENATE_VOTE 
              ? 'text-orange-400 hover:text-orange-300' 
              : 'text-green-300 hover:text-green-200'
          }`}>
            {IS_SENATE_VOTE 
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
}: ProjectCardProps) {
  const account = useActiveAccount()
  const address = account?.address
  const [isExpanded, setIsExpanded] = useState(false)

  const { adminHatId } = useProjectData(projectContract, hatsContract, project)
  const { authenticated } = usePrivy()

  const { selectedChain } = useContext(ChainContextV5)
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

  return (
    <>
      {distribute || IS_SENATE_VOTE ? (
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
        />
      ) : (
        <Link href={`/project/${project?.MDP}`} passHref>
          <ProjectCardContent
            project={project}
            userHasVotingPower={userHasVotingPower}
            isVotingPeriod={isVotingPeriod}
            active={active}
            isExpanded={false}
          />
        </Link>
      )}
    </>
  )
}
