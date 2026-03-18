import { ChevronRightIcon } from '@heroicons/react/24/outline'
import useProposalJSON from '@/lib/nance/useProposalJSON'
import { useProposalStatus, STATUS_CONFIG, getProposalStatusLabel } from '@/lib/nance/useProposalStatus'
import ProposalInfo from './ProposalInfo'

type ProposalProps = {
  project: any
}

const ABSTRACT_TEASER_LENGTH = 120

function getDescriptionTeaser(text: string | undefined): string | null {
  if (!text || typeof text !== 'string') return null
  const cleaned = text.replace(/<[^>]*>/g, '').replace(/\s+/g, ' ').trim()
  if (!cleaned) return null
  if (cleaned.length <= ABSTRACT_TEASER_LENGTH) return cleaned
  return cleaned.slice(0, ABSTRACT_TEASER_LENGTH).trim() + '…'
}

export default function Proposal({ project }: ProposalProps) {
  const proposalStatus = useProposalStatus(project) || project?.status
  const proposalJSON = useProposalJSON(project) || project?.proposalJSON
  const config = STATUS_CONFIG[proposalStatus as keyof typeof STATUS_CONFIG] || STATUS_CONFIG['Archived']
  const description = getDescriptionTeaser(proposalJSON?.abstract || project?.description)
  return (
    <div
      id="proposal-card"
      className="relative flex flex-col h-full justify-between gap-y-4 px-4 py-5 sm:px-6"
    >
      <div className="flex-1 flex flex-col gap-2">
        <ProposalInfo
          showTitle={true}
          showStatus={false}
          proposalJSON={proposalJSON}
          proposalStatus={proposalStatus}
          project={project}
          compact={true}
        />
        {description && (
          <p className="text-sm text-gray-400 line-clamp-2 font-RobotoMono">
            {description}
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
              {getProposalStatusLabel(proposalStatus)}
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
