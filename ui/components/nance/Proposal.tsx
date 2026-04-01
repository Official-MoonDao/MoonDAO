import { ChevronRightIcon } from '@heroicons/react/24/outline'
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
  /** Horizontal “newsletter” row on the citizen dashboard */
  feedStyle?: boolean
}

function StatusDot({ config }: { config: StatusIndicatorStyle }) {
  return (
    <span
      className={`flex h-4 w-4 shrink-0 items-center justify-center rounded-full ${config.bg}`}
      aria-hidden
    >
      <span className={`block h-1.5 w-1.5 rounded-full ${config.dot}`} />
    </span>
  )
}

function getDescriptionPreview(body: string | undefined, maxLength = 120): string | null {
  if (!body || typeof body !== 'string') return null
  const stripped = body.replace(/<[^>]*>/g, '').replace(/[#*`\[\]_~]/g, '').replace(/\n+/g, ' ').trim()
  if (!stripped) return null
  return stripped.length > maxLength ? `${stripped.slice(0, maxLength)}…` : stripped
}

export default function Proposal({ project, feedStyle = false }: ProposalProps) {
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
