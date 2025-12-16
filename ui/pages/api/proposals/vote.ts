import ProjectTableABI from 'const/abis/ProjectTable.json'
import ProposalsABI from 'const/abis/Proposals.json'
import {
  PROJECT_TABLE_NAMES,
  PROPOSALS_ADDRESSES,
  DEFAULT_CHAIN_V5,
  PROJECT_TABLE_ADDRESSES,
  ETH_BUDGET,
} from 'const/config'
import { getRelativeQuarter } from 'lib/utils/dates'
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
import { runQuadraticVoting, getApprovedProjects } from '@/lib/utils/rewards'

// Configuration constants
const chain = DEFAULT_CHAIN_V5
const chainSlug = getChainSlug(chain)

// Tally votes for projects and set approved projects to active
async function POST(req: NextApiRequest, res: NextApiResponse) {
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
  const { quarter, year } = getCurrentQuarter()
  const projectStatement = `SELECT * FROM ${PROJECT_TABLE_NAMES[chainSlug]} WHERE QUARTER = ${quarter} AND YEAR = ${year}`
  const projects = await queryTable(chain, projectStatement)
  const ethBudgets = Object.fromEntries(
    await Promise.all(
      projects.map(async (project: any) => {
        const proposalResponse = await fetch(project.proposalIPFS)
        const proposal = await proposalResponse.json()
        let budget = 0
        if (proposal.budget) {
          proposal.budget.forEach((item: any) => {
            budget += item.token === 'ETH' ? Number(item.amount) : 0
          })
        }
        return [project.id, budget]
      })
    )
  )
  const passedProjects = []
  projects.forEach(async (project) => {
    if (project.active === PROJECT_ACTIVE) {
      return res.status(400).json({
        error: 'Project has already passed.',
      })
    }
    const tempCheckApproved = await readContract({
      contract: proposalContract,
      method: 'tempCheckApproved' as string,
      params: [project.MDP],
    })
    if (tempCheckApproved) {
      passedProjects.push(project)
    }
  })
  const voteOpenTimestamp: number = Math.floor(
    getThirdThursdayOfQuarterTimestamp(quarter, year) / 1000
  )
  const voteCloseTimestamp: number = voteOpenTimestamp + 60 * 60 * 24 * 5 // 5 days after vote opens
  const currentTimestamp: number = Math.floor(Date.now() / 1000)
  // Don't require voting period for testnet
  if (process.env.NEXT_PUBLIC_CHAIN === 'mainnet' && currentTimestamp <= voteCloseTimestamp) {
    return res.status(400).json({
      error: 'Voting period has not ended.',
    })
  }
  const vMOONEYs = await fetchTotalVMOONEYs(voteAddresses, voteCloseTimestamp)
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
  const account = await createHSMWallet()
  const projectIdToApproved = getApprovedProjects(passedProjects, outcome, ethBudgets, ETH_BUDGET)
  for (const projectId in projectIdToApproved) {
    const approved = projectIdToApproved[projectId]
    const transaction = prepareContractCall({
      contract: projectTableContract,
      method: 'updateTableCol',
      params: [projectId, 'active', approved ? PROJECT_ACTIVE : PROJECT_VOTE_FAILED],
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
