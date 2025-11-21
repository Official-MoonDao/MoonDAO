import { usePrivy } from '@privy-io/react-auth'
import { useState, useEffect } from 'react'
import { ProposalStatus } from '@/lib/nance/useProposalStatus'
import { Project } from '@/lib/project/useProjectData'
import useAccountAddress from '../../lib/nance/useAccountAddress'
import { classNames } from '../../lib/utils/tailwind'
import { useTotalLockedMooney } from '@/lib/tokens/hooks/useTotalLockedMooney'
import { useTotalVMOONEY } from '@/lib/tokens/hooks/useTotalVMOONEY'
import VotingModal from './VotingModal'

export default function NewVoteButton({
  votes,
  proposalStatus,
  project,
  refetch,
  isSmall = false,
}: {
  votes: any[]
  proposalStatus: ProposalStatus
  project: Project
  refetch: (option?: any) => void
  isSmall?: boolean
}) {
  const [modalIsOpen, setModalIsOpen] = useState(false)
  const { address, isConnected } = useAccountAddress()
  const { connectWallet: openConnectModal } = usePrivy()
  const [edit, setEdit] = useState(false)
  const { breakdown: lockedMooneyBreakdown } = useTotalLockedMooney(address)
  const { totalVMOONEY } = useTotalVMOONEY(address, lockedMooneyBreakdown)

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
  if (proposalStatus === undefined) {
    buttonLabel = 'Loading'
  }
  if (proposalStatus == 'Temperature Check') {
    buttonLabel = proposalStatus
  } else if (proposalStatus !== 'Voting') {
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
  console.log('new vote button')

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
        disabled={proposalStatus !== 'Voting'}
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
          spaceHideAbstain={true}
          refetch={refetch}
          totalVMOONEY={totalVMOONEY}
        />
      )}
    </div>
  )
}
