import {
  TicketIcon,
  XCircleIcon,
  DocumentIcon,
  CheckCircleIcon,
  ChatBubbleBottomCenterTextIcon,
} from '@heroicons/react/24/outline'
import { classNames } from '../../lib/utils/tailwind'

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
        <p className="mb-1 block h-6 w-fit items-center rounded-md bg-green-50 px-2 py-1 text-xs font-medium text-green-700 ring-1 ring-inset ring-green-600/20 sm:hidden">
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
        <p className="mb-1 block h-6 w-fit items-center rounded-md bg-orange-50 px-2 py-1 text-xs font-medium text-orange-700 ring-1 ring-inset ring-orange-600/20 sm:hidden">
          {status}
        </p>
      </>
    )
  } else if (['Archived', 'Revoked', 'Cancelled'].includes(status)) {
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
        <p className="mb-1 block h-6 w-fit items-center rounded-md bg-gray-50 px-2 py-1 text-xs font-medium text-gray-700 ring-1 ring-inset ring-gray-600/20 sm:hidden">
          {status}
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
        <p className="mb-1 block h-6 w-fit items-center rounded-md bg-gray-50 px-2 py-1 text-xs font-medium text-gray-700 ring-1 ring-inset ring-gray-600/20 sm:hidden">
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
        <p className="mb-1 block h-6 w-fit items-center rounded-md bg-gray-50 px-2 py-1 text-xs font-medium text-gray-700 ring-1 ring-inset ring-gray-600/20 sm:hidden">
          {status}
        </p>
      </>
    )
  }
}
