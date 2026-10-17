import { prepareContractCall, sendAndConfirmTransaction } from 'thirdweb'
import { trackProposalVote, type ProposalVoteSurface } from '@/lib/analytics/ga4'

export type SenateVoteSurface = Extract<ProposalVoteSurface, 'projects_list' | 'proposal_page'>

type VoteAccount = { address?: string } | null | undefined

/**
 * Confirms a senate temp-check vote, then records proposal_vote.
 * SenateVoteButtons (projects list) and SenateVote (proposal page) both use this
 * so a failed send never emits the event.
 */
export async function castSenateTempCheckVote(
  args: {
    account: VoteAccount
    proposalContract: unknown
    mdp: number
    pass: boolean
    surface: SenateVoteSurface
  },
  deps: {
    prepareContractCall?: typeof prepareContractCall
    sendAndConfirmTransaction?: (input: {
      transaction: unknown
      account: unknown
    }) => Promise<unknown>
  } = {}
): Promise<void> {
  if (!args.account) return
  const prepare = (deps.prepareContractCall ?? prepareContractCall) as (input: {
    contract: unknown
    method: string
    params: unknown[]
  }) => unknown
  const send = (deps.sendAndConfirmTransaction ?? sendAndConfirmTransaction) as (input: {
    transaction: unknown
    account: unknown
  }) => Promise<unknown>
  const transaction = prepare({
    contract: args.proposalContract,
    method: 'voteTempCheck',
    params: [args.mdp, args.pass],
  })
  await send({ transaction, account: args.account })
  trackProposalVote(args.mdp, { vote_stage: 'senate', surface: args.surface })
}
