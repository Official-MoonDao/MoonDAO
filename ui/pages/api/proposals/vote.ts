import Safe from '@safe-global/protocol-kit'
import ProposalsABI from 'const/abis/Proposals.json'
import ProjectABI from 'const/abis/Project.json'
import ProjectTableABI from 'const/abis/ProjectTable.json'
import {
  PROJECT_TABLE_NAMES,
  PROJECT_ADDRESSES,
  PROPOSALS_ADDRESSES,
  PROPOSALS_TABLE_NAMES,
  DEFAULT_CHAIN_V5,
  NEXT_QUARTER_BUDGET_USD,
  CITIZEN_TABLE_NAMES,
  PROJECT_TABLE_ADDRESSES,
} from 'const/config'
import { getCurrentQuarter, getThirdThursdayOfQuarterTimestamp } from 'lib/utils/dates'
import { rateLimit } from 'middleware/rateLimit'
import withMiddleware from 'middleware/withMiddleware'
import { NextApiRequest, NextApiResponse } from 'next'
import { readContract, prepareContractCall, sendAndConfirmTransaction, getContract } from 'thirdweb'
import { getRpcUrlForChain } from 'thirdweb/chains'
import { PROJECT_ACTIVE, PROJECT_VOTE_FAILED } from '@/lib/nance/types'
import queryTable from '@/lib/tableland/queryTable'
import { DistributionVote } from '@/lib/tableland/types'
import { getChainSlug } from '@/lib/thirdweb/chain'
import { serverClient } from '@/lib/thirdweb/client'
import { fetchTotalVMOONEYs } from '@/lib/tokens/hooks/useTotalVMOONEY'
import {
  runQuadraticVoting,
  runIterativeNormalization,
  getApprovedProjects,
} from '@/lib/utils/rewards'
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
  usdBudgets: { [projectId: string]: number },
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
      budget: usdBudgets[projectId] || 0,
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
    const budget = `$${item.budget}`.padEnd(8, ' ')
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
  console.log(`║  ✅ Approved: ${approvedProjects.length} projects │ Total Budget: $${totalApprovedBudget.toFixed(2)}`.padEnd(81, ' ') + '║')
  console.log(`║  ❌ Rejected: ${rejectedProjects.length} projects │ Total Budget: $${totalRejectedBudget.toFixed(2)}`.padEnd(81, ' ') + '║')
  console.log(`║  📊 Quarter Budget: $${quarterBudget} │ Remaining: $${(quarterBudget - totalApprovedBudget).toFixed(2)}`.padEnd(81, ' ') + '║')
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
    await readContract({
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

  // Filter out projects whose Safe has only 1 owner (team not properly configured)
  const projectContract = getContract({
    client: serverClient,
    address: PROJECT_ADDRESSES[chainSlug],
    abi: ProjectABI as any,
    chain: chain,
  })
  const rpcUrl = getRpcUrlForChain({ client: serverClient, chain })
  const skippedProjects: any[] = []

  for (let i = passedProjects.length - 1; i >= 0; i--) {
    const project = passedProjects[i]
    try {
      const safeAddress = await readContractWithRetry<string>(
        projectContract,
        'ownerOf',
        [project.id],
      )
      const safe = await Safe.init({ provider: rpcUrl, safeAddress })
      const owners = await safe.getOwners()
      if (owners.length < 2) {
        console.warn(
          `[vote tally] Skipping project MDP-${project.MDP} "${project.name}": Safe ${safeAddress} has only ${owners.length} owner(s) (team not configured)`
        )
        skippedProjects.push(project)
        passedProjects.splice(i, 1)
      }
    } catch (error) {
      console.error(
        `[vote tally] Error checking Safe owners for project MDP-${project.MDP} "${project.name}":`,
        error
      )
    }
  }

  if (skippedProjects.length > 0) {
    console.log(
      `[vote tally] ${skippedProjects.length} project(s) excluded due to single-owner Safe: ${skippedProjects.map((p) => `MDP-${p.MDP}`).join(', ')}`
    )
  }
  console.log(`[vote tally] ${passedProjects.length} projects eligible for vote after Safe owner check`)

  if (passedProjects.length === 0) {
    return res.status(400).json({
      error: 'No projects have a properly configured multisig (2+ Safe owners required).',
    })
  }

  const usdBudgets = Object.fromEntries(
    await Promise.all(
      passedProjects.map(async (project: any) => {
        try {
          const proposalResponse = await fetch(project.proposalIPFS)
          const proposal = await proposalResponse.json()
          let budget = 0
          if (proposal.budget) {
            proposal.budget.forEach((item: any) => {
              budget += item.token === 'USD' || item.token === 'USDC' || item.token === 'USDT' || item.token === 'DAI' ? Number(item.amount) : 0
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

  console.log('[vote tally] USD budgets:', usdBudgets)

  const voteOpenTimestamp: number = Math.floor(
    getThirdThursdayOfQuarterTimestamp(quarter, year).getTime() / 1000
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

  // Build project id -> author address so we exclude author's vote on their own proposal
  const projectIdToAuthorAddress: Record<string, string> = {}
  const missingAuthorProjectIds: string[] = []

  // Helper to resolve the author address for a single project.
  const processProject = async (project: any) => {
    if (!project.proposalIPFS) {
      // If there's no proposal IPFS, we cannot determine the author for this project.
      missingAuthorProjectIds.push(String(project.id))
      console.error(
        `Missing proposalIPFS for project ${project.id}; cannot resolve authorAddress.`
      )
      return
    }

    try {
      const fetchRes = await fetch(project.proposalIPFS)
      if (!fetchRes.ok) {
        missingAuthorProjectIds.push(String(project.id))
        console.error(
          `Non-OK response (${fetchRes.status}) when fetching proposal JSON for project ${project.id} (${project.proposalIPFS}).`
        )
        return
      }
      const json = await fetchRes.json()
      if (json && typeof json.authorAddress === 'string' && json.authorAddress.length > 0) {
        projectIdToAuthorAddress[String(project.id)] = json.authorAddress
      } else {
        missingAuthorProjectIds.push(String(project.id))
        console.error(
          `authorAddress missing or invalid in proposal JSON for project ${project.id} (${project.proposalIPFS}).`
        )
      }
    } catch (error) {
      missingAuthorProjectIds.push(String(project.id))
      console.error(
        `Failed to fetch/parse proposal JSON for project ${project.id} (${project.proposalIPFS}):`,
        error
      )
    }
  }

  // Process projects in small batches to avoid unbounded concurrent IPFS requests.
  const AUTHOR_FETCH_BATCH_SIZE = 5
  for (let i = 0; i < passedProjects.length; i += AUTHOR_FETCH_BATCH_SIZE) {
    const batch = passedProjects.slice(i, i + AUTHOR_FETCH_BATCH_SIZE)
    // Run each batch in parallel, but batches sequentially to limit peak concurrency.
    await Promise.all(batch.map((project: any) => processProject(project)))
  }
  if (missingAuthorProjectIds.length > 0) {
    console.warn(
      'Proceeding with vote close; missing author data for one or more projects.',
      { missingAuthorProjectIds }
    )
  }
  // Strip each voter's allocation to their own proposal (author cannot vote on own)
  type VoteRow = DistributionVote & { distribution?: string | Record<string, number>; quarter?: number; year?: number }
  const votesWithAuthorOwnExcluded: VoteRow[] = votes.map((v) => {
    const row = v as VoteRow
    const voterAddr = row.address?.toLowerCase()
    const raw = row.distribution
    const distribution: Record<string, number> = {}
    let parsedDistribution: Record<string, number> = {}
    if (typeof raw === 'string') {
      try {
        parsedDistribution = JSON.parse(raw)
      } catch {
        parsedDistribution = {}
      }
    } else if (raw && typeof raw === 'object') {
      parsedDistribution = raw as Record<string, number>
    }
    for (const [projectId, value] of Object.entries(parsedDistribution)) {
      const author = projectIdToAuthorAddress[projectId]?.toLowerCase()
      if (author && author === voterAddr) continue
      distribution[projectId] = Number(value)
    }
    return { ...row, distribution }
  })

  // Recalculate allocations using iterative normalization (fill author's project with column average, normalize rows to 100%)
  const [normalizedDistributions] = runIterativeNormalization(
    votesWithAuthorOwnExcluded,
    passedProjects
  )

  const SUM_TO_ONE_HUNDRED = 100
  const outcome = runQuadraticVoting(
    normalizedDistributions,
    addressToQuadraticVotingPower,
    SUM_TO_ONE_HUNDRED
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
  const projectIdToApproved = getApprovedProjects(passedProjects, outcome, usdBudgets, NEXT_QUARTER_BUDGET_USD)

  console.log('[vote tally] Approval results:', projectIdToApproved)

  await logVotingResults(
    passedProjects,
    outcome,
    projectIdToApproved,
    usdBudgets,
    normalizedDistributions,
    addressToQuadraticVotingPower,
    voteAddresses,
    NEXT_QUARTER_BUDGET_USD
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