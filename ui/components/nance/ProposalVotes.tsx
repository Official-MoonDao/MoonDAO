import { CITIZEN_TABLE_NAMES, DEFAULT_CHAIN_V5 } from 'const/config'
import { useQueryParams, withDefault, NumberParam, createEnumParam } from 'next-query-params'
import Link from 'next/link'
import { ReactNode, useEffect, useState, useMemo } from 'react'
import { SNAPSHOT_SPACE_NAME } from '../../lib/nance/constants'
import { formatNumberUSStyle } from '@/lib/nance'
import { Project } from '@/lib/project/useProjectData'
import { generatePrettyLinkWithId } from '@/lib/subscription/pretty-links'
import { useTablelandQuery } from '@/lib/swr/useTablelandQuery'
import { getChainSlug } from '@/lib/thirdweb/chain'
import { classNames } from '@/lib/utils/tailwind'
import Votes, { VoteItem, VoteItemHeader, VoteItemDetails } from '@/components/layout/Votes'
import { AddressLink } from './AddressLink'
import ColorBar from './ColorBar'
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

  const [query, setQuery] = useQueryParams({
    page: withDefault(NumberParam, 1),
    sortBy: withDefault(createEnumParam(['time', 'vp', 'name']), 'time'),
    withField: withDefault(createEnumParam(['reason', 'app']), ''),
    filterBy: withDefault(createEnumParam(['for', 'against']), ''),
  })

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
  if (query.filterBy === 'for') {
    votes = votes.filter((v) => v.choice === 1)
  } else if (query.filterBy === 'against') {
    votes = votes.filter((v) => v.choice === 2)
  }

  // Sort votes based on sortBy parameter
  if (query.sortBy === 'vp') {
    votes = votes.sort((a, b) => b.vp - a.vp) // Descending by voting power
  } else if (query.sortBy === 'name') {
    votes = votes.sort((a, b) => {
      const citizenA = votingCitizens.find(
        (c: any) => c.owner.toLowerCase() === a.address.toLowerCase()
      )
      const citizenB = votingCitizens.find(
        (c: any) => c.owner.toLowerCase() === b.address.toLowerCase()
      )

      const nameA = citizenA?.name || ''
      const nameB = citizenB?.name || ''

      if (nameA && nameB) {
        return nameA.localeCompare(nameB)
      }
      if (nameA && !nameB) return -1
      if (!nameA && nameB) return 1
      return a.address.localeCompare(b.address)
    })
  } else {
    // Default to time (most recent first)
    votes = votes.sort((a, b) => b.created - a.created)
  }

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
      {!isSimpleVoting && (
        <>
          <div className="flex justify-between">
            <p className="text-sm text-green-500">
              VOTES {formatNumberUSStyle(SCORES_TOTAL, true)}
            </p>
          </div>

          <div className="p-3 text-sm text-gray-500">
            <ColorBar greenScore={SCORES_TOTAL} redScore={0} threshold={threshold} noTooltip />
          </div>
        </>
      )}

      <div className="flex justify-between">
        <p className="text-sm">VOTERS {formatNumberUSStyle(votes.length || 0, true)}</p>
      </div>
    </>
  )

  // Controls section component
  const controlsSection = (
    <>
      {/* Sorting Controls */}
      <div className="flex gap-4 mt-2 text-xs">
        <span className="text-gray-500">Sort by:</span>
        <button
          className={classNames(
            'cursor-pointer',
            query.sortBy === 'time'
              ? 'text-blue-500 underline'
              : 'text-gray-400 hover:text-gray-600'
          )}
          onClick={() => setQuery({ sortBy: 'time' })}
        >
          Time
        </button>
        <button
          className={classNames(
            'cursor-pointer',
            query.sortBy === 'vp' ? 'text-blue-500 underline' : 'text-gray-400 hover:text-gray-600'
          )}
          onClick={() => setQuery({ sortBy: 'vp' })}
        >
          Voting Power
        </button>
        <button
          className={classNames(
            'cursor-pointer',
            query.sortBy === 'name'
              ? 'text-blue-500 underline'
              : 'text-gray-400 hover:text-gray-600'
          )}
          onClick={() => setQuery({ sortBy: 'name' })}
        >
          Citizen Name
        </button>
      </div>
    </>
  )

  // Vote items
  const voteItems =
    votes?.map((vote) => (
      <VoteItem key={vote.id}>
        {isSimpleVoting && (
          <VoteItemHeader
            leftContent={
              <div className="flex">
                <div className="inline">
                  <Voter address={vote.address} />
                </div>
                &nbsp;
                <span className={classNames(getColorOfChoice(vote.choiceLabel), '')}>
                  voted {vote.choiceLabel}
                </span>
              </div>
            }
          />
        )}

        {!isSimpleVoting && (
          <>
            <VoteItemHeader
              leftContent={<Voter address={vote.address} />}
              rightContent={
                <div className="text-sm text-slate-500">
                  {`${formatNumberUSStyle(vote.vp, true)} (${(
                    (vote.vp * 100) /
                    SCORES_TOTAL
                  ).toFixed()}%)`}{' '}
                  total
                </div>
              }
            />
            <VoteItemDetails className="py-2 text-sm text-gray-600">
              {vote.choiceLabel}
            </VoteItemDetails>
          </>
        )}

        {vote.reason && <VoteItemDetails>{vote.reason}</VoteItemDetails>}
      </VoteItem>
    )) || []

  // Footer section
  const footerSection = (
    <NewVoteButton
      snapshotProposal={{ state: state, type: 'quadratic' }}
      votes={votes}
      project={project}
      refetch={refetch}
    />
  )

  return (
    <Votes
      summarySection={summarySection}
      controlsSection={controlsSection}
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
