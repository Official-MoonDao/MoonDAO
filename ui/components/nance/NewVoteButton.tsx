import { usePrivy } from '@privy-io/react-auth'
import { useState, useMemo } from 'react'
import { ProposalStatus, STATUS_DISPLAY_LABELS } from '@/lib/nance/useProposalStatus'
import { Project } from '@/lib/project/useProjectData'
import useAccountAddress from '../../lib/nance/useAccountAddress'
import { classNames } from '../../lib/utils/tailwind'
import { useTotalLockedMooney } from '@/lib/tokens/hooks/useTotalLockedMooney'
import { useTotalVMOONEY } from '@/lib/tokens/hooks/useTotalVMOONEY'
import VotingModal from './VotingModal'

// Same '1' / '2' / '3' choice keys VotingModal writes into the
// NonProjectProposal_* table. Kept inline rather than importing from
// MemberVoteSidebar so this component stays usable on the legacy
// /proposal/[id] route too (where ProposalVotes still renders it).
const VOTE_CHOICE_LABELS: Record<string, string> = {
  '1': 'For',
  '2': 'Against',
  '3': 'Abstain',
}

// Map a quadratic distribution like { '1': 70, '2': 30 } back to the
// dominant label. Single-click votes (the default since the
// SingleClickChoiceSelector landed) are always 100/0/0 so this picks
// the only nonzero key; legacy split votes still resolve to whichever
// side got the most weight, matching the dominantChoice logic in the
// sidebar so "You voted" and the per-voter pill always agree.
function dominantVoteLabel(
  vote: Record<string, number> | undefined
): string | null {
  if (!vote) return null
  let best: [string, number] | null = null
  for (const [k, v] of Object.entries(vote)) {
    const n = Number(v)
    if (!Number.isFinite(n)) continue
    if (best === null || n > best[1]) best = [k, n]
  }
  if (!best || best[1] <= 0) return null
  return VOTE_CHOICE_LABELS[best[0]] ?? `Choice ${best[0]}`
}

export default function NewVoteButton({
  votes,
  proposalStatus,
  project,
  isSmall = false,
}: {
  votes: any[]
  proposalStatus: ProposalStatus
  project: Project
  isSmall?: boolean
}) {
  const [modalIsOpen, setModalIsOpen] = useState(false)
  const { address, isConnected } = useAccountAddress()
  const { connectWallet: openConnectModal } = usePrivy()
  const { breakdown: lockedMooneyBreakdown } = useTotalLockedMooney(address)
  const { totalVMOONEY } = useTotalVMOONEY(address, lockedMooneyBreakdown)

  // Find the connected wallet's vote row in `votes` (if any). Drives
  // both the "Edit Vote" / "Vote" label switch and the new "You voted"
  // pill that surfaces the actual choice the user already cast — fixing
  // the previous UX where a returning voter saw "Edit Vote" with no
  // hint of what they'd voted for.
  const myVote = useMemo(() => {
    if (!votes || !address) return null
    const lower = address.toLowerCase()
    for (const v of votes) {
      if (
        v &&
        typeof v.address === 'string' &&
        v.address.toLowerCase() === lower
      ) {
        return v
      }
    }
    return null
  }, [votes, address])

  const myChoice = useMemo(() => dominantVoteLabel(myVote?.vote), [myVote])

  const edit = Boolean(myVote)

  let buttonLabel = 'Vote'
  if (proposalStatus === undefined) {
    buttonLabel = 'Loading'
  }
  if (proposalStatus == 'Temperature Check') {
    buttonLabel = STATUS_DISPLAY_LABELS['Temperature Check'] ?? proposalStatus
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

  // Tone for the "You voted" pill. Mirrors the per-voter ChoicePill
  // colors in MemberVoteSidebar so the "your vote" pill and the
  // matching row in the sidebar always read as the same color.
  const myChoiceCls =
    myChoice === 'For'
      ? 'bg-green-500/15 text-green-300 border-green-500/30'
      : myChoice === 'Against'
      ? 'bg-red-500/15 text-red-300 border-red-500/30'
      : myChoice === 'Abstain'
      ? 'bg-gray-500/15 text-gray-300 border-gray-500/30'
      : 'bg-white/5 text-white/60 border-white/10'

  return (
    <div className={isSmall ? '' : 'my-4'}>
      {edit && myChoice && (
        <div className="mb-2 flex items-center justify-center gap-2 text-[11px] text-white/70">
          <span>You voted</span>
          <span
            className={`inline-flex items-center font-medium px-2 py-0.5 rounded-full border ${myChoiceCls}`}
          >
            {myChoice}
          </span>
        </div>
      )}
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
          totalVMOONEY={totalVMOONEY}
        />
      )}
    </div>
  )
}
