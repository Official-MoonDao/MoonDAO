import ProposalsABI from 'const/abis/Proposals.json'
import ProjectTableABI from 'const/abis/ProjectTable.json'
import {
  PROJECT_TABLE_NAMES,
  PROPOSALS_ADDRESSES,
  PROPOSALS_TABLE_NAMES,
  DEFAULT_CHAIN_V5,
  NEXT_QUARTER_BUDGET_ETH,
  CITIZEN_TABLE_NAMES,
  PROJECT_TABLE_ADDRESSES,
} from 'const/config'
import { getCurrentQuarter, getThirdThursdayOfQuarterTimestamp } from 'lib/utils/dates'
import { rateLimit } from 'middleware/rateLimit'
import withMiddleware from 'middleware/withMiddleware'
import { NextApiRequest, NextApiResponse } from 'next'
import { readContract, prepareContractCall, sendAndConfirmTransaction, getContract } from 'thirdweb'
import { PROJECT_ACTIVE, PROJECT_VOTE_FAILED } from '@/lib/nance/types'
import queryTable from '@/lib/tableland/queryTable'
import { DistributionVote } from '@/lib/tableland/types'
import { getChainSlug } from '@/lib/thirdweb/chain'
import { serverClient } from '@/lib/thirdweb/client'
import { fetchTotalVMOONEYs } from '@/lib/tokens/hooks/useTotalVMOONEY'
import { runQuadraticVoting, getApprovedProjects } from '@/lib/utils/rewards'
import { createHSMWallet } from '@/lib/google/hsm-signer'

// Configuration constants
const chain = DEFAULT_CHAIN_V5
const chainSlug = getChainSlug(chain)

interface VotingResultItem {
  projectId: string
  percentage: number
  projectInfo: { name: string; MDP: number } | undefined
  approved: boolean
  budget: number
}

async function logVotingResults(
  passedProjects: any[],
  outcome: { [projectId: string]: number },
  projectIdToApproved: { [projectId: string]: boolean },
  ethBudgets: { [projectId: string]: number },
  votes: DistributionVote[],
  addressToQuadraticVotingPower: { [address: string]: number },
  voteAddresses: string[],
  quarterBudget: number
): Promise<void> {
  // Create a map of project id to project info for easy lookup
  const projectIdToInfo = Object.fromEntries(
    passedProjects.map((p: any) => [p.id, { name: p.name, MDP: p.MDP }])
  )

  // Sort by vote percentage (highest to lowest)
  const sortedOutcome: VotingResultItem[] = Object.entries(outcome)
    .sort(([, a], [, b]) => (b as number) - (a as number))
    .map(([projectId, percentage]) => ({
      projectId,
      percentage: percentage as number,
      projectInfo: projectIdToInfo[projectId],
      approved: projectIdToApproved[projectId],
      budget: ethBudgets[projectId] || 0,
    }))

  // Log voting results table
  console.log('\n╔════════════════════════════════════════════════════════════════════════════════╗')
  console.log('║                              VOTING RESULTS                                    ║')
  console.log('╠════════════════════════════════════════════════════════════════════════════════╣')
  console.log('║  Rank │ Vote %  │ Status │ Budget   │ MDP │ Project Name                       ║')
  console.log('╠═══════╪═════════╪════════╪══════════╪═════╪════════════════════════════════════╣')

  sortedOutcome.forEach((item, index) => {
    const rank = String(index + 1).padStart(2, ' ')
    const pct = item.percentage.toFixed(2).padStart(6, ' ')
    const status = item.approved ? '✅ PASS' : '❌ FAIL'
    const budget = `${item.budget} ETH`.padEnd(8, ' ')
    const mdp = String(item.projectInfo?.MDP || '?').padStart(3, ' ')
    const name = (item.projectInfo?.name || `Unknown (ID: ${item.projectId})`).slice(0, 34)
    console.log(`║   ${rank}  │ ${pct}% │ ${status} │ ${budget} │ ${mdp} │ ${name.padEnd(34, ' ')} ║`)
  })

  // Calculate and log summary
  const approvedProjects = sortedOutcome.filter((item) => item.approved)
  const rejectedProjects = sortedOutcome.filter((item) => !item.approved)
  const totalApprovedBudget = approvedProjects.reduce((sum, item) => sum + item.budget, 0)
  const totalRejectedBudget = rejectedProjects.reduce((sum, item) => sum + item.budget, 0)

  console.log('╠════════════════════════════════════════════════════════════════════════════════╣')
  console.log('║                                  SUMMARY                                       ║')
  console.log('╠════════════════════════════════════════════════════════════════════════════════╣')
  console.log(`║  ✅ Approved: ${approvedProjects.length} projects │ Total Budget: ${totalApprovedBudget.toFixed(2)} ETH`.padEnd(81, ' ') + '║')
  console.log(`║  ❌ Rejected: ${rejectedProjects.length} projects │ Total Budget: ${totalRejectedBudget.toFixed(2)} ETH`.padEnd(81, ' ') + '║')
  console.log(`║  📊 Quarter Budget: ${quarterBudget} ETH │ Remaining: ${(quarterBudget - totalApprovedBudget).toFixed(2)} ETH`.padEnd(81, ' ') + '║')
  console.log('╚════════════════════════════════════════════════════════════════════════════════╝\n')

  // Fetch citizen names for all voters
  let addressToCitizenName: { [address: string]: string } = {}
  if (voteAddresses.length > 0) {
    const citizenStatement = `SELECT owner, name FROM ${CITIZEN_TABLE_NAMES[chainSlug]} WHERE owner IN (${voteAddresses.map((addr) => `'${addr.toLowerCase()}'`).join(',')})`
    try {
      const citizens = await queryTable(chain, citizenStatement)
      addressToCitizenName = Object.fromEntries(
        citizens.map((c: any) => [c.owner.toLowerCase(), c.name])
      )
    } catch (err) {
      console.log('Could not fetch citizen names:', err)
    }
  }

  // Log individual votes table
  console.log('╔══════════════════════════════════════════════════════════════════════════════════════════════════════╗')
  console.log('║                                    INDIVIDUAL VOTES                                                  ║')
  console.log('╠══════════════════════════════════════════════════════════════════════════════════════════════════════╣')

  const projectIds = sortedOutcome.map((item) => item.projectId)
  const projectHeaders = projectIds.map((id) => {
    const info = projectIdToInfo[id]
    const name = info?.name || `ID:${id}`
    return name.slice(0, 8).padEnd(8, ' ')
  })

  const headerRow = '║ Voter'.padEnd(22, ' ') + '│   Power  │ ' + projectHeaders.join(' │ ') + ' ║'
  console.log(headerRow)
  console.log('╠' + '═'.repeat(21) + '╪══════════╪' + projectIds.map(() => '══════════').join('╪') + '╣')

  votes.forEach((vote: any) => {
    const citizenName = addressToCitizenName[vote.address.toLowerCase()]
    const voterName = citizenName
      ? citizenName.slice(0, 18).padEnd(18, ' ')
      : `${vote.address.slice(0, 6)}...${vote.address.slice(-4)}`.padEnd(18, ' ')

    const votingPower = addressToQuadraticVotingPower[vote.address] || 0
    const powerStr = votingPower.toFixed(2).padStart(8, ' ')

    const distribution =
      typeof vote.distribution === 'string'
        ? JSON.parse(vote.distribution)
        : vote.distribution || {}

    const voteValues = projectIds.map((projectId) => {
      const voteAmount = distribution[projectId] || 0
      return String(voteAmount).padStart(8, ' ')
    })

    console.log(`║ ${voterName} │ ${powerStr} │ ${voteValues.join(' │ ')} ║`)
  })

  console.log('╚' + '═'.repeat(21) + '╧══════════╧' + projectIds.map(() => '══════════').join('╧') + '╝\n')
}

// Tally votes for projects and set approved projects to active
async function POST(req: NextApiRequest, res: NextApiResponse) {
  // Use quarter/year from request body if provided, otherwise fall back to current quarter
  const currentQuarter = getCurrentQuarter()
  const quarter = req.body?.quarter || currentQuarter.quarter
  const year = req.body?.year || currentQuarter.year
  
  console.log(`[vote tally] Starting tally for Q${quarter} ${year}`)
  
  const voteStatement = `SELECT * FROM ${PROPOSALS_TABLE_NAMES[chainSlug]} WHERE quarter = ${quarter} AND year = ${year}`
  const votes = (await queryTable(chain, voteStatement)) as DistributionVote[]
  const voteAddresses = votes.map((pv) => pv.address)

  console.log(`[vote tally] Found ${votes.length} votes from ${voteAddresses.length} addresses`)

  if (votes.length === 0) {
    return res.status(400).json({
      error: 'No votes found for this quarter.',
    })
  }

  const proposalContract = getContract({
    client: serverClient,
    address: PROPOSALS_ADDRESSES[chainSlug],
    abi: ProposalsABI.abi as any,
    chain: chain,
  })
  
  try {
    const tableId = await readContract({
      contract: proposalContract,
      method: 'getTableId' as string,
      params: [],
    })
  } catch (testError) {
    console.error('Contract connectivity FAILED:', testError)
    return res.status(500).json({
      error: 'Failed to connect to Proposals contract',
      details: String(testError),
    })
  }
  const projectTableContract = getContract({
    client: serverClient,
    address: PROJECT_TABLE_ADDRESSES[chainSlug],
    abi: ProjectTableABI as any,
    chain: chain,
  })
  
  const projectStatement = `SELECT * FROM ${PROJECT_TABLE_NAMES[chainSlug]} WHERE QUARTER = ${quarter} AND YEAR = ${year}`
  const projects = await queryTable(chain, projectStatement)
  const passedProjects: any[] = []
  
  // Helper function to read contract with retry logic
  async function readContractWithRetry<T>(
    contract: any,
    method: string,
    params: any[],
    maxRetries = 3,
    baseDelayMs = 500
  ): Promise<T> {
    let lastError: any
    for (let attempt = 0; attempt < maxRetries; attempt++) {
      try {
        const result = await readContract({
          contract,
          method,
          params,
        })
        return result as T
      } catch (error) {
        lastError = error
        // Only retry on buffer/decode errors (RPC returned undefined/null)
        const isRetryableError = error instanceof TypeError && 
          String(error.message).includes('buffer')
        if (!isRetryableError || attempt === maxRetries - 1) {
          throw error
        }
        // Exponential backoff: 500ms, 1000ms, 2000ms
        const delay = baseDelayMs * Math.pow(2, attempt)
        await new Promise(resolve => setTimeout(resolve, delay))
      }
    }
    throw lastError
  }

  // Process projects sequentially to avoid rate limiting
  for (const project of projects) {
    if (project.MDP === undefined || project.MDP === null) {
      console.log('Skipping project with no MDP:', project.id, project.name)
      continue
    }
    try {
      const tempCheckApproved = await readContractWithRetry<boolean>(
        proposalContract,
        'tempCheckApproved',
        [project.MDP],
      )
      if (tempCheckApproved) {
        passedProjects.push(project)
      }
    } catch (error) {
      console.error('Error checking tempCheckApproved for project:', {
        projectId: project.id,
        projectName: project.name,
        MDP: project.MDP,
        contractAddress: PROPOSALS_ADDRESSES[chainSlug],
        chainSlug,
        error,
      })
    }
  }

  console.log(`[vote tally] ${passedProjects.length} projects passed temp check out of ${projects.length} total`)

  if (passedProjects.length === 0) {
    return res.status(400).json({
      error: 'No projects passed temp check.',
    })
  }

  const ethBudgets = Object.fromEntries(
    await Promise.all(
      passedProjects.map(async (project: any) => {
        try {
          const proposalResponse = await fetch(project.proposalIPFS)
          const proposal = await proposalResponse.json()
          let budget = 0
          if (proposal.budget) {
            proposal.budget.forEach((item: any) => {
              budget += item.token === 'ETH' ? Number(item.amount) : 0
            })
          }
          return [project.id, budget]
        } catch (error) {
          console.error(`[vote tally] Failed to fetch budget for project ${project.id}:`, error)
          return [project.id, 0]
        }
      })
    )
  )

  console.log('[vote tally] ETH budgets:', ethBudgets)

  const voteOpenTimestamp: number = Math.floor(
    getThirdThursdayOfQuarterTimestamp(quarter, year) / 1000
  )
  const voteCloseTimestamp: number = voteOpenTimestamp + 60 * 60 * 24 * 5 // 5 days after vote opens
  const currentTimestamp: number = Math.floor(Date.now() / 1000)

  console.log(`[vote tally] Vote open: ${new Date(voteOpenTimestamp * 1000).toISOString()}, close: ${new Date(voteCloseTimestamp * 1000).toISOString()}, now: ${new Date(currentTimestamp * 1000).toISOString()}`)

  // Don't require voting period for testnet
  if (process.env.NEXT_PUBLIC_CHAIN === 'mainnet' && currentTimestamp <= voteCloseTimestamp) {
    return res.status(400).json({
      error: 'Voting period has not ended.',
    })
  }
  const vMOONEYs = await fetchTotalVMOONEYs(voteAddresses, voteCloseTimestamp)

  console.log(`[vote tally] vMOONEY balances fetched: ${vMOONEYs.length} values for ${voteAddresses.length} addresses`)

  // Safety check: ensure vMOONEY balances were fetched correctly
  if (vMOONEYs.length === 0) {
    return res.status(500).json({
      error: 'Failed to fetch vMOONEY balances. Cannot proceed with tally.',
    })
  }

  const addressToQuadraticVotingPower: { [address: string]: number } = Object.fromEntries(
    voteAddresses.map((address, index) => {
      const vMOONEY = vMOONEYs[index] || 0
      const power = isNaN(vMOONEY) ? 0 : Math.sqrt(vMOONEY)
      return [address.toLowerCase(), power]
    })
  )

  const totalVotingPower = Object.values(addressToQuadraticVotingPower).reduce((sum, v) => sum + v, 0)
  console.log(`[vote tally] Total quadratic voting power: ${totalVotingPower}`)

  if (totalVotingPower === 0) {
    return res.status(500).json({
      error: 'Total voting power is 0. All voters may have 0 vMOONEY. Cannot proceed with tally.',
      vMOONEYs,
      voteAddresses,
    })
  }

  const SUM_TO_ONE_HUNDRED = 100
  const outcome = runQuadraticVoting(votes, addressToQuadraticVotingPower, SUM_TO_ONE_HUNDRED)

  console.log('[vote tally] Vote outcome:', outcome)

  if (Object.keys(outcome).length === 0) {
    return res.status(500).json({
      error: 'Vote outcome is empty. Something went wrong with the quadratic voting calculation.',
    })
  }

  if (req.method === 'GET') {
    return res.status(200).json({
      outcome,
    })
  }
  const projectIdToApproved = getApprovedProjects(passedProjects, outcome, ethBudgets, NEXT_QUARTER_BUDGET_ETH)

  console.log('[vote tally] Approval results:', projectIdToApproved)

  await logVotingResults(
    passedProjects,
    outcome,
    projectIdToApproved,
    ethBudgets,
    votes,
    addressToQuadraticVotingPower,
    voteAddresses,
    NEXT_QUARTER_BUDGET_ETH
  )

  const account = await createHSMWallet()
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
    console.log(`[vote tally] Updated project ${projectId}: active=${approved ? PROJECT_ACTIVE : PROJECT_VOTE_FAILED} (tx: ${receipt.transactionHash})`)
  }
  
  return res.status(200).json({
    url: 'https://moondao.com/projects',
    outcome: outcome,
    approved: projectIdToApproved,
  })
}
export default withMiddleware(POST, rateLimit)