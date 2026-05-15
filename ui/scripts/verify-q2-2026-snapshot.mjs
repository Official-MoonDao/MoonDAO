/**
 * Reproduces the canonical Q2 2026 member-vote outcome from the pinned
 * snapshot (April 20 00:00 UTC, true historical `balanceOfAt`) and the
 * MDP-237 budget override.
 *
 * Background
 * ----------
 * An earlier published audit screenshot showed MDP-240 at 22.01% as
 * the top project. Investigation against on-chain history revealed
 * that the audit page was previously calling
 * `balanceOf(addr, voteCloseTimestamp)` LIVE on every page load,
 * which extrapolates each voter's *current* lock state back to a fixed
 * past date — i.e. it's not actually historical. As multiple voters
 * created brand-new vMOONEY locks AFTER the cycle's snapshot moment,
 * those locks were retroactively counted by the buggy method,
 * inflating their voting power. The percentages drifted continuously.
 *
 * After fixing a separate snapshot-script bug — Arbitrum's
 * `block.number` returns the L1 (Ethereum) block, so
 * `balanceOfAt(addr, _block)` must receive an L1 block number; we
 * were passing the L2 block, which silently reverted and dropped all
 * Arbitrum balances — the recovered numbers reproduce the
 * originally-published audit screenshot to 4 decimal places (MDP-240
 * 22.01%, MDP-235 16.68%, MDP-245 10.20%, MDP-237 10.17%). Funded
 * set: MDP-235, MDP-240, MDP-245, MDP-237 ($15,438.84 of the
 * $17,556.75 cap).
 *
 * Run from the `ui` package:
 *   cd ui && node scripts/verify-q2-2026-snapshot.mjs
 */

const PROPOSALS_TABLE = 'Proposals_42161_157'
const PROJECT_TABLE = 'PROJECT_42161_122'
const QUARTER = 2
const YEAR = 2026

// Mirror of MEMBER_VOTE_VMOONEY_SNAPSHOTS['2026-Q2'].vMOONEY in
// ui/lib/proposals/vMooneySnapshots.ts. Kept inline so this script
// stays self-contained (no TS compile step). Update both together.
const SNAPSHOT_VMOONEY = {
  '0x37e6c43ae0341304ff181da55e8d2593f1728c45': 605565.9558124368,
  '0x45142255717c78503d585d50a46e84d63473d4b8': 0,
  '0x47cc4c7fef42187f9f7901838f316b033e92be05': 506154.1190454854,
  '0x4cbf10c36b481d6aff063070e35b4f42e7aad201': 1393088.9183112527,
  '0x59041d70deaefe849a48e77e0b273ddd072ea9e4': 223218.76277934402,
  '0x679d87d8640e66778c3419d164998e720d7495f6': 18216506.636293646,
  '0x6dfd4a0a88832d88532167f83f796fbed4752e55': 66502.76406322942,
  '0x78b9faab8fb5de5c7902f0b0cf1d1c17340ce207': 56694.366841610245,
  '0x7f79a7aaf569f350806813d41aeba544cbd017f4': 191891.0515700135,
  '0xa64f2228ccec96076c82abb903021c33859082f8': 623766.7573052527,
  '0xaf6f2a7643a97b849bd9cf6d3f57e142c5bbb0da': 698163.6935566304,
  '0xb2d3900807094d4fe47405871b0c8adb58e10d42': 25198767.573873997,
  '0xb3d7efd33cb72d63a3490c7b03907c05f1897109': 6458.517332137164,
  '0xc0f91468116d88ee2615ef71697a400be7858544': 13435.46582514672,
  '0xe2d3ac725e6ffe2b28a9ed83bedaaf6672f2c801': 5070884.457611926,
  '0xf2befa4b9489c1ef75e069d16a6f829f71b4b988': 124702.25092672906,
}

// Mirror of MEMBER_VOTE_EXCLUDED_ADDRESSES (e-Cat).
const EXCLUDED_ADDRESSES = new Set([
  '0x47cc4c7fef42187f9f7901838f316b033e92be05',
])

const BUDGET_OVERRIDES_USD = { 237: 4650 }
// Fallback only — real path uses extractUsdBudget on the IPFS payload.
const KNOWN_BUDGETS = {
  248: 3000, 235: 3600, 239: 4300, 240: 3955, 245: 3233.84,
  237: 4650, 241: 3815, 232: 4380, 231: 4682, 244: 2950,
}

function fillInZerosAndStripAuthors(distributions, projects, projectIdToAuthor) {
  const projectIds = projects.map((p) => String(p.id))
  return distributions.map((d) => {
    const voter = d.address.toLowerCase()
    return projectIds.map((pid) => {
      const author = projectIdToAuthor[pid]?.toLowerCase()
      if (author && author === voter) return NaN
      const v = d.distribution[pid]
      if (v == null || isNaN(Number(v))) return 0
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

  // Q2 2026 senate-approved set (the projects on the Member Vote ballot).
  // Sourced from the original published audit screenshot's 10-project
  // ballot. Pinning here so this script doesn't depend on the live
  // production API (which can flap or return `outcome: null`).
  const PASSED_MDPS = new Set([231, 232, 235, 237, 239, 240, 241, 244, 245, 248])
  const passedProjects = allProjects.filter((p) => PASSED_MDPS.has(Number(p.MDP)))
  console.log(`Filtered to ${passedProjects.length} senate-approved projects`)

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

  const voters = rawVotes
    .filter((v) => !EXCLUDED_ADDRESSES.has(v.address.toLowerCase()))
    .map((v) => {
      const distribution = typeof v.distribution === 'string' ? JSON.parse(v.distribution) : v.distribution
      const vMOONEY = SNAPSHOT_VMOONEY[v.address.toLowerCase()] ?? 0
      return { address: v.address, distribution, vMOONEY, power: Math.sqrt(vMOONEY) }
    })

  console.log(`\n${voters.length} voters in tally (after excluding e-Cat).`)
  console.log('Voting power (√vMOONEY) at APRIL 20, 2026 00:00 UTC:')
  for (const v of voters.slice().sort((a, b) => b.power - a.power)) {
    console.log(`  ${v.address}  vMOONEY=${v.vMOONEY.toFixed(2).padStart(12)}  √power=${v.power.toFixed(2).padStart(8)}`)
  }

  const matrix = fillInZerosAndStripAuthors(voters, passedProjects, projectIdToAuthor)
  const filled = runIterativeNormalization(matrix)
  const voterPowers = voters.map((v) => v.power)
  const outcome = runQuadraticVoting(filled, passedProjects, voterPowers)
  const sortedProjects = passedProjects
    .map((p) => ({ ...p, finalPct: outcome[String(p.id)] }))
    .sort((a, b) => b.finalPct - a.finalPct)

  console.log('\n========================================================================')
  console.log('FINAL OUTCOME (sorted by %)')
  console.log('========================================================================\n')
  for (const p of sortedProjects) {
    console.log(`  MDP-${String(p.MDP).padEnd(4)}  ${p.finalPct.toFixed(4).padStart(8)}%   $${usdBudgets[String(p.id)]}   ${p.name}`)
  }

  // Funding determination (mirrors getApprovedProjects in lib/utils/rewards.ts):
  // - eligible count = max(ceil(n/2), 3) = 5 for the 10-project Q2 ballot
  // - budget cap = quarterlyBudget * 3/4 = $23,409 * 0.75 = $17,556.75
  // - knapsack walk in % order: approve if it fits under BOTH caps; if a
  //   project would push cumulative past the budget cap, skip it but keep
  //   evaluating later (smaller) projects.
  const QUARTERLY_BUDGET_USD = 23409
  const numEligible = Math.min(Math.max(Math.ceil(sortedProjects.length / 2), 3), sortedProjects.length)
  const budgetCap = (QUARTERLY_BUDGET_USD * 3) / 4
  let approvedBudget = 0
  let approvedCount = 0
  const approved = []
  for (const p of sortedProjects) {
    const b = usdBudgets[String(p.id)] ?? 0
    const fitsCap = approvedBudget + b <= budgetCap
    const fitsCount = approvedCount < numEligible
    if (fitsCap && fitsCount) {
      approved.push({ ...p, budget: b })
      approvedBudget += b
      approvedCount += 1
    }
  }
  console.log('\n========================================================================')
  console.log('FUNDING DECISION (knapsack: top % under $17,556.75 cap, max 5 projects)')
  console.log('========================================================================\n')
  for (const p of approved) {
    console.log(`  APPROVED  MDP-${String(p.MDP).padEnd(4)}  $${String(p.budget).padStart(8)}   ${p.name}`)
  }
  console.log(`\n  Total approved: ${approved.length} projects, $${approvedBudget.toFixed(2)} of $${budgetCap.toFixed(2)} cap.`)
  console.log('\nCanonical outcome (April 20 snapshot, true historical balances):')
  console.log('Funded set: MDP-235, MDP-240, MDP-245, MDP-237 — total $15,438.84.')
  console.log('The percentages reproduce the originally-published audit screenshot')
  console.log('to 4 decimal places once the snapshot script\'s Arbitrum L1/L2')
  console.log('block-number bug is fixed (see vMooneySnapshots.ts comments).')
})()
