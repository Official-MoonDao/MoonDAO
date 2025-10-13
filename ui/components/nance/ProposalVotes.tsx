import { CITIZEN_TABLE_NAMES, DEFAULT_CHAIN_V5 } from 'const/config'
import {
  useQueryParams,
  withDefault,
  NumberParam,
  createEnumParam,
} from 'next-query-params'
import Link from 'next/link'
import { ReactNode, useCallback, useEffect, useState } from 'react'
import { SNAPSHOT_SPACE_NAME } from '../../lib/nance/constants'
import { formatNumberUSStyle } from '@/lib/nance'
import { VotesOfProposal } from '@/lib/snapshot'
import { generatePrettyLinkWithId } from '@/lib/subscription/pretty-links'
import { getChainSlug } from '@/lib/thirdweb/chain'
import { classNames } from '@/lib/utils/tailwind'
import Votes, {
  VoteItem,
  VoteItemHeader,
  VoteItemDetails,
} from '@/components/layout/Votes'
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
  votesOfProposal,
  refetch,
  threshold = 0,
  showContainer,
  title,
  subtitle,
  onTitleClick,
  containerClassName,
}: {
  votesOfProposal: VotesOfProposal
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

  const [votingCitizens, setVotingCitizens] = useState<
    {
      id: string
      name: string
      owner: string
    }[]
  >([])

  const fetchVotingCitizens = useCallback(async () => {
    const statement = `SELECT id, name, owner FROM ${
      CITIZEN_TABLE_NAMES[chainSlug]
    } WHERE owner IN (${votesOfProposal.votes
      .map((v) => `'${v.voter.toLowerCase()}'`)
      .join(',')})`
    const citizenTableRes = await fetch(
      `/api/tableland/query?statement=${statement}`
    )
    const citizenTableData = await citizenTableRes.json()
    setVotingCitizens(citizenTableData)
  }, [votesOfProposal, chainSlug])

  useEffect(() => {
    if (votesOfProposal.votes.length > 0) {
      fetchVotingCitizens()
    }
  }, [votesOfProposal.votes, fetchVotingCitizens])

  const proposalInfo = votesOfProposal.proposal
  const proposalType = proposalInfo?.type ?? ''
  const isSimpleVoting = ![
    'approval',
    'ranked-choice',
    'quadratic',
    'weighted',
  ].includes(proposalType)

  let votes = votesOfProposal.votes
  if (query.filterBy === 'for') {
    votes = votes.filter((v) => v.choice === 1)
  } else if (query.filterBy === 'against') {
    votes = votes.filter((v) => v.choice === 2)
  }

  return (
    <div className="flex flex-col h-full">
      <div>
        <div className="mb-4">
          {isSimpleVoting && (
            <>
              <div className="flex justify-between">
                <p
                  className={classNames(
                    'cursor-pointer text-sm text-green-500',
                    query.filterBy === 'for' ? 'underline' : ''
                  )}
                  onClick={() => {
                    if (query.filterBy === 'for') setQuery({ filterBy: '' })
                    else setQuery({ filterBy: 'for' })
                  }}
                >
                  FOR {formatNumberUSStyle(proposalInfo?.scores[0] || 0, true)}
                </p>

                <p
                  className={classNames(
                    'cursor-pointer text-sm text-red-500',
                    query.filterBy === 'against' ? 'underline' : ''
                  )}
                  onClick={() => {
                    if (query.filterBy === 'against') setQuery({ filterBy: '' })
                    else setQuery({ filterBy: 'against' })
                  }}
                >
                  AGAINST{' '}
                  {formatNumberUSStyle(proposalInfo?.scores[1] || 0, true)}
                </p>
              </div>

      const nameA = citizenA?.name || ''
      const nameB = citizenB?.name || ''

      if (nameA && nameB) {
        return nameA.localeCompare(nameB)
      }
      if (nameA && !nameB) return -1
      if (!nameA && nameB) return 1
      return a.voter.localeCompare(b.voter)
    })
  } else {
    // Default to time (most recent first)
    votes = votes.sort((a, b) => b.created - a.created)
  }

  const Voter = ({ address }: { address: string }) => {
    const citizen = votingCitizens.find(
      (c) => c.owner.toLowerCase() === address.toLowerCase()
    )
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

  // Summary section component
  const summarySection = (
    <>
      {isSimpleVoting && (
        <>
          <div className="flex justify-between">
            <p
              className={classNames(
                'cursor-pointer text-sm text-green-500',
                query.filterBy === 'for' ? 'underline' : ''
              )}
              onClick={() => {
                if (query.filterBy === 'for') setQuery({ filterBy: '' })
                else setQuery({ filterBy: 'for' })
              }}
            >
              FOR {formatNumberUSStyle(proposalInfo?.scores[0] || 0, true)}
            </p>

            <p
              className={classNames(
                'cursor-pointer text-sm text-red-500',
                query.filterBy === 'against' ? 'underline' : ''
              )}
              onClick={() => {
                if (query.filterBy === 'against') setQuery({ filterBy: '' })
                else setQuery({ filterBy: 'against' })
              }}
            >
              AGAINST {formatNumberUSStyle(proposalInfo?.scores[1] || 0, true)}
            </p>
          </div>

          <div className="p-3 text-sm text-gray-500">
            <ColorBar
              greenScore={proposalInfo?.scores[0] || 0}
              redScore={proposalInfo?.scores[1] || 0}
              threshold={threshold}
              noTooltip
            />
          </div>
        </>
      )}

      {!isSimpleVoting && (
        <>
          <div className="flex justify-between">
            <p className="text-sm text-green-500">
              VOTES {formatNumberUSStyle(proposalInfo?.scores_total || 0, true)}
            </p>
          </div>

          <div className="p-3 text-sm text-gray-500">
            <ColorBar
              greenScore={proposalInfo?.scores_total || 0}
              redScore={0}
              threshold={threshold}
              noTooltip
            />
          </div>
        </>
      )}

      <div className="flex justify-between">
        <p className="text-sm">QUORUM {formatNumberUSStyle(threshold)}</p>
        <p className="text-sm">
          VOTERS {formatNumberUSStyle(proposalInfo?.votes || 0, true)}
        </p>
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
            query.sortBy === 'vp'
              ? 'text-blue-500 underline'
              : 'text-gray-400 hover:text-gray-600'
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
                  <Voter address={vote.voter} />
                </div>
                &nbsp;
                <span
                  className={classNames(getColorOfChoice(vote.choiceLabel), '')}
                >
                  voted {vote.choiceLabel}
                </span>
              </div>
            }
            rightContent={
              <div>
                {`${formatNumberUSStyle(vote.vp, true)} (${(
                  (vote.vp * 100) /
                  (proposalInfo?.scores_total ?? 1)
                ).toFixed()}%)`}
              </div>
            }
          />
        )}

        {!isSimpleVoting && (
          <>
            <VoteItemHeader
              leftContent={<Voter address={vote.voter} />}
              rightContent={
                <div className="text-sm text-slate-500">
                  {`${formatNumberUSStyle(vote.vp, true)} (${(
                    (vote.vp * 100) /
                    (proposalInfo?.scores_total ?? 1)
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
      snapshotSpace={SNAPSHOT_SPACE_NAME}
      snapshotProposal={proposalInfo}
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
