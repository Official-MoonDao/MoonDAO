import { NanceProvider, useProposal } from '@nance/nance-hooks'
import { getActionsFromBody } from '@nance/nance-sdk'
import { createEnumParam, useQueryParams, withDefault } from 'next-query-params'
import { useRouter } from 'next/router'
import { NANCE_API_URL, NANCE_SPACE_NAME } from '../../lib/nance/constants'
import { useVotesOfProposal } from '../../lib/snapshot'
import ActionLabel from '../../components/nance/ActionLabel'
import DropDownMenu from '../../components/nance/DropdownMenu'
import MarkdownWithTOC from '../../components/nance/MarkdownWithTOC'
import ProposalInfo, {
  ProposalInfoSkeleton,
} from '../../components/nance/ProposalInfo'
import ProposalSummary from '../../components/nance/ProposalSummary'
import ProposalVotes from '../../components/nance/ProposalVotes'

function ProposalSkeleton() {
  return (
    <div className="absolute top-0 left-0 lg:left-[20px] h-[100vh] overflow-auto w-full lg:px-10 page-border-and-color font-[Lato]">
      <header className="relative isolate">
        <div
          className="absolute inset-0 -z-10 overflow-hidden"
          aria-hidden="true"
        >
          <div className="absolute left-16 top-full -mt-16 transform-gpu opacity-50 blur-3xl xl:left-1/2 xl:-ml-80">
            <div
              className="aspect-[1154/678] w-[72.125rem] bg-gradient-to-br from-[#FF80B5] to-[#9089FC]"
              style={{
                clipPath:
                  'polygon(100% 38.5%, 82.6% 100%, 60.2% 37.7%, 52.4% 32.1%, 47.5% 41.8%, 45.2% 65.6%, 27.5% 23.4%, 0.1% 35.3%, 17.9% 0%, 27.7% 23.4%, 76.2% 2.5%, 74.2% 56%, 100% 38.5%)',
              }}
            />
          </div>
          <div className="absolute inset-x-0 bottom-0 h-px bg-gray-900/5" />
        </div>

        <div className="mx-auto max-w-7xl px-4 py-4 sm:px-6 lg:px-8 lg:py-10">
          <div className="flex flex-row justify-between">
            <ProposalInfoSkeleton />
          </div>
        </div>
      </header>

      <div className="mx-auto max-w-7xl px-4 sm:px-6 sm:py-16 lg:px-8">
        <div className="mx-auto grid max-w-2xl grid-cols-1 grid-rows-1 items-start gap-x-8 gap-y-8 lg:mx-0 lg:max-w-none lg:grid-cols-3">
          {/* Proposal */}
          <div className="h-[600px] animate-pulse inner-container-background shadow-sm ring-1 ring-gray-900/5 sm:rounded-lg sm:px-8 sm:pb-14 lg:col-span-2 lg:row-span-2 lg:row-end-2 xl:px-16 xl:pb-20 xl:pt-16"></div>
        </div>
      </div>
    </div>
  )
}

function Proposal() {
  const [query, setQuery] = useQueryParams({
    sortBy: withDefault(createEnumParam(['time', 'vp']), 'time'),
  })

  const router = useRouter()
  const proposalId = router.query.proposal as string
  const { data, isLoading } = useProposal({
    space: NANCE_SPACE_NAME,
    uuid: proposalId,
  })
  let proposalPacket = data?.data
  if (proposalPacket) {
    proposalPacket = {
      ...proposalPacket,
      actions:
        proposalPacket.actions.length > 0
          ? proposalPacket.actions
          : getActionsFromBody(proposalPacket.body) || [],
    }
  }

  const fetchVotes =
    proposalPacket?.voteURL !== undefined &&
    (proposalPacket?.status === 'Voting' ||
      proposalPacket?.status === 'Approved' ||
      proposalPacket?.status === 'Cancelled')

  const { data: votes, mutate } = useVotesOfProposal(
    proposalPacket?.voteURL,
    1000, // first
    0, // skip
    query.sortBy as 'created' | 'vp', // orderBy
    fetchVotes // shouldFetch
  )

  if (isLoading) {
    return <ProposalSkeleton />
  } else if (!proposalPacket) {
    return <p>Proposal not found</p>
  }

  return (
    <div className="absolute top-0 left-0 lg:left-[20px] h-[100vh] overflow-auto w-full lg:px-10 bg-white py-5 dark:bg-[#040C1A] shadow-[0px_4px_29px_0px_rgba(0,0,0,0.03)] dark:shadow-none font-[Lato]">
      <header className="relative isolate">
        <div
          className="absolute inset-0 -z-10 overflow-hidden"
          aria-hidden="true"
        >
          <div className="absolute left-16 top-full -mt-16 transform-gpu opacity-50 blur-3xl xl:left-1/2 xl:-ml-80">
            <div
              className="aspect-[1154/678] w-[72.125rem] bg-gradient-to-br from-[#FF80B5] to-[#9089FC]"
              style={{
                clipPath:
                  'polygon(100% 38.5%, 82.6% 100%, 60.2% 37.7%, 52.4% 32.1%, 47.5% 41.8%, 45.2% 65.6%, 27.5% 23.4%, 0.1% 35.3%, 17.9% 0%, 27.7% 23.4%, 76.2% 2.5%, 74.2% 56%, 100% 38.5%)',
              }}
            />
          </div>
          <div className="absolute inset-x-0 bottom-0 h-px bg-gray-900/5" />
        </div>

        <div className="mx-auto max-w-7xl px-4 py-4 sm:px-6 lg:px-8 lg:py-10">
          <div className="flex flex-row justify-between">
            <ProposalInfo
              proposalPacket={proposalPacket}
              votingInfo={votes?.proposal}
              linkDisabled
              sponsorDisabled={false}
              coauthorsDisabled={false}
            />
            <DropDownMenu proposalPacket={proposalPacket} />
          </div>
        </div>
      </header>

      <div className="mx-auto max-w-7xl px-4 sm:px-6 sm:py-16 lg:px-8">
        <div className="mx-auto grid max-w-2xl grid-cols-1 grid-rows-1 items-start gap-x-8 gap-y-8 lg:mx-0 lg:max-w-none lg:grid-cols-3">
          {/* Proposal */}
          <div className="inner-container-background -mx-4 px-4 py-8 shadow-sm ring-1 ring-gray-900/5 sm:mx-0 sm:rounded-lg sm:px-8 sm:pb-14 lg:col-span-2 lg:row-span-2 lg:row-end-2 xl:px-16 xl:pb-20 xl:pt-16">
            {proposalPacket.actions && proposalPacket.actions.length > 0 && (
              <div className="mb-4 break-words ">
                <p className="text-gray-400">Proposed Transactions</p>
                <div className="mt-2 space-y-2 text-sm">
                  {proposalPacket.actions?.map((action) => (
                    <ActionLabel action={action} key={action.uuid} />
                  ))}
                </div>
                <div className="mt-2 w-full border-t border-gray-300" />
              </div>
            )}

            <div className="mb-6">
              <ProposalSummary
                proposalSummary={proposalPacket.proposalSummary}
                threadSummary={proposalPacket.threadSummary}
              />
            </div>

            <MarkdownWithTOC
              body={proposalPacket.body || '--- No content ---'}
            />
          </div>

          {/* Votes */}
          {proposalPacket.voteURL && votes && (
            <div className="lg:col-start-3">
              <button
                className="text-lg font-semibold leading-6 text-gray-900 dark:text-white"
                id="votes"
                onClick={() => {
                  if (query.sortBy === 'time') {
                    setQuery({ sortBy: 'vp' })
                  } else {
                    setQuery({ sortBy: 'time' })
                  }
                }}
              >
                Votes
                <span className="ml-2 text-center text-xs text-gray-300">
                  sort by {query.sortBy === 'vp' ? 'voting power' : 'time'}
                </span>
              </button>
              {/* <NewVote
                snapshotSpace={'jbdao.eth'}
                proposalSnapshotId={proposalPacket.voteURL as string}
              /> */}
              <ProposalVotes votesOfProposal={votes} refetch={() => mutate()} />
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

export default function ProposalPage() {
  return (
    <NanceProvider apiUrl={NANCE_API_URL}>
      <Proposal />
    </NanceProvider>
  )
}
