import { Menu, Transition } from '@headlessui/react'
import {
  ShareIcon,
  EllipsisVerticalIcon,
  PencilIcon,
  ChevronDownIcon,
  TrashIcon,
  ArchiveBoxArrowDownIcon,
} from '@heroicons/react/24/outline'
import { ProposalPacket } from '@nance/nance-sdk'
import Link from 'next/link'
import { Fragment } from 'react'
import toast from 'react-hot-toast'
import { NANCE_SPACE_NAME } from '../../lib/nance/constants'
import useAccountAddress from '../../lib/nance/useAccountAddress'
import { useSignDeleteProposal } from "../../lib/nance/useSignDeleteProposal"
import { useProposalDelete } from "@nance/nance-hooks"

export default function DropDownMenu({
  proposalPacket,
}: {
  proposalPacket: ProposalPacket
}) {
  const space = NANCE_SPACE_NAME
  const { signDeleteProposalAsync, wallet } = useSignDeleteProposal();
  const { trigger } = useProposalDelete(space, proposalPacket.uuid, !!wallet);

  return (
    <>
      <Menu as="div" className="relative inline-block">
        <div>
          <Menu.Button className="inline-flex w-full justify-end rounded-md sm:hidden">
            <EllipsisVerticalIcon
              className="h-7 w-7 text-indigo-600 hover:text-gray-900"
              aria-hidden="true"
            />
          </Menu.Button>

          <Menu.Button className="hidden w-full justify-center gap-x-1.5 rounded-md bg-white px-3 py-2 text-sm font-semibold text-gray-900 shadow-sm ring-1 ring-inset ring-gray-300 hover:bg-gray-50 sm:inline-flex">
            Options
            <ChevronDownIcon
              className="-mr-1 h-5 w-5 text-gray-400"
              aria-hidden="true"
            />
          </Menu.Button>
        </div>
        <Transition
          as={Fragment}
          enter="transition ease-out duration-100"
          enterFrom="transform opacity-0 scale-95"
          enterTo="transform opacity-100 scale-100"
          leave="transition ease-in duration-75"
          leaveFrom="transform opacity-100 scale-100"
          leaveTo="transform opacity-0 scale-95"
        >
          <Menu.Items className="absolute right-0 mt-2 w-56 origin-top-right divide-y divide-gray-100 rounded-md bg-white shadow-lg ring-1 ring-black/5 focus:outline-none">
            <div className="px-1 py-1">
              <Menu.Item>
                {({ active }) => (
                  <button
                    className={`${
                      active ? 'bg-indigo-500 text-white' : 'text-gray-900'
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
              </Menu.Item>
              <Menu.Item>
                {({ active }) => (
                  <Link
                    className={`${
                      active ? 'bg-indigo-500 text-white' : 'text-gray-900'
                    } group flex w-full items-center rounded-md px-2 py-2 text-sm`}
                    href={`/newProposal?proposalId=${proposalPacket.uuid}`}
                    passHref
                  >
                    <PencilIcon className="mr-2 h-5 w-5" aria-hidden="true" />
                    Edit
                  </Link>
                )}
              </Menu.Item>
            </div>
            {/* <div className="px-1 py-1">
              <Menu.Item>
                {({ active }) => (
                  <button
                    className={`${
                      active ? "bg-yellow-500 text-white" : "text-gray-900"
                    } group flex w-full items-center rounded-md px-2 py-2 text-sm`}
                  >
                    <ArchiveBoxArrowDownIcon
                      className="mr-2 h-5 w-5"
                      aria-hidden="true"
                    />
                    Archive
                  </button>
                )}
              </Menu.Item>
            </div> */}

            <div className="px-1 py-1">
              <Menu.Item>
                {({ active }) => (
                  <button
                    className={`${
                      active ? 'bg-red-400 text-white' : 'text-gray-900'
                    } group flex w-full items-center rounded-md px-2 py-2 text-sm`}
                    onClick={() => {
                      const snapshotId = proposalPacket?.voteURL as string;
                      const uuid = proposalPacket?.uuid as string;
                      if (!snapshotId || !uuid) toast.error('Something is wrong with this proposal and cannot be deleted.');
                      toast.promise(
                        signDeleteProposalAsync(snapshotId),
                        {
                          loading: 'Signing...',
                          success: (nanceSignature) => {
                            const { address, signature, message } = nanceSignature;
                            trigger({
                              uuid, envelope: { type: "SnapshotCancelProposal", address, signature, message }
                            })
                            return 'Proposal deleted!';
                          },
                          error: (err) => `${err?.error_description || err.toString()}`,
                        }
                      );
                    }}
                  >
                    <TrashIcon className="mr-2 h-5 w-5" aria-hidden="true" />
                    Delete
                  </button>
                )}
              </Menu.Item>
            </div>
          </Menu.Items>
        </Transition>
      </Menu>
    </>
  )
}
