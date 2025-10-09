import {
  useQueryParams,
  withDefault,
  NumberParam,
  createEnumParam,
} from 'next-query-params'
import Link from 'next/link'
import { useCallback, useMemo } from 'react'
import { formatNumberUSStyle } from '@/lib/nance'
import { generatePrettyLinkWithId } from '@/lib/subscription/pretty-links'
import { DistributionVote } from '@/lib/tableland/types'
import { useTotalVPs } from '@/lib/tokens/hooks/useTotalVP'
import { classNames } from '@/lib/utils/tailwind'
import Votes, {
  VoteItem,
  VoteItemHeader,
  VoteItemDetails,
} from '../layout/Votes'
import { MultiVotingProgressBar } from '../layout/VotingProgressBar'
import { AddressLink } from '../nance/AddressLink'

const getTotalVoteWeight = (vote: { [key: string]: number }) => {
  return Object.values(vote).reduce((sum, value) => sum + value, 0)
}

const getAllFinalistDistributions = (
  votes: DistributionVote[],
  finalists: any[]
) => {
  const totalVotingWeight = votes.reduce(
    (sum, vote) => sum + getTotalVoteWeight(vote.vote),
    0
  )

  const finalistTotals: { [key: string]: number } = {}

  votes.forEach((vote) => {
    const voterTotalWeight = getTotalVoteWeight(vote.vote)

    Object.entries(vote.vote).forEach(([finalistId, percentage]) => {
      if (!finalistTotals[finalistId]) {
        finalistTotals[finalistId] = 0
      }
      finalistTotals[finalistId] += (percentage / 100) * voterTotalWeight
    })
  })

  const distributions = Object.entries(finalistTotals)
    .map(([finalistId, totalWeight]) => {
      const finalist = finalists?.find((f) => f.id === +finalistId)
      const percentage =
        totalVotingWeight > 0 ? (totalWeight / totalVotingWeight) * 100 : 0

      return {
        finalistId: +finalistId,
        finalist,
        totalWeight,
        percentage,
        name: finalist?.name || `Finalist ${finalistId}`,
        formattedPercentage: formatNumberUSStyle(percentage, true),
      }
    })
    .sort((a, b) => b.totalWeight - a.totalWeight)

  return distributions
}

export default function DistributionVotes({
  votes,
  finalists,
  title = 'Distribution Votes',
  refetch,
}: {
  votes: DistributionVote[]
  finalists?: any[]
  title?: string
  refetch?: () => void
}) {
  const addresses = useMemo(() => {
    return votes ? votes.map((d) => d.address) : []
  }, [votes])

  const { walletVPs: _vps } = useTotalVPs(addresses)

  const addressToQuadraticVotingPower = useMemo(() => {
    const hasValidVotingPowers =
      _vps && _vps.some((vp) => vp !== undefined && vp > 0)

    if (!hasValidVotingPowers) {
      return Object.fromEntries(addresses.map((address) => [address, 1]))
    }

    return Object.fromEntries(
      addresses.map((address, index) => [address, _vps[index] || 0])
    )
  }, [addresses, _vps])

  const formatVoteDistribution = useCallback(
    (vote: { [key: string]: number }) => {
      return Object.entries(vote)
        .map(([key, value]) => {
          if (value === 0) return
          const finalist = finalists?.find((finalist) => finalist.id === +key)
          return `${finalist?.name} (${formatNumberUSStyle(value, true)}%)`
        })
        .filter((item) => item !== undefined)
        .join(', ')
    },
    [finalists]
  )

  const [query, setQuery] = useQueryParams({
    page: withDefault(NumberParam, 1),
    sortBy: withDefault(createEnumParam(['name', 'choice', 'time']), 'time'),
    filterBy: withDefault(createEnumParam(['']), ''),
  })

  const totalParticipants = votes.length
  const totalVoteWeight = votes.reduce(
    (sum, vote) => sum + getTotalVoteWeight(vote.vote),
    0
  )

  let sortedVotes = [...votes]
  if (query.sortBy === 'name') {
    sortedVotes.sort((a, b) => {
      const nameA = a.citizenName || ''
      const nameB = b.citizenName || ''

      if (nameA && nameB) {
        return nameA.localeCompare(nameB)
      }
      if (nameA && !nameB) return -1
      if (!nameA && nameB) return 1
      return a.address.localeCompare(b.address)
    })
  } else if (query.sortBy === 'time') {
    sortedVotes.sort((a: any, b: any) => a.id - b.id)
  }

  // Filter votes if a specific choice is selected
  let filteredVotes = sortedVotes
  if (query.filterBy && query.filterBy !== '') {
    filteredVotes = sortedVotes.filter((vote) =>
      Object.keys(vote.vote).includes(query.filterBy)
    )
  }

  // Generate color palette for finalists
  const generateFinalistColors = (count: number) => {
    const baseColors = [
      'bg-green-500',
      'bg-blue-500',
      'bg-purple-500',
      'bg-yellow-500',
      'bg-red-500',
      'bg-indigo-500',
      'bg-pink-500',
      'bg-teal-500',
      'bg-orange-500',
      'bg-cyan-500',
      'bg-lime-500',
      'bg-amber-500',
      'bg-emerald-500',
      'bg-violet-500',
    ]

    return Array.from(
      { length: count },
      (_, index) => baseColors[index % baseColors.length]
    )
  }

  const summarySection = (
    <>
      <div className="flex justify-between">
        <p className="text-sm text-blue-500">
          VOTERS {formatNumberUSStyle(totalParticipants, true)}
        </p>
      </div>

      {/* Multi-segment progress bar showing quadratic voting results */}
      {finalists && finalists.length > 0 && votes && votes.length > 0 && (
        <div className="p-3 text-sm text-gray-500">
          {(() => {
            const votingPowersReady = Object.values(
              addressToQuadraticVotingPower
            ).some((vp) => vp !== undefined)

            if (!votingPowersReady) {
              return (
                <div className="text-gray-400 text-sm">
                  Loading voting powers...
                </div>
              )
            }

            // Use quadratic voting calculation
            const distributions = getAllFinalistDistributions(
              votes,
              finalists || []
            )
            const colors = generateFinalistColors(distributions.length)

            const segments = distributions.map((dist, index) => ({
              percentage: dist.percentage,
              color: colors[index] || 'bg-gray-400',
              label: `${dist.name}: ${dist.formattedPercentage}%`,
            }))

            console.log('Debug - segments for MultiProgressBar:', segments)

            if (segments.length === 0) {
              return (
                <div className="text-gray-400 text-sm">
                  No voting results available
                </div>
              )
            }

            return <MultiVotingProgressBar segments={segments} height="h-4" />
          })()}
        </div>
      )}
    </>
  )

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

  const voteItems = filteredVotes.map((vote, index) => (
    <VoteItem key={`${vote.address}-${index}`}>
      <VoteItemHeader
        leftContent={
          vote.citizenName && vote.citizenId ? (
            <Link
              href={`/citizen/${generatePrettyLinkWithId(
                vote.citizenName,
                vote.citizenId
              )}`}
              className="break-all hover:underline"
            >
              {vote.citizenName}
            </Link>
          ) : (
            <AddressLink address={vote.address} />
          )
        }
      />
      <VoteItemDetails>{formatVoteDistribution(vote.vote)}</VoteItemDetails>
    </VoteItem>
  ))

  const footerSection = refetch ? (
    <button
      onClick={refetch}
      className="w-full bg-blue-500 hover:bg-blue-600 text-white py-2 px-4 rounded"
    >
      Refresh Votes
    </button>
  ) : undefined

  return (
    <Votes
      title={title}
      summarySection={summarySection}
      controlsSection={controlsSection}
      voteItems={voteItems}
      footerSection={footerSection}
      showContainer={true}
      emptyStateMessage="No votes found matching the current filter."
    />
  )
}
