import { Disclosure } from '@headlessui/react'
import {
  ArrowsPointingOutIcon,
  ArrowsPointingInIcon,
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
    <div className="rounded-md border bg-gray-100">
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
            <Disclosure.Button className="flex w-full items-start justify-between text-left text-gray-900">
              <span className="">{`${type} Summary `}</span>
              <span className="ml-6 flex h-7 items-center">
                {open ? (
                  <ArrowsPointingInIcon
                    className="h-6 w-6"
                    aria-hidden="true"
                  />
                ) : (
                  <ArrowsPointingOutIcon
                    className="h-6 w-6"
                    aria-hidden="true"
                  />
                )}
              </span>
            </Disclosure.Button>
          </dt>
          <Disclosure.Panel as="dd" className="p-2">
            <MarkdownWithTOC body={markdown.replace(/^#/gm, '###')} />
          </Disclosure.Panel>
        </>
      )}
    </Disclosure>
  )
}
