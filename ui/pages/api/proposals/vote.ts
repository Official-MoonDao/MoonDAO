import ProjectTableABI from 'const/abis/ProjectTable.json'
import { runQuadraticVoting } from '@/lib/utils/rewards'
import ProposalsABI from 'const/abis/Proposals.json'
import ProjectTeamCreatorABI from 'const/abis/ProjectTeamCreator.json'
import queryTable from '@/lib/tableland/queryTable'
import {
  PROJECT_TABLE_NAMES,
  PROPOSALS_TABLE_NAMES,
  PROPOSALS_ADDRESSES,
  DEFAULT_CHAIN_V5,
  PROJECT_CREATOR_ADDRESSES,
  PROJECT_TABLE_ADDRESSES,
} from 'const/config'
import { ethers } from 'ethers'
import { getRelativeQuarter } from 'lib/utils/dates'
import { fetchTotalVMOONEYs } from '@/lib/tokens/hooks/useTotalVMOONEY'
import { rateLimit } from 'middleware/rateLimit'
import withMiddleware from 'middleware/withMiddleware'
import { NextApiRequest, NextApiResponse } from 'next'
import {
  readContract,
  prepareContractCall,
  sendAndConfirmTransaction,
  sendTransaction,
  getContract,
} from 'thirdweb'
import { createHSMWallet } from '@/lib/google/hsm-signer'
import { pinBlobOrFile } from '@/lib/ipfs/pinBlobOrFile'
import { getChainSlug } from '@/lib/thirdweb/chain'
import { serverClient } from '@/lib/thirdweb/client'

// Configuration constants
const chain = DEFAULT_CHAIN_V5
const chainSlug = getChainSlug(chain)

async function POST(req: NextApiRequest, res: NextApiResponse) {
  const { mdp } = req.body

  const voteStatement = `SELECT * FROM ${PROPOSALS_TABLE_NAMES[chainSlug]} WHERE MDP = ${mdp}`
  const votes = (await queryTable(chain, voteStatement)) as DistributionVote[]
  const voteAddresses = votes.map((pv) => pv.address)
  const vMOONEYs = await fetchTotalVMOONEYs(voteAddresses)
  const addressToQuadraticVotingPower = Object.fromEntries(
    voteAddresses.map((address, index) => [address, Math.sqrt(vMOONEYs[index])])
  )
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
  const projectId = projects[0].id
  const currentTimestamp: number = Math.floor(Date.now() / 1000)
  // FIXME how long is the voting period? at least 5 days but in practice how long?
  const votingPeriodClosedTimestamp =
    parseInt(tempCheckApprovedTimestamp) + 60 * 60 * 24 * 7
  if (currentTimestamp <= votingPeriodClosedTimestamp) {
    return res.status(400).json({
      error: 'Voting period has not ended.',
    })
  }
  const SUM_TO_ONE_HUNDRED = 100
  const outcome = runQuadraticVoting(
    votes,
    addressToQuadraticVotingPower,
    SUM_TO_ONE_HUNDRED
  )
  if (outcome[1] >= 66.6) {
    const account = await createHSMWallet()
    const transaction = prepareContractCall({
      contract: projectTableContract,
      method: 'updateTableCol',
      params: [projectId, 'active', 1],
    })
    //const receipt = await sendAndConfirmTransaction({
    //transaction,
    //account,
    //})
    res.status(200).json({
      url: 'https://moondao.com/projects/' + mdp,
      proposalId: mdp,
      passed: true,
    })
  } else {
    res.status(200).json({
      url: 'https://moondao.com/projects/' + mdp,
      proposalId: mdp,
      passed: false,
    })
  }
}
export default withMiddleware(POST, rateLimit)
