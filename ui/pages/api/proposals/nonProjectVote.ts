import ProjectTableABI from 'const/abis/ProjectTable.json'
import ProposalsABI from 'const/abis/Proposals.json'
import {
  PROJECT_TABLE_NAMES,
  NON_PROJECT_PROPOSAL_TABLE_NAMES,
  PROPOSALS_ADDRESSES,
  DEFAULT_CHAIN_V5,
  PROJECT_TABLE_ADDRESSES,
} from 'const/config'
import { rateLimit } from 'middleware/rateLimit'
import withMiddleware from 'middleware/withMiddleware'
import { NextApiRequest, NextApiResponse } from 'next'
import { readContract, prepareContractCall, sendAndConfirmTransaction, getContract } from 'thirdweb'
import { createHSMWallet } from '@/lib/google/hsm-signer'
import { PROJECT_ACTIVE, PROJECT_VOTE_FAILED } from '@/lib/nance/types'
import queryTable from '@/lib/tableland/queryTable'
import { DistributionVote } from '@/lib/tableland/types'
import { getChainSlug } from '@/lib/thirdweb/chain'
import { serverClient } from '@/lib/thirdweb/client'
import { fetchTotalVMOONEYs } from '@/lib/tokens/hooks/useTotalVMOONEY'
import { runQuadraticVoting } from '@/lib/utils/rewards'

// Configuration constants
const chain = DEFAULT_CHAIN_V5
const chainSlug = getChainSlug(chain)

// Tally votes for non project proposals and set approved proposals to active
async function POST(req: NextApiRequest, res: NextApiResponse) {
  const { mdp } = req.body

  const voteStatement = `SELECT * FROM ${NON_PROJECT_PROPOSAL_TABLE_NAMES[chainSlug]} WHERE MDP = ${mdp}`
  const votes = (await queryTable(chain, voteStatement)) as DistributionVote[]
  const voteAddresses = votes.map((pv) => pv.address)
  const proposalContract = getContract({
    client: serverClient,
    address: PROPOSALS_ADDRESSES[chainSlug],
    abi: ProposalsABI.abi as any,
    chain: chain,
  })
  const projectTableContract = getContract({
    client: serverClient,
    address: PROJECT_TABLE_ADDRESSES[chainSlug],
    abi: ProjectTableABI as any,
    chain: chain,
  })
  const tempCheckApproved = await readContract({
    contract: proposalContract,
    method: 'tempCheckApproved' as string,
    params: [mdp],
  })
  const tempCheckApprovedTimestamp = await readContract({
    contract: proposalContract,
    method: 'tempCheckApprovedTimestamp' as string,
    params: [mdp],
  })
  if (!tempCheckApproved) {
    return res.status(400).json({
      error: 'Proposal has not passed temp check.',
    })
  }
  const projectStatement = `SELECT * FROM ${PROJECT_TABLE_NAMES[chainSlug]} WHERE MDP = ${mdp}`
  const projects = await queryTable(chain, projectStatement)
  const project = projects[0]
  const projectId = project.id
  if (project.active === PROJECT_ACTIVE) {
    return res.status(400).json({
      error: 'Project has already passed.',
    })
  }
  const currentTimestamp: number = Math.floor(Date.now() / 1000)
  const votingPeriodClosedTimestamp = parseInt(tempCheckApprovedTimestamp) + 60 * 60 * 24 * 5
  // Don't require voting period for testnet
  if (
    process.env.NEXT_PUBLIC_CHAIN === 'mainnet' &&
    currentTimestamp <= votingPeriodClosedTimestamp
  ) {
    return res.status(400).json({
      error: 'Voting period has not ended.',
    })
  }
  const vMOONEYs = await fetchTotalVMOONEYs(voteAddresses, votingPeriodClosedTimestamp)
  const addressToQuadraticVotingPower = Object.fromEntries(
    voteAddresses.map((address, index) => [address, Math.sqrt(vMOONEYs[index])])
  )
  const SUM_TO_ONE_HUNDRED = 100
  const outcome = runQuadraticVoting(votes, addressToQuadraticVotingPower, SUM_TO_ONE_HUNDRED)
  if (req.method === 'GET') {
    res.status(200).json({
      outcome,
    })
  }
  const SUPER_MAJORITY = 66.6
  const passed = outcome[1] >= SUPER_MAJORITY
  const active = passed ? PROJECT_ACTIVE : PROJECT_VOTE_FAILED
  const account = await createHSMWallet()
  const transaction = prepareContractCall({
    contract: projectTableContract,
    method: 'updateTableCol',
    params: [projectId, 'active', active],
  })
  const receipt = await sendAndConfirmTransaction({
    transaction,
    account,
  })
  res.status(200).json({
    url: 'https://moondao.com/projects/' + mdp,
    proposalId: mdp,
    passed: passed,
  })
}
export default withMiddleware(POST, rateLimit)
