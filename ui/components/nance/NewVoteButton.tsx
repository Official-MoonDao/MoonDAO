import { usePrivy } from '@privy-io/react-auth'
import { useState, useEffect } from 'react'
import { Project } from '@/lib/project/useProjectData'
import useAccountAddress from '../../lib/nance/useAccountAddress'
import { classNames } from '../../lib/utils/tailwind'
import VotingModal from './VotingModal'

export default function NewVoteButton({
  snapshotProposal,
  votes,
  project,
  refetch,
  isSmall = false,
}: {
  snapshotProposal: any
  votes: any[]
  project: Project
  refetch: (option?: any) => void
  isSmall?: boolean
}) {
  // state
  const [modalIsOpen, setModalIsOpen] = useState(false)
  // external hook
  const { address, isConnected } = useAccountAddress()
  const { connectWallet: openConnectModal } = usePrivy()
  const [edit, setEdit] = useState(false)

  useEffect(() => {
    if (votes && address) {
      for (const v of votes) {
        if (v.address.toLowerCase() === address.toLowerCase()) {
          setEdit(true)
          break
        }
      }
    }
  }, [address, votes])

  let buttonLabel = 'Vote'
  if (snapshotProposal === undefined) {
    buttonLabel = 'Loading'
  }
  if (snapshotProposal?.state == 'temp-check') {
    buttonLabel = 'Temp Check'
  } else if (snapshotProposal?.state !== 'temp-check-passed') {
    buttonLabel = 'Voting Closed'
  } else if (address) {
    if (edit) {
      buttonLabel = 'Edit Vote'
    } else {
      buttonLabel = 'Vote'
    }
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
        disabled={snapshotProposal?.state !== 'temp-check-passed'}
      >
        <span>{buttonLabel}</span>
      </button>

      {modalIsOpen && (
        <VotingModal
          modalIsOpen={modalIsOpen}
          closeModal={() => setModalIsOpen(false)}
          votes={votes}
          project={project}
          address={address}
          proposal={snapshotProposal}
          spaceHideAbstain={true}
          refetch={refetch}
        />
      )}
    </div>
  )
}
