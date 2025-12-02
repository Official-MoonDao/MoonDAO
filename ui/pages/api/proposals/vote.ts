import ProjectTableABI from 'const/abis/ProjectTable.json'
import { runQuadraticVoting } from '@/lib/utils/rewards'
import { DistributionVote } from '@/lib/tableland/types'
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
import { PROJECT_ACTIVE, PROJECT_VOTE_FAILED } from '@/lib/nance/types'

// Configuration constants
const chain = DEFAULT_CHAIN_V5
const chainSlug = getChainSlug(chain)

async function POST(req: NextApiRequest, res: NextApiResponse) {
  const { quarter, year } = req.body

  const voteStatement = `SELECT * FROM ${PROPOSALS_TABLE_NAMES[chainSlug]} WHERE QUARTER = ${quarter} AND YEAR = ${year}`
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
  //const tempCheckApproved = await readContract({
  //contract: proposalContract,
  //method: 'tempCheckApproved' as string,
  //params: [mdp],
  //})
  //const tempCheckApprovedTimestamp = await readContract({
  //contract: proposalContract,
  //method: 'tempCheckApprovedTimestamp' as string,
  //params: [mdp],
  //})
  //if (!tempCheckApproved) {
  //return res.status(400).json({
  //error: 'Proposal has not passed temp check.',
  //})
  //}
  const projectStatement = `SELECT * FROM ${PROJECT_TABLE_NAMES[chainSlug]} WHERE QUARTER = ${quarter} AND YEAR = ${year}`
  const projects = await queryTable(chain, projectStatement)
  const projectIds = projects.map((project) => project.id)
  //projects.forEach((project) => {
  //if (project.active === PROJECT_ACTIVE) {
  //return res.status(400).json({
  //error: 'Project has already passed.',
  //})
  //}
  //})
  const currentTimestamp: number = Math.floor(Date.now() / 1000)
  // FIXME how long is the voting period? at least 5 days but in practice how long?
  //const votingPeriodClosedTimestamp = parseInt(tempCheckApprovedTimestamp) + 60 * 60 * 24 * 7
  // Don't require voting period for testnet
  //if (
  //process.env.NEXT_PUBLIC_CHAIN === 'mainnet' &&
  //currentTimestamp <= votingPeriodClosedTimestamp
  //) {
  //return res.status(400).json({
  //error: 'Voting period has not ended.',
  //})
  //}
  // FIXME set timestamp appropriately
  const vMOONEYs = await fetchTotalVMOONEYs(voteAddresses, currentTimestamp)
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
  const sortedOutcome = Object.keys(outcome)
    .map((projectId) => {
      return { projectId: projectId, percent: outcome[projectId] }
    })
    .sort((a, b) => {
      return b.percent - a.percent
    })
  const account = await createHSMWallet()
  const numApprovedProjects = Math.min(Math.max(Math.ceil(projects.length / 2), 3), projects.length)
  for (let i = 0; i < numApprovedProjects; i++) {
    const projectId = sortedOutcome[i].projectId
    const transaction = prepareContractCall({
      contract: projectTableContract,
      method: 'updateTableCol',
      params: [projectId, 'active', active],
    })
    const receipt = await sendAndConfirmTransaction({
      transaction,
      account,
    })
  }
  res.status(200).json({
    url: 'https://moondao.com/projects',
    outcome: outcome,
  })
}
export default withMiddleware(POST, rateLimit)
