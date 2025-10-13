import {
  useQueryParams,
  withDefault,
  NumberParam,
  createEnumParam,
} from 'next-query-params'
import { formatNumberUSStyle } from '@/lib/nance'
import { SNAPSHOT_SPACE_NAME } from '../../lib/nance/constants'
import { VotesOfProposal } from '@/lib/snapshot'
import { classNames } from '@/lib/utils/tailwind'
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
}: {
  votesOfProposal: VotesOfProposal
  refetch: () => void
  threshold?: number
}) {
  //const [selectedVoter, setSelectedVoter] = useState<string>('')
  const [query, setQuery] = useQueryParams({
    page: withDefault(NumberParam, 1),
    sortBy: withDefault(createEnumParam(['time', 'vp']), 'time'),
    withField: withDefault(createEnumParam(['reason', 'app']), ''),
    filterBy: withDefault(createEnumParam(['for', 'against']), ''),
  })

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
                  VOTES{' '}
                  {formatNumberUSStyle(proposalInfo?.scores_total || 0, true)}
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
        </div>

        <ul role="list" className="space-y-2">
          {votes?.map((vote) => (
            <li key={vote.id}>
              <div
                className={classNames(
                  'flex flex-col'
                  //vote.voter === selectedVoter ? 'shadow' : ''
                )}
              >
                <div
                // className="cursor-pointer"
                // onClick={() =>
                //   vote.voter === selectedVoter
                //     ? setSelectedVoter('')
                //     : setSelectedVoter(vote.voter)
                // }
                >
                  {isSimpleVoting && (
                    <div className="flex justify-between text-sm">
                      <div className="flex">
                        <div className="inline">
                          <AddressLink address={vote.voter} />
                        </div>
                        &nbsp;
                        <span
                          className={classNames(
                            getColorOfChoice(vote.choiceLabel),
                            ''
                          )}
                        >
                          voted {vote.choiceLabel}
                        </span>
                      </div>

                      <div>
                        {`${formatNumberUSStyle(vote.vp, true)} (${(
                          (vote.vp * 100) /
                          (proposalInfo?.scores_total ?? 1)
                        ).toFixed()}%)`}
                      </div>
                    </div>
                  )}

                  {!isSimpleVoting && (
                    <div className="flex flex-col text-sm">
                      <div>
                        <AddressLink address={vote.voter} />
                      </div>

                      <div className="text-sm text-slate-500">
                        {`${formatNumberUSStyle(vote.vp, true)} (${(
                          (vote.vp * 100) /
                          (proposalInfo?.scores_total ?? 1)
                        ).toFixed()}%)`}{' '}
                        total
                      </div>

                      <div className="py-2 text-sm text-gray-600">
                        {vote.choiceLabel}
                      </div>
                    </div>
                  )}

                  {vote.reason && (
                    <div className="text-sm text-gray-600">{vote.reason}</div>
                  )}
                </div>

                {/* <VoterProfile
                  space="tomoondao.eth"
                  proposal={proposalInfo?.id || ''}
                  voter={vote.voter}
                  isOpen={vote.voter === selectedVoter}
                /> */}
              </div>
            </li>
          ))}
        </ul>
      </div>

      <div className="mr-0 md:mt-auto pt-4">
        <NewVoteButton
          snapshotSpace={SNAPSHOT_SPACE_NAME}
          snapshotProposal={proposalInfo}
          refetch={refetch}
        />
      </div>
    </div>
  )
}
