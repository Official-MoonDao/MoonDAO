import {
  TicketIcon,
  XCircleIcon,
  DocumentIcon,
  CheckCircleIcon,
  ChatBubbleBottomCenterTextIcon,
} from '@heroicons/react/24/outline'
import { classNames } from '@/lib/utils/tailwind'

export default function ProposalStatusIcon({
  status,
  isActive = false,
}: {
  status: string
  isActive?: boolean
}) {
  if (['Voting', 'Temperature Check'].includes(status)) {
    return (
      <>
        <TicketIcon
          className={classNames(
            isActive
              ? 'text-indigo-600'
              : 'text-green-500 group-hover:text-indigo-600',
            'hidden h-6 w-6 shrink-0 sm:block'
          )}
          aria-hidden="true"
        />
        <p className="mb-1 block h-6 w-fit items-center rounded-md bg-[rgba(57,255,20,0.1)] px-2 py-1 text-xs font-medium text-[#70ff90] ring-1 ring-inset ring-[rgba(57,255,20,0.2)] sm:hidden">
          {status}
        </p>
      </>
    )
  } else if (['Discussion'].includes(status)) {
    return (
      <>
        <ChatBubbleBottomCenterTextIcon
          className={classNames(
            isActive
              ? 'text-indigo-600'
              : 'text-orange-500 group-hover:text-indigo-600',
            'hidden h-6 w-6 shrink-0 sm:block'
          )}
          aria-hidden="true"
        />
        <p className="mb-1 block h-6 w-fit items-center rounded-md bg-[rgba(255,159,28,0.1)] px-2 py-1 text-xs font-medium text-[#ffb060] ring-1 ring-inset ring-[rgba(255,159,28,0.2)] sm:hidden">
          {status}
        </p>
      </>
    )
  } else if (['Archived', 'Revoked', 'Cancelled'].includes(status)) {
    const displayLabel = status === 'Cancelled' ? 'Vote Closed' : status
    return (
      <>
        <XCircleIcon
          className={classNames(
            isActive
              ? 'text-indigo-600'
              : 'text-gray-400 group-hover:text-indigo-600',
            'hidden h-6 w-6 shrink-0 sm:block'
          )}
          aria-hidden="true"
        />
        <p className="mb-1 block h-6 w-fit items-center rounded-md bg-[rgba(0,255,200,0.06)] px-2 py-1 text-xs font-medium text-[#b0ffe0] ring-1 ring-inset ring-[rgba(0,255,200,0.15)] sm:hidden">
          {displayLabel}
        </p>
      </>
    )
  } else if (['Approved', 'Finished'].includes(status)) {
    return (
      <>
        <CheckCircleIcon
          className={classNames(
            isActive
              ? 'text-indigo-600'
              : 'text-gray-400 group-hover:text-indigo-600',
            'hidden h-6 w-6 shrink-0 sm:block'
          )}
          aria-hidden="true"
        />
        <p className="mb-1 block h-6 w-fit items-center rounded-md bg-[rgba(0,255,200,0.06)] px-2 py-1 text-xs font-medium text-[#b0ffe0] ring-1 ring-inset ring-[rgba(0,255,200,0.15)] sm:hidden">
          {status}
        </p>
      </>
    )
  } else {
    return (
      <>
        <DocumentIcon
          className={classNames(
            isActive
              ? 'text-indigo-600'
              : 'text-gray-400 group-hover:text-indigo-600',
            'hidden h-6 w-6 shrink-0 sm:block'
          )}
          aria-hidden="true"
        />
        <p className="mb-1 block h-6 w-fit items-center rounded-md bg-[rgba(0,255,200,0.06)] px-2 py-1 text-xs font-medium text-[#b0ffe0] ring-1 ring-inset ring-[rgba(0,255,200,0.15)] sm:hidden">
          {status}
        </p>
      </>
    )
  }
}
