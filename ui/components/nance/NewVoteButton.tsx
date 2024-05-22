import { usePrivy, useWallets } from '@privy-io/react-auth'
import { useContext, useState } from 'react'
import PrivyWalletContext from '../../lib/privy/privy-wallet-context'
import { SnapshotGraphqlProposalVotingInfo } from '../../lib/snapshot'
import { classNames } from '../../lib/utils/tailwind'
import VotingModal from './VotingModal'

export default function NewVoteButton({
  snapshotProposal,
  snapshotSpace,
  refetch,
  isSmall = false,
}: {
  snapshotProposal: SnapshotGraphqlProposalVotingInfo | undefined
  snapshotSpace: string
  refetch: (option?: any) => void
  isSmall?: boolean
}) {
  // state
  const [modalIsOpen, setModalIsOpen] = useState(false)
  // external hook
  const { wallets, ready: isConnected } = useWallets()
  const { selectedWallet } = useContext(PrivyWalletContext)
  const address = wallets[selectedWallet]?.address
  const { connectWallet: openConnectModal } = usePrivy()

  let buttonLabel = 'Vote'
  if (snapshotProposal === undefined) {
    buttonLabel = 'Loading'
  }
  if (snapshotProposal?.state !== 'active') {
    buttonLabel = 'Voting Closed'
  } else if (isConnected) {
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
          if (isConnected) {
            setModalIsOpen(true)
          } else {
            openConnectModal?.()
          }
        }}
        disabled={snapshotProposal?.state !== 'active'}
      >
        <span>{buttonLabel}</span>
      </button>

      {snapshotProposal?.choices && modalIsOpen && (
        <VotingModal
          modalIsOpen={modalIsOpen}
          closeModal={() => setModalIsOpen(false)}
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
