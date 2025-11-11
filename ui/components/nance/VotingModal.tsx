import { Dialog, RadioGroup, Transition } from '@headlessui/react'
import useContract from '@/lib/thirdweb/hooks/useContract'
import ProposalsABI from 'const/abis/Proposals.json'
import { getChainSlug } from '@/lib/thirdweb/chain'
import { XMarkIcon } from '@heroicons/react/24/solid'
import { DEFAULT_CHAIN_V5, PROPOSALS_ADDRESSES } from 'const/config'
import { Project } from '@/lib/project/useProjectData'
import { useState, Fragment, useEffect } from 'react'
import { useForm } from 'react-hook-form'
import { useTotalLockedMooney } from '@/lib/tokens/hooks/useTotalLockedMooney'
import toast from 'react-hot-toast'
import { formatNumberUSStyle } from '@/lib/nance'
import useVote from '@/lib/nance/useVote'
import {
  SnapshotGraphqlProposalVotingInfo,
  useVotingPower,
} from '@/lib/snapshot'
import { useTotalVMOONEY } from '@/lib/tokens/hooks/useTotalVMOONEY'
import { classNames } from '@/lib/utils/tailwind'

interface VotingProps {
  modalIsOpen: boolean
  closeModal: () => void
  address: string | undefined
  spaceId: string
  spaceHideAbstain: boolean
  proposal: SnapshotGraphqlProposalVotingInfo
  project: Project
  votesOfProposal: any
  refetch: (option?: any) => void
}

const SUPPORTED_VOTING_TYPES = [
  'single-choice',
  'basic',
  'weighted',
  'quadratic',
  'ranked-choice',
]

export default function VotingModal({
  modalIsOpen,
  closeModal,
  address,
  spaceId,
  spaceHideAbstain,
  proposal,
  project,
  votesOfProposal,
  refetch,
}: VotingProps) {
  // state
  const [choice, setChoice] = useState()
  const [reason, setReason] = useState('')
  const chain = DEFAULT_CHAIN_V5
  const chainSlug = getChainSlug(chain)
  const proposalTableContract = useContract({
    address: PROPOSALS_ADDRESSES[chainSlug],
    chain: chain,
    abi: ProposalsABI.abi as any,
  })

  proposal.choices = ['Yes', 'No', 'Abstain'] // could make this dynamic in the future
  console.log('proposal', proposal)
  // external
  //const { data: _vp } = useVotingPower(address, spaceId, proposal?.id || '')
  const {
    totalLockedMooney: lockedMooneyAmount,
    nextUnlockDate: lockedMooneyUnlockDate,
    breakdown: lockedMooneyBreakdown,
    isLoading: isLoadingLockedMooney,
  } = useTotalLockedMooney(address)
  const { totalVMOONEY, isLoading: isLoadingVMOONEY } = useTotalVMOONEY(
    address,
    lockedMooneyBreakdown
  )
  const vp = totalVMOONEY || 0
  console.log('vp')
  console.log(vp)

  const { trigger } = useVote(
    spaceId,
    proposal?.id,
    proposal?.type,
    choice as any,
    reason,
    proposal.privacy
  )
  const handleSubmit = async () => {
    const totalPercentage = Object.values(distribution).reduce(
      (sum, value) => sum + value,
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
      let receipt
      if (edit) {
        const transaction = prepareContractCall({
          contract: distributionTableContract,
          method: 'updateTableCol' as string,
          params: [project.mdp, JSON.stringify(distribution)],
        })
        receipt = await sendAndConfirmTransaction({
          transaction,
          account,
        })
      } else {
        const transaction = prepareContractCall({
          contract: distributionTableContract,
          method: 'insertIntoTable' as string,
          params: [project.mdp, JSON.stringify(distribution)],
        })
        receipt = await sendAndConfirmTransaction({
          transaction,
          account,
        })
      }
    } catch (error) {
      console.error('Error submitting distribution:', error)
      toast.error('Error submitting distribution. Please try again.', {
        style: toastStyle,
      })
    }
  }

  if (proposal === undefined) {
    return <div className="hidden">Proposal not selected</div>
  }

  const hideAbstain = spaceHideAbstain && proposal.type === 'basic'
  const totalScore = hideAbstain
    ? proposal.scores_total - (proposal?.scores[2] ?? 0)
    : proposal.scores_total
  const symbol = 'VP' // VP stands for Voting Power

  const renderVoteButton = () => {
    let canVote = false
    let label = 'Close'
    console.log('choice', choice)

    if (address == '') {
      label = 'Wallet not connected'
    } else if (!SUPPORTED_VOTING_TYPES.includes(proposal.type)) {
      label = 'Not supported'
    } else if (choice === undefined) {
      label = 'You need to select a choice'
    } else if (vp > 0) {
      label = 'Submit vote'
      canVote = true
    } else {
      label = 'Close'
    }
    console.log('canVote', canVote)

    return (
      <button
        type="button"
        disabled={!canVote}
        onClick={canVote ? handleSubmit : closeModal}
        className="w-full bg-gradient-to-r from-blue-500 to-purple-600 hover:from-blue-600 hover:to-purple-700 disabled:from-gray-600 disabled:to-gray-700 disabled:cursor-not-allowed text-white py-3 px-4 rounded-lg font-semibold transition-all duration-200 transform hover:scale-105 disabled:hover:scale-100 shadow-lg disabled:opacity-50"
      >
        {label}
      </button>
    )
  }

  return (
    <Transition.Root show={modalIsOpen} as={Fragment}>
      <Dialog
        as="div"
        className="relative z-50"
        open={modalIsOpen}
        onClose={closeModal}
      >
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
                        <div>
                          <h2 className="text-lg font-bold text-white">
                            Vote on Proposal
                          </h2>
                          <p className="text-gray-300 text-xs">
                            Cast your vote and make your voice heard
                          </p>
                        </div>
                      </div>

                      {/* Proposal Title */}
                      <div className="bg-black/20 rounded-lg p-3 mb-4 border border-white/5">
                        <h3 className="text-base font-semibold text-white">
                          {proposal.title}
                        </h3>
                      </div>

                      {/* Proposal Stats */}
                      <section
                        aria-labelledby="information-heading"
                        className="mb-4"
                      >
                        <h3 id="information-heading" className="sr-only">
                          Proposal information
                        </h3>

                        <div className="bg-black/20 rounded-lg p-3 border border-white/5">
                          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 text-center">
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
                                <span className="hidden sm:inline">
                                  Total Votes
                                </span>
                                <span className="sm:hidden">Votes</span>
                              </p>
                              <p className="text-lg font-bold text-white">
                                {votesOfProposal.votes.length}
                              </p>
                            </div>

                            <div className="hidden sm:block">
                              <p className="text-gray-300 text-xs font-medium uppercase tracking-wide whitespace-nowrap">
                                Total Voting Power
                              </p>
                              <p className="text-lg font-bold text-white">
                                {formatNumberUSStyle(totalScore, true)}
                              </p>
                            </div>
                          </div>
                        </div>
                      </section>

                      {/* Voting Section */}
                      <section
                        aria-labelledby="options-heading"
                        className="space-y-4"
                      >
                        <h3 id="options-heading" className="sr-only">
                          Voting options
                        </h3>

                        <form className="space-y-4">
                          {/* Option selector */}
                          <div>
                            <h4 className="text-gray-300 font-medium text-xs uppercase tracking-wide mb-3">
                              Select Your Choice
                            </h4>
                            <p> {proposal.type}</p>
                            {(proposal.type == 'single-choice' ||
                              proposal.type == 'basic') && (
                              <BasicChoiceSelector
                                value={choice}
                                setValue={setChoice}
                                choices={proposal.choices}
                              />
                            )}
                            {proposal.type == 'weighted' ||
                              (proposal.type == 'quadratic' && (
                                <WeightedChoiceSelector
                                  value={choice}
                                  setValue={setChoice}
                                  choices={proposal.choices}
                                />
                              ))}
                            {proposal.type == 'ranked-choice' && (
                              <RankedChoiceSelector
                                value={choice || []}
                                setValue={setChoice}
                                choices={proposal.choices}
                              />
                            )}
                          </div>

                          {/* Votes under shutter mode won't have reason */}
                          {proposal.privacy !== 'shutter' && (
                            <div>
                              <label
                                htmlFor="comment"
                                className="block text-gray-300 font-medium text-xs uppercase tracking-wide mb-2"
                              >
                                Reason (Optional)
                              </label>
                              <div>
                                <textarea
                                  rows={2}
                                  maxLength={140}
                                  name="reason"
                                  id="reason"
                                  placeholder="Share your reasoning for this vote..."
                                  className="w-full bg-black/20 border border-white/10 rounded-lg p-3 text-sm text-white placeholder-gray-400 hover:bg-black/30 hover:border-white/20 transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500/50 resize-none"
                                  value={reason}
                                  onChange={(e) => setReason(e.target.value)}
                                />
                                <div className="mt-1 text-right">
                                  <span className="text-xs text-gray-400">
                                    {reason.length}/140 characters
                                  </span>
                                </div>
                              </div>
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

function BasicChoiceSelector({ value, setValue, choices }: SelectorProps) {
  return (
    <RadioGroup value={value} onChange={setValue}>
      <div className="grid grid-cols-3 gap-3">
        {choices.map((choice, index) => (
          <RadioGroup.Option
            as="div"
            key={choice}
            value={index + 1}
            className={({ active, checked }) =>
              classNames(
                'relative block cursor-pointer rounded-lg p-3 transition-all duration-200 text-center',
                checked
                  ? 'bg-blue-500/20 border-2 border-blue-500/50 shadow-lg'
                  : 'bg-black/20 border border-white/10 hover:bg-black/30 hover:border-white/20',
                active ? 'ring-2 ring-blue-500/50' : ''
              )
            }
          >
            {({ active, checked }) => (
              <>
                <div className="flex items-center justify-center">
                  <RadioGroup.Label
                    as="p"
                    className="text-sm font-medium text-white"
                  >
                    {choice}
                  </RadioGroup.Label>
                </div>
              </>
            )}
          </RadioGroup.Option>
        ))}
      </div>
    </RadioGroup>
  )
}

function WeightedChoiceSelector({
  value,
  setValue,
  choices,
}: Omit<SelectorProps, 'value'> & {
  value: { [key: string]: number } | undefined
}) {
  console.log('choice selector')
  const { register, getValues, watch } = useForm()

  useEffect(() => {
    // sync form state
    const subscription = watch((_) => {
      const values = getValues()
      const newValue: { [key: string]: any } = {}
      // remove empty values
      for (const key in values) {
        const val = values[key]
        if (!isNaN(val) && val > 0) {
          newValue[key] = val
        }
      }
      setValue(newValue)
    })

    return () => subscription.unsubscribe()
  }, [watch])

  const totalUnits = Object.values(value ?? {}).reduce((a, b) => a + b, 0)

  return (
    <div className="space-y-3">
      {choices.map((choice, index) => (
        <div
          key={choice}
          className="bg-black/20 border border-white/10 rounded-lg p-4 hover:bg-black/30 hover:border-white/20 transition-all duration-200"
        >
          <div className="flex items-center gap-4">
            <label className="flex-1 text-white font-medium">{choice}</label>
            <input
              className="w-24 bg-black/30 border border-white/20 rounded-lg px-3 py-2 text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500/50 transition-all duration-200"
              type="number"
              placeholder="0"
              min={0}
              step={1}
              {...register((index + 1).toString(), {
                shouldUnregister: true,
                valueAsNumber: true,
              })}
            />
            <span className="w-16 text-right text-gray-300 text-sm">
              {isNaN(getValues((index + 1).toString())) || totalUnits == 0
                ? '0%'
                : `${Math.round(
                    (getValues((index + 1).toString()) / totalUnits) * 100
                  )}%`}
            </span>
          </div>
        </div>
      ))}
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
                    <span className="text-white text-sm font-bold">
                      {orderNumber}
                    </span>
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
                  <XMarkIcon
                    className="h-5 w-5 text-red-400"
                    aria-hidden="true"
                  />
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
