import { Dialog, Transition } from '@headlessui/react'
import {
  CheckCircleIcon,
  MinusCircleIcon,
  XCircleIcon,
  XMarkIcon,
} from '@heroicons/react/24/solid'
import { useWallets } from '@privy-io/react-auth'
import confetti from 'canvas-confetti'
import NonProjectProposalABI from 'const/abis/NonProjectProposal.json'
import { DEFAULT_CHAIN_V5, NON_PROJECT_PROPOSAL_ADDRESSES } from 'const/config'
import { useState, Fragment, useEffect, useMemo } from 'react'
import toast from 'react-hot-toast'
import { prepareContractCall, sendAndConfirmTransaction } from 'thirdweb'
import { useActiveAccount } from 'thirdweb/react'
import toastStyle from '@/lib/marketplace/marketplace-utils/toastConfig'
import { formatNumberUSStyle } from '@/lib/nance'
import { sendOnchainNotification } from '@/lib/notifications/sendOnchainNotification'
import { Project } from '@/lib/project/useProjectData'
import { getChainSlug } from '@/lib/thirdweb/chain'
import useContract from '@/lib/thirdweb/hooks/useContract'
import { classNames } from '@/lib/utils/tailwind'
import { PrivyWeb3Button } from '@/components/privy/PrivyWeb3Button'

interface VotingProps {
  modalIsOpen: boolean
  closeModal: () => void
  address: string | undefined
  project: Project
  votes: any[]
  totalVMOONEY: any
}

const SUPPORTED_VOTING_TYPES = ['single-choice', 'basic', 'weighted', 'quadratic', 'ranked-choice']

export default function VotingModal({
  modalIsOpen,
  closeModal,
  address,
  project,
  votes,
  totalVMOONEY,
}: VotingProps) {
  // state
  const [choice, setChoice] = useState()
  const [reason, setReason] = useState('')
  const chain = DEFAULT_CHAIN_V5
  const chainSlug = getChainSlug(chain)
  const account = useActiveAccount()
  const userAddress = account?.address
  const proposalTableContract = useContract({
    address: NON_PROJECT_PROPOSAL_ADDRESSES[chainSlug],
    chain: chain,
    abi: NonProjectProposalABI.abi as any,
  })
  const [edit, setEdit] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  useEffect(() => {
    if (votes && userAddress) {
      for (const v of votes) {
        if (v.address.toLowerCase() === userAddress.toLowerCase()) {
          setChoice(v.vote)
          setEdit(true)
          break
        }
      }
    }
  }, [userAddress, votes])

  const choices = ['Yes', 'No', 'Abstain'] // could make this dynamic in the future
  // external
  const vp = Math.sqrt(totalVMOONEY) || 0

  // The previous voter to hit `nonce has already been used` was on the wrong
  // network — MetaMask was on Ethereum, vote was sent against the
  // NonProjectProposal contract that only exists on Arbitrum, and the
  // signed tx ended up at a stale nonce. Surface the chain mismatch as a
  // first-class banner inside the modal so the user sees it *before*
  // signing, in addition to the Submit button auto-flipping to a "Switch
  // Network" CTA via PrivyWeb3Button.
  const { wallets } = useWallets()
  const connectedChainId = useMemo(() => {
    const raw = wallets?.[0]?.chainId
    if (!raw) return undefined
    const parts = String(raw).split(':')
    return Number(parts[parts.length - 1]) || undefined
  }, [wallets])
  const requiredChainId = DEFAULT_CHAIN_V5.id
  const isWrongNetwork =
    Boolean(address) &&
    Boolean(connectedChainId) &&
    connectedChainId !== requiredChainId

  const handleSubmit = async () => {
    if (!choice) {
      return
    }
    const totalPercentage = Object.values(choice as Record<string, number>).reduce(
      (sum, value) => sum + (value as number),
      0
    )
    if (totalPercentage !== 100) {
      toast.error('Total distribution must equal 100%.', {
        style: toastStyle,
      })
      return
    }
    try {
      if (!account) throw new Error('No account found')
      setSubmitting(true)
      let receipt
      if (edit) {
        const transaction = prepareContractCall({
          contract: proposalTableContract,
          method: 'updateTableCol' as string,
          params: [project.MDP, JSON.stringify(choice)],
        })
        receipt = await sendAndConfirmTransaction({
          transaction,
          account,
        })
        toast.success('Vote updated!')
      } else {
        const transaction = prepareContractCall({
          contract: proposalTableContract,
          method: 'insertIntoTable' as string,
          params: [project.MDP, JSON.stringify(choice)],
        })
        receipt = await sendAndConfirmTransaction({
          transaction,
          account,
        })
        toast.success('Vote submitted!')
      }

      // Post a Discord notification about this Senate vote. Fire-and-forget:
      // never block the UI on it. The helper handles auth, retries, and logs
      // failures to the console so we can spot regressions.
      void sendOnchainNotification(
        '/api/proposals/vote-notification',
        {
          txHash: receipt?.transactionHash,
          kind: 'senate',
          proposalName: project?.name,
          proposalMDP: project?.MDP,
          isEdit: edit,
        },
        { label: 'senate-vote-notification' }
      )

      // Celebrate + dismiss. Same confetti palette the SenateVote
      // component uses on a successful approve so the visual language
      // stays consistent across both vote stages. Closing the modal
      // here means the user lands back on the proposal page (where
      // the right-rail sidebar reflects their vote on the next
      // getServerSideProps refresh) without having to hunt for the X.
      confetti({
        particleCount: 150,
        spread: 100,
        origin: { y: 0.6 },
        shapes: ['circle', 'star'],
        colors: ['#22c55e', '#4ade80', '#86efac', '#ffffff', '#FFD700'],
      })
      setSubmitting(false)
      closeModal()
    } catch (error) {
      console.error('Error submitting distribution:', error)
      toast.error('Error submitting distribution. Please try again.', {
        style: toastStyle,
      })
      setSubmitting(false)
    }
  }

  let proposalType
  if (true) {
    proposalType = 'quadratic'
  }

  const renderVoteButton = () => {
    // PrivyWeb3Button owns the wallet/network state machine: it flips
    // its own label/handler to "Sign In" when unauthenticated and to
    // "Switch Network" when the connected chain doesn't match
    // `requiredChain`. We only need to drive the *action* button
    // label (state 2). `actionDisabled` (vs `isDisabled`) is
    // important here: blocking the whole button would also block
    // the Switch Network affordance, leaving wrong-network users
    // unable to resolve their network *before* the form considers
    // itself submittable.
    let canVote = false
    let actionLabel = 'Submit vote'

    if (!SUPPORTED_VOTING_TYPES.includes(proposalType)) {
      actionLabel = 'Not supported'
    } else if (choice === undefined) {
      actionLabel = 'Select a choice'
    } else if (vp <= 0) {
      actionLabel = 'No voting power'
    } else if (submitting) {
      actionLabel = 'Submitting...'
    } else {
      canVote = true
      actionLabel = 'Submit vote'
    }

    return (
      <PrivyWeb3Button
        label={actionLabel}
        loadingLabel="Submitting..."
        action={handleSubmit}
        requiredChain={DEFAULT_CHAIN_V5}
        actionDisabled={!canVote}
        noGradient
        noPadding
        className="w-full bg-gradient-to-r from-blue-500 to-purple-600 hover:from-blue-600 hover:to-purple-700 disabled:from-gray-600 disabled:to-gray-700 disabled:cursor-not-allowed !text-white py-3 px-4 rounded-lg font-semibold transition-all duration-200 transform hover:scale-105 disabled:hover:scale-100 shadow-lg disabled:opacity-50 !text-base"
      />
    )
  }

  return (
    <Transition.Root show={modalIsOpen} as={Fragment}>
      <Dialog as="div" className="relative z-50" open={modalIsOpen} onClose={closeModal}>
        <Transition.Child
          as={Fragment}
          enter="ease-out duration-300"
          enterFrom="opacity-0"
          enterTo="opacity-100"
          leave="ease-in duration-200"
          leaveFrom="opacity-100"
          leaveTo="opacity-0"
        >
          <div className="fixed inset-0 bg-gray-500/75 backdrop-blur-sm transition-opacity" />
        </Transition.Child>

        <div className="fixed inset-0 z-10 overflow-y-auto">
          <div className="flex min-h-full items-stretch justify-center text-center md:items-center md:px-2 lg:px-4">
            <Transition.Child
              as={Fragment}
              enter="ease-out duration-300"
              enterFrom="opacity-0 translate-y-4 md:translate-y-0 md:scale-95"
              enterTo="opacity-100 translate-y-0 md:scale-100"
              leave="ease-in duration-200"
              leaveFrom="opacity-100 translate-y-0 md:scale-100"
              leaveTo="opacity-0 translate-y-4 md:translate-y-0 md:scale-95"
            >
              <Dialog.Panel className="flex w-full transform text-left text-base transition md:my-8 md:max-w-2xl md:px-4">
                <div className="relative flex w-full items-center overflow-hidden rounded-2xl bg-gradient-to-br from-gray-900 via-blue-900/30 to-purple-900/20 backdrop-blur-xl border border-white/10 shadow-2xl text-white px-4 pb-6 pt-10 sm:px-6 sm:pt-6 md:p-6">
                  <button
                    type="button"
                    className="absolute right-3 top-3 p-2 text-gray-300 hover:text-white hover:bg-white/10 rounded-full transition-colors duration-200"
                    onClick={closeModal}
                  >
                    <span className="sr-only">Close</span>
                    <XMarkIcon className="h-5 w-5" aria-hidden="true" />
                  </button>

                  <div className="grid w-full grid-cols-1 items-start gap-y-4">
                    <div className="sm:col-span-12">
                      {/* Header Section */}
                      <div className="flex items-center space-x-3 mb-4">
                        <div className="w-8 h-8 rounded-full bg-gradient-to-r from-blue-500 to-purple-600 flex items-center justify-center">
                          <div className="w-4 h-4 bg-white rounded-full flex items-center justify-center">
                            <div className="w-1.5 h-1.5 bg-blue-600 rounded-full"></div>
                          </div>
                        </div>
                        <h2 className="text-lg font-bold text-white">
                          Vote on Proposal
                        </h2>
                      </div>

                      {/* Proposal Name */}
                      <div className="bg-black/20 rounded-lg p-3 mb-4 border border-white/5">
                        <h3 className="text-base font-semibold text-white">{project.name}</h3>
                      </div>

                      {/* Proposal Stats */}
                      <section aria-labelledby="information-heading" className="mb-4">
                        <h3 id="information-heading" className="sr-only">
                          Proposal information
                        </h3>

                        <div className="bg-black/20 rounded-lg p-3 border border-white/5">
                          <div className="grid grid-cols-2 sm:grid-cols-2 gap-2 text-center">
                            <div>
                              <p className="text-gray-300 text-xs font-medium uppercase tracking-wide whitespace-nowrap">
                                Your Voting Power
                              </p>
                              <p className="text-lg font-bold text-blue-400">
                                {formatNumberUSStyle(vp, true)}
                              </p>
                            </div>

                            <div>
                              <p className="text-gray-300 text-xs font-medium uppercase tracking-wide whitespace-nowrap">
                                <span className="hidden sm:inline">Total Votes</span>
                                <span className="sm:hidden">Votes</span>
                              </p>
                              <p className="text-lg font-bold text-white">{votes.length}</p>
                            </div>
                          </div>
                        </div>
                      </section>

                      {/* Voting Section */}
                      <section aria-labelledby="options-heading" className="space-y-4">
                        <h3 id="options-heading" className="sr-only">
                          Voting options
                        </h3>

                        <form className="space-y-4">
                          {/* Option selector. Quadratic is what every
                              non-project proposal actually uses today,
                              and the old WeightedChoiceSelector forced
                              voters to type a percentage per choice
                              (which routinely failed the
                              "must equal 100%" guard and felt like
                              busywork for a yes/no question). The new
                              SingleClickChoiceSelector encodes a single
                              choice as `{ "<index>": 100 }`, the exact
                              shape `runQuadraticVoting` already
                              expects, so the on-chain tally stays
                              compatible with every prior vote — but
                              the user just clicks once. */}
                          <div>
                            <h4 className="text-gray-300 font-medium text-xs uppercase tracking-wide mb-3">
                              Select Your Choice
                            </h4>
                            {proposalType == 'ranked-choice' ? (
                              <RankedChoiceSelector
                                value={choice || []}
                                setValue={setChoice}
                                choices={choices}
                              />
                            ) : (
                              <SingleClickChoiceSelector
                                value={choice}
                                setValue={setChoice}
                                choices={choices}
                              />
                            )}
                          </div>

                          {/* Wrong-network indicator. The PrivyWeb3Button
                              below already swaps its label to "Switch
                              Network" — this just names the destination
                              so the user doesn't have to guess which
                              network. */}
                          {isWrongNetwork && (
                            <div className="rounded-lg border border-yellow-400/40 bg-yellow-500/10 px-3 py-2 text-xs text-yellow-100 flex items-center gap-2">
                              <span className="font-semibold">
                                Wrong network.
                              </span>
                              <span className="text-yellow-100/80">
                                Switch to{' '}
                                {DEFAULT_CHAIN_V5.name ?? 'Arbitrum One'} to
                                vote.
                              </span>
                            </div>
                          )}

                          {/* Vote button */}
                          <div className="pt-2">{renderVoteButton()}</div>
                        </form>
                      </section>
                    </div>
                  </div>
                </div>
              </Dialog.Panel>
            </Transition.Child>
          </div>
        </div>
      </Dialog>
    </Transition.Root>
  )
}

interface SelectorProps {
  value: any
  setValue: (value: any) => void
  choices: string[]
}

// Single-click yes/no/abstain selector. Encodes the picked option as
// `{ "<index+1>": 100 }` — the same shape the on-chain
// NonProjectProposal table stores and `runQuadraticVoting` expects, so
// the tally code is unchanged. Shown for `quadratic` / `weighted` /
// `basic` / `single-choice` proposal types now that the underlying
// vote is binary in practice. Edit mode highlights whichever choice
// has the largest weight in the existing distribution (argmax) so
// re-opening a previously cast vote shows the user's prior pick.
function SingleClickChoiceSelector({
  value,
  setValue,
  choices,
}: Omit<SelectorProps, 'value'> & {
  value: { [key: string]: number } | undefined
}) {
  const visibleChoices = useMemo(() => {
    return choices.map((label, index) => ({ label, key: String(index + 1) }))
  }, [choices])

  // Argmax over the existing distribution. Single-click votes are
  // always 100/0/0 so this resolves trivially; it also gracefully
  // highlights the dominant choice for legacy split votes.
  const selectedKey = useMemo(() => {
    if (!value) return null
    let best: [string, number] | null = null
    for (const [k, v] of Object.entries(value)) {
      const n = Number(v)
      if (!Number.isFinite(n)) continue
      if (best === null || n > best[1]) best = [k, n]
    }
    return best && best[1] > 0 ? best[0] : null
  }, [value])

  const styleFor = (label: string, isSelected: boolean) => {
    const base =
      'group flex flex-col items-center justify-center gap-2 rounded-xl border-2 p-4 transition-all duration-200 cursor-pointer select-none focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-black/20'
    if (label.toLowerCase() === 'yes' || label.toLowerCase() === 'for') {
      return classNames(
        base,
        isSelected
          ? 'bg-green-500/25 border-green-400 shadow-lg shadow-green-500/20 scale-[1.02]'
          : 'bg-green-500/5 border-green-500/20 hover:bg-green-500/15 hover:border-green-400/60'
      )
    }
    if (label.toLowerCase() === 'no' || label.toLowerCase() === 'against') {
      return classNames(
        base,
        isSelected
          ? 'bg-red-500/25 border-red-400 shadow-lg shadow-red-500/20 scale-[1.02]'
          : 'bg-red-500/5 border-red-500/20 hover:bg-red-500/15 hover:border-red-400/60'
      )
    }
    return classNames(
      base,
      isSelected
        ? 'bg-gray-500/25 border-gray-300 shadow-lg shadow-gray-500/20 scale-[1.02]'
        : 'bg-gray-500/5 border-gray-500/20 hover:bg-gray-500/15 hover:border-gray-300/60'
    )
  }

  const iconFor = (label: string, isSelected: boolean) => {
    const cls = isSelected ? 'w-7 h-7' : 'w-7 h-7 opacity-70 group-hover:opacity-100'
    if (label.toLowerCase() === 'yes' || label.toLowerCase() === 'for') {
      return <CheckCircleIcon className={`${cls} text-green-400`} />
    }
    if (label.toLowerCase() === 'no' || label.toLowerCase() === 'against') {
      return <XCircleIcon className={`${cls} text-red-400`} />
    }
    return <MinusCircleIcon className={`${cls} text-gray-300`} />
  }

  return (
    <div
      className={classNames(
        'grid gap-3',
        visibleChoices.length === 2 ? 'grid-cols-2' : 'grid-cols-3'
      )}
      role="radiogroup"
    >
      {visibleChoices.map(({ label, key }) => {
        const isSelected = selectedKey === key
        return (
          <button
            type="button"
            role="radio"
            aria-checked={isSelected}
            key={key}
            onClick={() => setValue({ [key]: 100 })}
            className={styleFor(label, isSelected)}
          >
            {iconFor(label, isSelected)}
            <span className="text-sm font-semibold text-white">{label}</span>
          </button>
        )
      })}
    </div>
  )
}

function RankedChoiceSelector({
  value,
  setValue,
  choices,
}: Omit<SelectorProps, 'value'> & {
  value: number[]
}) {
  function getOrderNumber(val: number) {
    const index = value.findIndex((v) => v === val)
    return index !== -1 ? `#${index + 1}` : ''
  }

  return (
    <div className="space-y-3">
      {choices.map((choice, index) => {
        const choiceVal = index + 1
        const isSelected = value.includes(choiceVal)
        const orderNumber = getOrderNumber(choiceVal)

        return (
          <div
            key={choice}
            onClick={() => {
              if (isSelected) {
                const newValue = value.filter((val) => val !== choiceVal)
                setValue(newValue)
              } else {
                const newValue = [...value, choiceVal]
                setValue(newValue)
              }
            }}
            className={classNames(
              'cursor-pointer rounded-lg p-4 border transition-all duration-200 group',
              isSelected
                ? 'bg-blue-500/20 border-blue-500/50 shadow-lg'
                : 'bg-black/20 border-white/10 hover:bg-black/30 hover:border-white/20'
            )}
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-3">
                {isSelected && (
                  <div className="w-8 h-8 bg-blue-500 rounded-full flex items-center justify-center">
                    <span className="text-white text-sm font-bold">{orderNumber}</span>
                  </div>
                )}
                <p className="font-medium text-white group-hover:text-blue-300 transition-colors">
                  {choice}
                </p>
              </div>

              {isSelected && (
                <button
                  type="button"
                  className="p-1 hover:bg-red-500/20 rounded-full transition-colors duration-200 group"
                >
                  <XMarkIcon className="h-5 w-5 text-red-400" aria-hidden="true" />
                </button>
              )}
            </div>
          </div>
        )
      })}

      {value.length > 0 && (
        <div className="bg-black/10 rounded-lg p-3 border border-white/5">
          <p className="text-gray-400 text-sm text-center">
            Click choices in order of preference. Click again to remove.
          </p>
        </div>
      )}
    </div>
  )
}
