import { formatDistanceStrict, fromUnixTime } from 'date-fns'
import { formatNumberUSStyle } from '../../lib/nance'
import { SnapshotGraphqlVote } from '../../lib/snapshot'
import { classNames } from '../../lib/utils/tailwind'
import { AddressLink } from './AddressLink'

export default function VoteList({
  votes,
}: {
  votes: SnapshotGraphqlVote[] | undefined
}) {
  return (
    <ul className="mt-6 space-y-6">
      {votes?.map((vote, voteIdx) => (
        <li key={vote.id} className="relative flex gap-x-4">
          <div
            className={classNames(
              voteIdx === votes.length - 1 ? 'h-6' : '-bottom-6',
              'absolute left-0 top-0 flex w-6 justify-center'
            )}
          >
            <div className="w-px bg-gray-200" />
          </div>
          {vote.reason ? (
            <>
              <img
                src={`https://cdn.stamp.fyi/avatar/${vote.voter}`}
                alt=""
                className="relative mt-3 h-6 w-6 flex-none rounded-full bg-gray-50"
              />
              <div className="flex-auto rounded-md p-3 ring-1 ring-inset ring-gray-200">
                <div className="flex justify-between gap-x-4">
                  <div className="py-0.5 text-xs leading-5 text-gray-500">
                    <span className="font-medium text-gray-900">
                      <AddressLink address={vote.voter} />
                    </span>{' '}
                    voted {vote.choiceLabel} with {formatNumberUSStyle(vote.vp)}
                  </div>
                  <time
                    dateTime={fromUnixTime(vote.created).toISOString()}
                    className="flex-none py-0.5 text-xs leading-5 text-gray-500"
                  >
                    {formatDistanceStrict(
                      fromUnixTime(vote.created),
                      new Date(),
                      {
                        addSuffix: true,
                      }
                    )}
                  </time>
                </div>
                <p className="text-sm leading-6 text-gray-500">{vote.reason}</p>
              </div>
            </>
          ) : (
            <>
              <div className="relative flex h-6 w-6 flex-none items-center justify-center bg-white">
                <div className="h-1.5 w-1.5 rounded-full bg-gray-100 ring-1 ring-gray-300" />
              </div>
              <p className="flex-auto py-0.5 text-xs leading-5 text-gray-500">
                <span className="font-medium text-gray-900">
                  <AddressLink address={vote.voter} />
                </span>{' '}
                voted {vote.choiceLabel} with{' '}
                {formatNumberUSStyle(vote.vp, true)}
              </p>
              <time
                dateTime={fromUnixTime(vote.created).toISOString()}
                className="flex-none py-0.5 text-xs leading-5 text-gray-500"
              >
                {formatDistanceStrict(fromUnixTime(vote.created), new Date(), {
                  addSuffix: true,
                })}
              </time>
            </>
          )}
        </li>
      ))}
    </ul>
  )
}
