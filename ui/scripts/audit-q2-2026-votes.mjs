/**
 * Q2 2026 Member-Vote audit dump.
 *
 * Pulls every raw vote from Tableland, fetches each voter's vMOONEY
 * balance at the vote-close timestamp (April 21, 2026) across all four
 * vMOONEY chains, applies the same author-self-vote stripping +
 * iterative normalization + quadratic voting that vote.ts /
 * computeMemberVoteOutcome.ts use, and prints the result in
 * audit-friendly form.
 *
 * Run from the `ui` package so ethers can resolve from node_modules:
 *
 *   cd ui && node scripts/audit-q2-2026-votes.mjs
 *
 * Or with the same env that npm scripts use:
 *
 *   npm --prefix ui run --silent _audit-q2  # if you want to wire it up
 *
 * Outputs four sections:
 *   1. Per-voter raw distributions (what was actually written to the
 *      Tableland Proposals_42161_157 table).
 *   2. Per-project voter contribution table: for each project, every
 *      voter's normalized weight × power, and the running sum that
 *      produces the final outcome %.
 *   3. Knapsack approval (top 50% by vote, capped at 3/4 budget).
 *   4. Q2 2026 budget breakdown (community / project pool / upfront /
 *      retroactive).
 */
import { ethers } from 'ethers'

const PROPOSALS_TABLE = 'Proposals_42161_157'
const PROJECT_TABLE = 'PROJECT_42161_122'
const QUARTER = 2
const YEAR = 2026
const VOTE_CLOSE_TIMESTAMP = 1776729600 // April 21, 2026 00:00 UTC
const NEXT_QUARTER_BUDGET_USD = 23409
const BUDGET_CAP = NEXT_QUARTER_BUDGET_USD * 0.75
const BUDGET_OVERRIDES_USD = { 245: 2700 }

// Per-MDP authoritative budgets, mirroring what the shared `extractUsdBudget`
// + `BUDGET_OVERRIDES_USD` produces. Filled out from a separate parse run so
// we don't have to re-fetch + re-parse every IPFS payload here. Kept in
// sync with the override map above.
const KNOWN_BUDGETS = {
  248: 3000, 235: 3600, 239: 4300, 240: 3955, 245: 2700,
  237: 4650, 241: 3815, 232: 4380, 231: 4682, 244: 2950,
}

const VMOONEY_TOKENS = [
  { name: 'arbitrum', addr: '0xB255c74F8576f18357cE6184DA033c6d93C71899', rpc: 'https://arb1.arbitrum.io/rpc' },
  { name: 'ethereum', addr: '0xCc71C80d803381FD6Ee984FAff408f8501DB1740', rpc: 'https://ethereum-rpc.publicnode.com' },
  { name: 'polygon',  addr: '0xe2d1BFef0A642B717d294711356b468ccE68BEa6', rpc: 'https://polygon-bor-rpc.publicnode.com' },
  { name: 'base',     addr: '0x7f8f1B45c3FD6Be4F467520Fc1Cf030d5CaBAcF5', rpc: 'https://base-rpc.publicnode.com' },
]
const VMOONEY_ABI = [
  'function balanceOf(address) view returns (uint256)',
  'function balanceOf(address, uint256) view returns (uint256)',
]

async function getTotalVMooney(address) {
  let total = 0
  for (const t of VMOONEY_TOKENS) {
    try {
      const provider = new ethers.providers.JsonRpcProvider(t.rpc)
      const c = new ethers.Contract(t.addr, VMOONEY_ABI, provider)
      const bal = await c['balanceOf(address,uint256)'](address, VOTE_CLOSE_TIMESTAMP)
      total += parseFloat(ethers.utils.formatEther(bal))
    } catch (e) {
      // Most addresses won't have a balance on most chains. We treat any
      // read failure as 0 (matching the production fetcher's fallback).
    }
  }
  return total
}

// =============================================================================
// Tally helpers (mirror lib/utils/rewards.ts)
// =============================================================================

function fillInZerosAndStripAuthors(distributions, projects, projectIdToAuthor) {
  const projectIds = projects.map((p) => String(p.id))
  return distributions.map((d) => {
    const voter = d.address.toLowerCase()
    return projectIds.map((pid) => {
      const author = projectIdToAuthor[pid]?.toLowerCase()
      if (author && author === voter) return NaN
      const v = d.distribution[pid]
      if (v == null || isNaN(Number(v))) return NaN
      return Number(v)
    })
  })
}

function runIterativeNormalization(matrix) {
  const numVoters = matrix.length
  if (numVoters === 0) return matrix
  const numProjects = matrix[0].length
  let votes = matrix.map((row) => row.slice())
  for (let loop = 0; loop < 20; loop++) {
    const projectAverages = []
    for (let j = 0; j < numProjects; j++) {
      let sum = 0, count = 0
      for (let i = 0; i < numVoters; i++) {
        if (!isNaN(votes[i][j])) { sum += votes[i][j]; count++ }
      }
      projectAverages.push(count === 0 ? 0 : sum / count)
    }
    const newVotes = votes.map((row) => row.slice())
    for (let j = 0; j < numProjects; j++) {
      for (let i = 0; i < numVoters; i++) {
        if (isNaN(newVotes[i][j])) newVotes[i][j] = projectAverages[j]
      }
    }
    const sums = newVotes.map((row) => row.reduce((a, b) => a + b, 0))
    for (let j = 0; j < numProjects; j++) {
      for (let i = 0; i < numVoters; i++) {
        if (!isNaN(votes[i][j])) {
          votes[i][j] = sums[i] === 0 ? 0 : (votes[i][j] / sums[i]) * 100
        }
      }
    }
  }
  // Final pass: surface backfilled values for the audit display.
  const projectAverages = []
  for (let j = 0; j < numProjects; j++) {
    let sum = 0, count = 0
    for (let i = 0; i < numVoters; i++) {
      if (!isNaN(votes[i][j])) { sum += votes[i][j]; count++ }
    }
    projectAverages.push(count === 0 ? 0 : sum / count)
  }
  const filled = votes.map((row) => row.slice())
  for (let j = 0; j < numProjects; j++) {
    for (let i = 0; i < numVoters; i++) {
      if (isNaN(filled[i][j])) filled[i][j] = projectAverages[j]
    }
  }
  return filled
}

function runQuadraticVoting(filledVotes, projects, voterPowers) {
  const numProjects = projects.length
  const totalPower = voterPowers.reduce((a, b) => a + b, 0)
  const outcome = {}
  for (let j = 0; j < numProjects; j++) {
    const pid = String(projects[j].id)
    let sum = 0
    for (let i = 0; i < voterPowers.length; i++) {
      sum += voterPowers[i] * filledVotes[i][j]
    }
    outcome[pid] = totalPower === 0 ? 0 : sum / totalPower
  }
  const outcomeSum = Object.values(outcome).reduce((a, b) => a + b, 0)
  if (outcomeSum > 0) {
    for (const pid in outcome) outcome[pid] = (outcome[pid] / outcomeSum) * 100
  }
  return outcome
}

// =============================================================================
// Main
// =============================================================================

;(async () => {
  console.log('Fetching votes from Tableland...')
  const votesRes = await fetch(
    `https://tableland.network/api/v1/query?statement=${encodeURIComponent(
      `SELECT * FROM ${PROPOSALS_TABLE} WHERE quarter=${QUARTER} AND year=${YEAR}`
    )}`
  )
  const rawVotes = await votesRes.json()

  console.log('Fetching senate-approved Q2 2026 projects...')
  const projRes = await fetch(
    `https://tableland.network/api/v1/query?statement=${encodeURIComponent(
      `SELECT id, MDP, name, proposalIPFS FROM ${PROJECT_TABLE} WHERE QUARTER=${QUARTER} AND YEAR=${YEAR}`
    )}`
  )
  const allProjects = await projRes.json()

  console.log('Cross-referencing live vote-results API for senate-approved subset...')
  const apiRes = await fetch('https://www.moondao.com/api/proposals/vote-results')
  const api = await apiRes.json()
  const passedIds = new Set(api.outcome.results.map((r) => String(r.projectId)))
  const passedProjects = allProjects.filter((p) => passedIds.has(String(p.id)))

  console.log('Resolving authors from IPFS payloads...')
  const projectIdToAuthor = {}
  const usdBudgets = {}
  for (const p of passedProjects) {
    try {
      const r = await fetch(p.proposalIPFS)
      const json = await r.json()
      if (json?.authorAddress) projectIdToAuthor[String(p.id)] = String(json.authorAddress)
    } catch {
      /* tolerated */
    }
    const override = BUDGET_OVERRIDES_USD[p.MDP]
    usdBudgets[String(p.id)] = override != null ? override : (KNOWN_BUDGETS[p.MDP] ?? 0)
  }

  console.log(`Fetching vMOONEY balances at ${new Date(VOTE_CLOSE_TIMESTAMP * 1000).toISOString()}...`)
  const voters = rawVotes.map((v) => ({
    address: v.address,
    distribution: typeof v.distribution === 'string' ? JSON.parse(v.distribution) : v.distribution,
  }))
  for (const v of voters) {
    v.vMOONEY = await getTotalVMooney(v.address)
    v.power = isNaN(v.vMOONEY) ? 0 : Math.sqrt(v.vMOONEY)
    process.stdout.write(`  ${v.address}: ${v.vMOONEY.toFixed(2)} vMOONEY → power=${v.power.toFixed(2)}\n`)
  }

  // ---------------------------------------------------------------------------
  // Section 1 — raw votes
  // ---------------------------------------------------------------------------
  console.log('\n========================================================================')
  console.log('SECTION 1 — RAW VOTES (as written to Proposals_42161_157)')
  console.log('========================================================================\n')
  for (const v of voters) {
    const lines = Object.entries(v.distribution)
      .sort(([a], [b]) => Number(a) - Number(b))
      .map(([pid, pct]) => {
        const proj = passedProjects.find((p) => String(p.id) === String(pid))
        const label = proj ? `MDP-${proj.MDP}` : `id ${pid}`
        return `    ${label.padEnd(8)} ${String(pct).padStart(5)}%`
      })
    const sumRaw = Object.values(v.distribution).reduce((a, b) => a + Number(b), 0)
    console.log(`${v.address}  vMOONEY=${v.vMOONEY.toFixed(2)}  √power=${v.power.toFixed(2)}  raw sum=${sumRaw}%`)
    console.log(lines.join('\n'))
    console.log('')
  }

  const matrix = fillInZerosAndStripAuthors(voters, passedProjects, projectIdToAuthor)
  const filled = runIterativeNormalization(matrix)
  const voterPowers = voters.map((v) => v.power)
  const outcome = runQuadraticVoting(filled, passedProjects, voterPowers)
  const sortedProjects = passedProjects
    .map((p) => ({ ...p, finalPct: outcome[String(p.id)] }))
    .sort((a, b) => b.finalPct - a.finalPct)

  // ---------------------------------------------------------------------------
  // Section 2 — per-project breakdown
  // ---------------------------------------------------------------------------
  console.log('========================================================================')
  console.log('SECTION 2 — PER-PROJECT VOTE BREAKDOWN')
  console.log('========================================================================')
  console.log('Each row = one voter\'s contribution to that project after author')
  console.log('self-vote stripping + 20-pass iterative normalization + quadratic')
  console.log('weighting (power = √vMOONEY). The per-project "weighted sum / total')
  console.log('weight" produces the unscaled outcome, which then gets renormalized')
  console.log('across all projects to sum to 100%.\n')

  const totalPower = voterPowers.reduce((a, b) => a + b, 0)
  for (const proj of sortedProjects) {
    const pid = String(proj.id)
    const author = projectIdToAuthor[pid]
    const isOverride = BUDGET_OVERRIDES_USD[proj.MDP] != null
    const projectIdx = passedProjects.findIndex((p) => String(p.id) === pid)
    let weightedSum = 0
    console.log(`MDP-${proj.MDP} — ${proj.name}`)
    console.log(`  project id ${pid}  •  author ${author ?? '(unknown)'}`)
    console.log(`  Final %: ${proj.finalPct.toFixed(4)}%   Budget: $${usdBudgets[pid].toLocaleString()}${isOverride ? ' (manual override)' : ''}`)
    console.log('  ┌─────────────────────────────────────────────┬──────────┬──────────┬──────────────┬──────────────┐')
    console.log('  │ Voter                                       │   raw %  │ √power   │ normalized % │ weighted     │')
    console.log('  ├─────────────────────────────────────────────┼──────────┼──────────┼──────────────┼──────────────┤')
    for (let i = 0; i < voters.length; i++) {
      const v = voters[i]
      const isAuthor = author && v.address.toLowerCase() === author.toLowerCase()
      const raw = v.distribution[pid]
      const norm = filled[i][projectIdx]
      const weighted = norm * v.power
      weightedSum += weighted
      const rawCell = isAuthor
        ? `(author) `
        : raw == null
        ? `   —     `
        : `  ${String(raw).padStart(3)}%   `
      console.log(
        `  │ ${v.address.padEnd(43)} │ ${rawCell}│ ${v.power.toFixed(2).padStart(8)} │ ${norm.toFixed(2).padStart(11)}% │ ${weighted.toFixed(2).padStart(12)} │`
      )
    }
    console.log('  └─────────────────────────────────────────────┴──────────┴──────────┴──────────────┴──────────────┘')
    console.log(`  Weighted sum:     ${weightedSum.toFixed(2)}`)
    console.log(`  Total power:      ${totalPower.toFixed(2)}`)
    console.log(`  Unscaled outcome: ${(weightedSum / totalPower).toFixed(4)}%   →  renormalized to ${proj.finalPct.toFixed(4)}%`)
    console.log('')
  }

  // ---------------------------------------------------------------------------
  // Section 3 — knapsack approval
  // ---------------------------------------------------------------------------
  console.log('========================================================================')
  console.log('SECTION 3 — KNAPSACK APPROVAL (top 50% by vote, ≤ 3/4 budget cap)')
  console.log('========================================================================')
  const numApproved = Math.min(Math.max(Math.ceil(passedProjects.length / 2), 3), passedProjects.length)
  console.log(`Quarterly pool: $${NEXT_QUARTER_BUDGET_USD.toLocaleString()}   3/4 cap: $${BUDGET_CAP.toFixed(2)}   count cap: ${numApproved}`)
  console.log('')
  console.log('Rank │ MDP  │ Vote %  │ Budget   │ Cumulative │ Decision')
  console.log('─────┼──────┼─────────┼──────────┼────────────┼─────────────────────')
  let cum = 0, count = 0
  for (let i = 0; i < sortedProjects.length; i++) {
    const p = sortedProjects[i]
    const budget = usdBudgets[String(p.id)] || 0
    const fitsCap = cum + budget <= BUDGET_CAP
    const fitsCount = count < numApproved
    const ok = fitsCap && fitsCount
    if (ok) { cum += budget; count++ }
    const decision = ok
      ? '✅ APPROVED'
      : !fitsCount
      ? '❌ count cap hit'
      : '❌ over budget cap'
    console.log(
      `  ${String(i + 1).padStart(2)} │ ${String(p.MDP).padStart(4)} │ ${p.finalPct.toFixed(2).padStart(5)}% │ $${String(budget.toLocaleString()).padStart(7)} │ $${cum.toLocaleString().padStart(8)}  │ ${decision}`
    )
  }
  console.log('')
  console.log(`Total upfront approved: $${cum.toLocaleString()}`)
  console.log(`Cap headroom remaining: $${(BUDGET_CAP - cum).toFixed(2)}`)
  console.log('')

  // ---------------------------------------------------------------------------
  // Section 4 — budget breakdown
  // ---------------------------------------------------------------------------
  const community = NEXT_QUARTER_BUDGET_USD * 0.10
  const projectPool = NEXT_QUARTER_BUDGET_USD * 0.90
  const retroactive = projectPool - cum
  console.log('========================================================================')
  console.log('SECTION 4 — Q2 2026 BUDGET BREAKDOWN')
  console.log('========================================================================')
  console.log(`  Total quarterly pool:                 $${NEXT_QUARTER_BUDGET_USD.toFixed(2)}`)
  console.log(`  − Community Circle (10%):             $${community.toFixed(2)}`)
  console.log(`  = Project pool (90%):                 $${projectPool.toFixed(2)}`)
  console.log(`    − Upfront (5 winners):              $${cum.toFixed(2)}`)
  console.log(`    = Retroactive Rewards:              $${retroactive.toFixed(2)}`)
})()
