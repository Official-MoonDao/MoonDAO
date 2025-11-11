import { usePrivy } from '@privy-io/react-auth'
import { useState } from 'react'
import { Project } from '@/lib/project/useProjectData'
import useAccountAddress from '../../lib/nance/useAccountAddress'
import { SnapshotGraphqlProposalVotingInfo } from '@/lib/snapshot'
import { classNames } from '../../lib/utils/tailwind'
import VotingModal from './VotingModal'

export default function NewVoteButton({
  snapshotProposal,
  votesOfProposal,
  project,
  snapshotSpace,
  refetch,
  isSmall = false,
}: {
  snapshotProposal: SnapshotGraphqlProposalVotingInfo | undefined
  votesOfProposal: any
  snapshotSpace: string
  project: Project
  refetch: (option?: any) => void
  isSmall?: boolean
}) {
  // state
  const [modalIsOpen, setModalIsOpen] = useState(false)
  // external hook
  const { address, isConnected } = useAccountAddress()
  console.log('isConnected', isConnected)
  console.log('address', address)
  const { connectWallet: openConnectModal } = usePrivy()

  let buttonLabel = 'Vote'
  if (snapshotProposal === undefined) {
    buttonLabel = 'Loading'
  }
  console.log('snapshotProposal', snapshotProposal)
  if (snapshotProposal?.state !== 'active') {
    buttonLabel = 'Voting Closed'
  } else if (address) {
    buttonLabel = 'Vote'
  } else {
    buttonLabel = 'Connect Wallet'
  }

  return (
    <div className={isSmall ? '' : 'my-4'}>
      <button
        id="vote"
        className={classNames(
          'inline-flex w-full items-center justify-center rounded-md border border-transparent bg-blue-600 py-2 text-sm font-medium text-white shadow-sm hover:bg-blue-500 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-gray-100 disabled:cursor-not-allowed disabled:bg-gray-300 disabled:text-black disabled:opacity-50',
          isSmall ? '' : 'px-4'
        )}
        onClick={(e) => {
          e.stopPropagation()
          if (address) {
            setModalIsOpen(true)
          } else {
            openConnectModal?.()
          }
        }}
        disabled={snapshotProposal?.state !== 'active'}
      >
        <span>{buttonLabel}</span>
      </button>

      {modalIsOpen && (
        <VotingModal
          modalIsOpen={modalIsOpen}
          closeModal={() => setModalIsOpen(false)}
          votesOfProposal={votesOfProposal}
          project={project}
          address={address}
          spaceId={snapshotSpace}
          proposal={snapshotProposal}
          spaceHideAbstain={true}
          refetch={refetch}
        />
      )}
    </div>
  )
}
