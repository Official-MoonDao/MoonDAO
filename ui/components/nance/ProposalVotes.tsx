import { CITIZEN_TABLE_NAMES, DEFAULT_CHAIN_V5 } from 'const/config'
import { ProposalStatus } from '@/lib/nance/useProposalStatus'
import { useQueryParams, withDefault, NumberParam, createEnumParam } from 'next-query-params'
import Link from 'next/link'
import { ReactNode, useEffect, useState, useMemo } from 'react'
import { formatNumberUSStyle } from '@/lib/nance'
import { Project } from '@/lib/project/useProjectData'
import { generatePrettyLinkWithId } from '@/lib/subscription/pretty-links'
import { useTablelandQuery } from '@/lib/swr/useTablelandQuery'
import { getChainSlug } from '@/lib/thirdweb/chain'
import { classNames } from '@/lib/utils/tailwind'
import Votes, { VoteItem, VoteItemHeader, VoteItemDetails } from '@/components/layout/Votes'
import { AddressLink } from './AddressLink'
import NewVoteButton from './NewVoteButton'

const getColorOfChoice = (choice: string | undefined) => {
  if (choice == 'For') {
    return 'text-green-500'
  } else if (choice == 'Against') {
    return 'text-red-500'
  } else if (choice == 'Abstain') {
    return 'text-gray-500'
  } else {
    return ''
  }
}

export default function ProposalVotes({
  votes,
  proposalStatus,
  state,
  project,
  refetch,
  threshold = 0,
  showContainer,
  title,
  subtitle,
  onTitleClick,
  containerClassName,
}: {
  votes: any[]
  proposalStatus: ProposalStatus
  state: any
  project: Project
  refetch: () => void
  threshold?: number
  showContainer?: boolean
  title?: string
  subtitle?: ReactNode
  onTitleClick?: () => void
  containerClassName?: string
}) {
  const chainSlug = getChainSlug(DEFAULT_CHAIN_V5)

  const statement = useMemo(() => {
    if (votes.length === 0) return null
    return `SELECT id, name, owner FROM ${CITIZEN_TABLE_NAMES[chainSlug]} WHERE owner IN (${votes
      .map((v) => `'${v.address.toLowerCase()}'`)
      .join(',')})`
  }, [votes, chainSlug])

  const { data: votingCitizens = [] } = useTablelandQuery(statement, {
    revalidateOnFocus: false,
  })

  const isSimpleVoting = false

  const Voter = ({ address }: { address: string }) => {
    const citizen = votingCitizens.find((c: any) => c.owner.toLowerCase() === address.toLowerCase())
    return citizen ? (
      <Link
        href={`/citizen/${generatePrettyLinkWithId(citizen.name, citizen.id)}`}
        className="break-all hover:underline"
      >
        {citizen.name}
      </Link>
    ) : (
      <AddressLink address={address} />
    )
  }
  const SCORES_TOTAL = 100

  // Summary section component
  const summarySection = (
    <>
      <div className="flex justify-between">
        <p className="text-sm">VOTERS {formatNumberUSStyle(votes.length || 0, true)}</p>
      </div>
    </>
  )

  // Controls section component

  // Vote items
  const voteItems =
    votes?.map((vote) => (
      <VoteItem key={vote.id}>
        {!isSimpleVoting && <VoteItemHeader leftContent={<Voter address={vote.address} />} />}
      </VoteItem>
    )) || []

  // Footer section
  const footerSection = (
    <NewVoteButton
      proposalStatus={proposalStatus}
      votes={votes}
      project={project}
      refetch={refetch}
    />
  )

  return (
    <Votes
      summarySection={summarySection}
      voteItems={voteItems}
      footerSection={footerSection}
      showContainer={showContainer}
      title={title}
      subtitle={subtitle}
      onTitleClick={onTitleClick}
      containerClassName={containerClassName}
    />
  )
}
