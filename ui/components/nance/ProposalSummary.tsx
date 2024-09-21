/*
import { Disclosure, DisclosureButton, DisclosurePanel } from '@headlessui/react'
import {
  PlusIcon,
  MinusIcon,
} from '@heroicons/react/24/outline'
import MarkdownWithTOC from './MarkdownWithTOC'

export default function ProposalSummary({
  proposalSummary,
  threadSummary,
}: {
  proposalSummary: string | undefined
  threadSummary: string | undefined
}) {
  if (!proposalSummary && !threadSummary) return null
  return (
    <div className="rounded-md border bg-dark-background">
      <div className="mx-auto max-w-7xl px-4">
        <div className="mx-auto max-w-4xl divide-y divide-gray-900/10">
          <dl className="divide-y divide-gray-900/10">
            {proposalSummary && (
              <Summary type="Proposal" markdown={proposalSummary} />
            )}
            {threadSummary && (
              <Summary type="Discussion" markdown={threadSummary} />
            )}
          </dl>
        </div>
      </div>
    </div>
  )
}

const Summary = ({ type, markdown }: { type: string; markdown: string }) => {
  return (
    <Disclosure as="div" className="py-2">
      {({ open }) => (
        <>
          <dt>
            <DisclosureButton className="flex w-full items-start justify-between text-left text-white">
              <span className="">{`${type} Summary `}</span>
              <span className="ml-6 flex h-7 items-center">
                {open ? (
                  <MinusIcon
                    className="h-6 w-6"
                    aria-hidden="true"
                  />
                ) : (
                  <PlusIcon
                    className="h-6 w-6"
                    aria-hidden="true"
                  />
                )}
              </span>
            </DisclosureButton>
          </dt>
          <DisclosurePanel as="dd" className="p-2">
            <MarkdownWithTOC body={markdown.replace(/^#/gm, '###')} />
          </DisclosurePanel>
        </>
      )}
    </Disclosure>
  )
}
*/
