import {
  Menu,
  MenuButton,
  MenuItem,
  MenuItems,
  Transition,
} from '@headlessui/react'
import {
  ShareIcon,
  EllipsisVerticalIcon,
  PencilIcon,
  ChevronDownIcon,
  TrashIcon,
  ArchiveBoxArrowDownIcon,
} from '@heroicons/react/24/outline'
import { useProposalDelete, useProposalUpload } from '@nance/nance-hooks'
import { ProposalPacket } from '@nance/nance-sdk'
import Link from 'next/link'
import { useRouter } from 'next/router'
import { Fragment } from 'react'
import toast from 'react-hot-toast'
import toastStyle from '@/lib/marketplace/marketplace-utils/toastConfig'
import { NANCE_SPACE_NAME } from '@/lib/nance/constants'
import useAccount from '@/lib/nance/useAccountAddress'
import { useSignArchiveProposal } from '@/lib/nance/useSignArchiveProposal'
import { useSignDeleteProposal } from '@/lib/nance/useSignDeleteProposal'

export default function DropDownMenu({
  proposalPacket,
}: {
  proposalPacket: ProposalPacket
}) {
  const space = NANCE_SPACE_NAME
  const { wallet, isLinked } = useAccount()
  const { signDeleteProposalAsync } = useSignDeleteProposal(wallet)
  const { signArchiveProposalAsync } = useSignArchiveProposal(wallet)
  const { trigger: triggerDelete, error: deleteError } = useProposalDelete(
    space,
    proposalPacket.uuid,
    !!wallet
  )
  const { trigger: triggerArchive, error: archiveError } = useProposalUpload(
    space,
    proposalPacket.uuid,
    !!wallet
  )
  const router = useRouter()

  const { status } = proposalPacket
  const showVariableActions =
    isLinked &&
    (status === 'Archived' ||
      status === 'Draft' ||
      status === 'Discussion' ||
      status === 'Temperature Check')

  const handleDeleteProposal = async (uuid: string, snapshotId: string) => {
    if (!uuid)
      return toast.error('Proposal UUID is missing.', { style: toastStyle })
    if (!snapshotId)
      return toast.error('Snapshot ID is missing.', { style: toastStyle })

    // Show loading toast
    const loadingToastId = toast.loading('Signing...', { style: toastStyle })

    try {
      const nanceSignature = await signDeleteProposalAsync(snapshotId)
      const { address, signature, message } = nanceSignature

      const res = await triggerDelete({
        uuid,
        envelope: {
          type: 'SnapshotCancelProposal',
          address,
          signature,
          message,
        },
      })

      if (res.success) {
        // Show success toast
        toast.success('Proposal deleted successfully!', {
          id: loadingToastId,
          style: toastStyle,
        })
        router.push('/vote')
      } else {
        // Show error toast
        toast.error(`${deleteError}`, {
          id: loadingToastId,
          style: toastStyle,
          duration: 15000,
        })
      }
    } catch (error) {
      // Show error toast
      toast.error(`${error}`, {
        id: loadingToastId,
        style: toastStyle,
        duration: 15000,
      })
    }
  }

  const handleArchiveProposal = async (uuid: string, snapshotId: string) => {
    if (!uuid)
      return toast.error('Proposal UUID is missing.', { style: toastStyle })
    if (!snapshotId)
      return toast.error('Snapshot ID is missing.', { style: toastStyle })

    // Show loading toast
    const loadingToastId = toast.loading('Signing...', { style: toastStyle })

    try {
      const nanceSignature = await signArchiveProposalAsync(snapshotId)
      const { address, signature, message } = nanceSignature

      const res = await triggerArchive({
        proposal: { ...proposalPacket, status: 'Archived' },
        envelope: {
          type: 'NanceArchiveProposal',
          address,
          signature,
          message,
        },
      })

      if (res.success) {
        // Show success toast
        toast.success('Proposal archived successfully!', {
          id: loadingToastId,
          style: toastStyle,
        })
        router.push('/vote')
      } else {
        // Show error toast
        toast.error(`${archiveError}`, {
          id: loadingToastId,
          style: toastStyle,
          duration: 15000,
        })
      }
    } catch (error) {
      // Show error toast
      toast.error(`${error}`, {
        id: loadingToastId,
        style: toastStyle,
        duration: 15000,
      })
    }
  }

  return (
    <>
      <Menu as="div" className="relative inline-block">
        <MenuButton>
          <div className="inline-flex w-full justify-end rounded-md sm:hidden">
            <EllipsisVerticalIcon
              className="h-7 w-7 text-indigo-600"
              aria-hidden="true"
            />
          </div>

          <div className="hidden w-full justify-center gap-x-1.5 rounded-md bg-white px-3 py-1 text-sm font-semibold text-gray-900 shadow-sm ring-1 ring-inset ring-gray-300 hover:bg-gray-50 sm:inline-flex">
            Options
            <ChevronDownIcon
              className="-mr-1 h-5 w-5 text-gray-400"
              aria-hidden="true"
            />
          </div>
        </MenuButton>
        <Transition
          as={Fragment}
          enter="transition ease-out duration-100"
          enterFrom="transform opacity-0 scale-95"
          enterTo="transform opacity-100 scale-100"
          leave="transition ease-in duration-75"
          leaveFrom="transform opacity-100 scale-100"
          leaveTo="transform opacity-0 scale-95"
        >
          <MenuItems className="absolute z-20 right-0 mt-2 w-56 origin-top-right divide-y divide-gray-100 rounded-md bg-white shadow-lg ring-1 ring-black/5 focus:outline-none">
            <div className="px-1 py-1">
              <MenuItem>
                {({ focus }) => (
                  <button
                    className={`${
                      focus ? 'bg-moonBlue text-white' : 'text-gray-900'
                    } group flex w-full items-center rounded-md px-2 py-2 text-sm`}
                    onClick={() => {
                      toast.promise(
                        navigator.clipboard.writeText(window.location.href),
                        {
                          loading: 'Copying...',
                          success: 'Copied!',
                          error: (err) =>
                            `${err?.error_description || err.toString()}`,
                        }
                      )
                    }}
                  >
                    <ShareIcon className="mr-2 h-5 w-5" aria-hidden="true" />
                    Copy Link
                  </button>
                )}
              </MenuItem>
            </div>
            {showVariableActions && (
              <div className="px-1 py-1">
                <MenuItem>
                  {({ focus }) => (
                    <Link
                      className={`${
                        focus ? 'bg-moon-blue text-white' : 'text-gray-900'
                      } group flex w-full items-center rounded-md px-2 py-2 text-sm`}
                      href={`/propose?proposalId=${proposalPacket.uuid}`}
                      passHref
                    >
                      <PencilIcon className="mr-2 h-5 w-5" aria-hidden="true" />
                      Edit
                    </Link>
                  )}
                </MenuItem>
                <MenuItem>
                  {({ focus }) => (
                    <button
                      className={`${
                        focus ? 'bg-moon-gold text-white' : 'text-gray-900'
                      } group flex w-full items-center rounded-md px-2 py-2 text-sm`}
                      onClick={() => {
                        const snapshotId = proposalPacket?.voteURL as string
                        const uuid = proposalPacket?.uuid as string
                        handleArchiveProposal(uuid, snapshotId)
                      }}
                    >
                      <ArchiveBoxArrowDownIcon
                        className="mr-2 h-5 w-5"
                        aria-hidden="true"
                      />
                      Archive
                    </button>
                  )}
                </MenuItem>
                <MenuItem>
                  {({ focus }) => (
                    <button
                      className={`${
                        focus ? 'bg-moon-orange text-white' : 'text-gray-900'
                      } group flex w-full items-center rounded-md px-2 py-2 text-sm`}
                      onClick={() => {
                        const snapshotId = proposalPacket?.voteURL as string
                        const uuid = proposalPacket?.uuid as string
                        handleDeleteProposal(uuid, snapshotId)
                      }}
                    >
                      <TrashIcon className="mr-2 h-5 w-5" aria-hidden="true" />
                      Delete
                    </button>
                  )}
                </MenuItem>
              </div>
            )}
          </MenuItems>
        </Transition>
      </Menu>
    </>
  )
}
