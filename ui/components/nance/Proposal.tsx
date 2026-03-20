import { ChevronRightIcon } from '@heroicons/react/24/outline'
import useProposalJSON from '@/lib/nance/useProposalJSON'
import {
  useProposalStatus,
  STATUS_CONFIG,
  STATUS_DISPLAY_LABELS,
  ProposalStatus,
} from '@/lib/nance/useProposalStatus'
import ProposalInfo from './ProposalInfo'

type ProposalProps = {
  project: any
}

function getDescriptionPreview(body: string | undefined, maxLength = 120): string | null {
  if (!body || typeof body !== 'string') return null
  const stripped = body.replace(/<[^>]*>/g, '').replace(/[#*`\[\]_~]/g, '').replace(/\n+/g, ' ').trim()
  if (!stripped) return null
  return stripped.length > maxLength ? `${stripped.slice(0, maxLength)}…` : stripped
}

export default function Proposal({ project }: ProposalProps) {
  const proposalStatus = (useProposalStatus(project) || project?.status) as ProposalStatus
  const proposalJSON = useProposalJSON(project) || project?.proposalJSON
  const config = STATUS_CONFIG[proposalStatus as keyof typeof STATUS_CONFIG] || {
    bg: 'bg-gray-500/10',
    border: 'border-gray-500/30',
    text: 'text-gray-400',
    dot: 'bg-gray-500',
  }
  const displayLabel = STATUS_DISPLAY_LABELS[proposalStatus] ?? proposalStatus
  const descriptionPreview = getDescriptionPreview(
    proposalJSON?.body || project?.description
  )

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
          <div className="flex items-center gap-x-1.5">
            <div className={`flex-none rounded-full ${config.bg} p-1`}>
              <div className={`h-1.5 w-1.5 rounded-full ${config.dot}`} />
            </div>
            <p className="text-sm leading-6 text-white font-RobotoMono font-medium">
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
