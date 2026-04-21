import { ChevronRightIcon } from '@heroicons/react/24/outline'
import { IS_MEMBER_VOTE, IS_SENATE_VOTE } from 'const/config'
import useProposalJSON from '@/lib/nance/useProposalJSON'
import {
  useProposalStatus,
  STATUS_DISPLAY_LABELS,
  getStatusIndicatorConfig,
  type StatusIndicatorStyle,
  ProposalStatus,
} from '@/lib/nance/useProposalStatus'
import ProposalInfo from './ProposalInfo'
import RequestingTokensOfProposal from './RequestingTokensOfProposal'

type ProposalProps = {
  project: any
  /** Horizontal "newsletter" row on the citizen dashboard */
  feedStyle?: boolean
  /** Disable internal links (use when Proposal is already wrapped in a Link) */
  linkDisabled?: boolean
}

function StatusDot({
  config,
  pulse = false,
}: {
  config: StatusIndicatorStyle
  pulse?: boolean
}) {
  return (
    <span
      className={`relative flex h-4 w-4 shrink-0 items-center justify-center rounded-full ${config.bg}`}
      aria-hidden
    >
      {pulse && (
        <span
          className={`absolute inline-flex h-full w-full rounded-full opacity-60 animate-ping ${config.dot}`}
        />
      )}
      <span className={`relative block h-1.5 w-1.5 rounded-full ${config.dot}`} />
    </span>
  )
}

/**
 * Resolve the user-facing voting-phase context for a proposal based on the
 * current cycle flags in `const/config.ts` (IS_SENATE_VOTE / IS_MEMBER_VOTE).
 *
 * - Member Vote: proposals in `Voting` status need vMOONEY holders to allocate
 *   their voting power on /projects. Treat this as an active call to action.
 * - Senate Vote: proposals in `Temperature Check` status are awaiting Senate
 *   approval. Surface this so members understand the proposal isn't stale.
 */
function getVotingPhaseContext(status: ProposalStatus | undefined) {
  if (IS_MEMBER_VOTE && status === 'Voting') {
    return {
      label: 'Member Vote',
      cta: 'Vote Now',
      ctaHref: '/projects',
      tone: 'member' as const,
      pulse: true,
    }
  }
  if (IS_SENATE_VOTE && status === 'Temperature Check') {
    return {
      label: 'Senate Vote In Progress',
      cta: null,
      ctaHref: null,
      tone: 'senate' as const,
      pulse: true,
    }
  }
  return null
}

function getDescriptionPreview(body: string | undefined, maxLength = 120): string | null {
  if (!body || typeof body !== 'string') return null
  const stripped = body.replace(/<[^>]*>/g, '').replace(/[#*`\[\]_~]/g, '').replace(/\n+/g, ' ').trim()
  if (!stripped) return null
  return stripped.length > maxLength ? `${stripped.slice(0, maxLength)}…` : stripped
}

export default function Proposal({ project, feedStyle = false, linkDisabled = false }: ProposalProps) {
  const proposalStatus = (useProposalStatus(project) || project?.status) as ProposalStatus
  const proposalJSON = useProposalJSON(project) || project?.proposalJSON
  const config = getStatusIndicatorConfig(proposalStatus)
  const displayLabel =
    STATUS_DISPLAY_LABELS[proposalStatus as ProposalStatus] ??
    (proposalStatus === 'Vote Closed' || proposalStatus === 'vote closed'
      ? 'Vote Closed'
      : proposalStatus)
  const descriptionPreview = getDescriptionPreview(
    proposalJSON?.body || project?.description
  )

  if (feedStyle) {
    return (
      <div id="proposal-card" className="relative flex items-start gap-4">
        <div className="flex-1 min-w-0 text-left">
          <ProposalInfo
            showTitle={true}
            showStatus={false}
            proposalJSON={proposalJSON}
            proposalStatus={proposalStatus}
            project={project}
            compact={true}
            feedStyle={true}
            linkDisabled={linkDisabled}
          />
          {descriptionPreview && (
            <p className="text-gray-300 text-sm mb-2 line-clamp-2 mt-1">{descriptionPreview}</p>
          )}
          {proposalJSON?.budget && proposalJSON.budget.length > 0 && (
            <div className="mb-2 mt-1 text-left">
              <RequestingTokensOfProposal budget={proposalJSON.budget} variant="feed" />
            </div>
          )}
          <div className="flex flex-wrap items-start gap-x-4 gap-y-1 text-sm text-gray-400 text-left">
            <span className="flex items-center gap-1.5 min-w-0">
              <StatusDot config={config} />
              <span className="min-w-0">{displayLabel}</span>
            </span>
          </div>
        </div>
        <ChevronRightIcon
          className="h-5 w-5 flex-none text-gray-400 shrink-0 mt-0.5"
          aria-hidden="true"
          data-testid="chevron-right"
        />
      </div>
    )
  }

  return (
    <div
      id="proposal-card"
      className="relative flex flex-col h-full justify-between gap-y-4 px-4 py-5 sm:px-6"
    >
      <div className="flex-1">
        <ProposalInfo
          showTitle={true}
          showStatus={false}
          proposalJSON={proposalJSON}
          proposalStatus={proposalStatus}
          project={project}
          compact={true}
          linkDisabled={linkDisabled}
        />
        {descriptionPreview && (
          <p className="mt-2 text-sm text-white/60 line-clamp-2 font-RobotoMono">
            {descriptionPreview}
          </p>
        )}
      </div>
      <div className="flex justify-between items-center mt-4">
        <div className="flex flex-col items-start">
          <div className="flex items-center gap-x-1.5 min-w-0">
            <StatusDot config={config} />
            <p className="text-sm leading-6 text-white font-RobotoMono font-medium min-w-0">
              {displayLabel}
            </p>
          </div>
        </div>
        <ChevronRightIcon
          className="h-5 w-5 flex-none text-gray-400"
          aria-hidden="true"
          data-testid="chevron-right"
        />
      </div>
    </div>
  )
}
