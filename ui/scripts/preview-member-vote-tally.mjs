/**
 * Live preview of what `computeMemberProposalTally` would produce for
 * a given MDP. Mirrors the abstain-aware pipeline that the on-chain
 * close-and-tally handler now uses, so this is the EXACT decision the
 * EB would get if they clicked "Close & Tally Member Vote" right now:
 *
 *   For % = forVP / (forVP + againstVP) × 100   (Abstain excluded)
 *   PASS  iff For % ≥ 66.6%
 *
 * Standalone — only ethers as a dep. Hits public RPCs and the
 * Tableland public gateway. No HSM secrets needed. Read-only — does
 * NOT touch the chain or Tableland.
 *
 * Usage:
 *
 *   node ui/scripts/preview-member-vote-tally.mjs --mdp=249
 */
import { ethers } from 'ethers'

function parseArgs() {
  const args = {}
  for (const raw of process.argv.slice(2)) {
    const m = raw.match(/^--([\w-]+)=(.*)$/)
    if (m) args[m[1]] = m[2]
  }
  const mdp = Number(args.mdp)
  if (!Number.isInteger(mdp) || mdp <= 0) {
    console.error(`Invalid --mdp="${args.mdp}" (expected a positive integer).`)
    process.exit(1)
  }
  return { mdp }
}

const TABLELAND_QUERY_URL = 'https://tableland.network/api/v1/query'
const NON_PROJECT_PROPOSAL_TABLE = 'NonProjectProposal_42161_154'
const PROPOSALS_CONTRACT_ARBITRUM = '0xaA928a1189b9320D23754f1D36B6C67d676fd6FE'
const PROPOSALS_ABI = [
  'function tempCheckApproved(uint256) view returns (bool)',
  'function tempCheckApprovedTimestamp(uint256) view returns (uint256)',
]
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

const FOR_KEY = '1'
const AGAINST_KEY = '2'
const ABSTAIN_KEY = '3'
const SUPER_MAJORITY = 66.6
const CHOICE_LABELS = { '1': 'For', '2': 'Against', '3': 'Abstain' }

async function fetchVotes(mdp) {
  const statement = `SELECT address, vote FROM ${NON_PROJECT_PROPOSAL_TABLE} WHERE MDP=${mdp}`
  const url = `${TABLELAND_QUERY_URL}?statement=${encodeURIComponent(statement)}`
  const res = await fetch(url)
  if (!res.ok) {
    throw new Error(`Tableland query failed (${res.status}): ${await res.text()}`)
  }
  const rows = await res.json()
  if (!Array.isArray(rows) || rows.length === 0) {
    throw new Error(`No votes found in ${NON_PROJECT_PROPOSAL_TABLE} for MDP-${mdp}.`)
  }
  const seen = new Set()
  const out = []
  for (const r of rows) {
    const addr = typeof r?.address === 'string' ? r.address.toLowerCase() : ''
    if (!addr || seen.has(addr)) continue
    seen.add(addr)
    const raw = r.vote
    let parsed
    if (typeof raw === 'string') {
      try { parsed = JSON.parse(raw) } catch { parsed = {} }
    } else if (raw && typeof raw === 'object') {
      parsed = raw
    } else {
      parsed = {}
    }
    const clean = {}
    for (const [k, v] of Object.entries(parsed)) {
      const n = Number(v)
      if (Number.isFinite(n) && n >= 0) clean[k] = n
    }
    out.push({ address: addr, vote: clean })
  }
  return out
}

async function getCloseTimestamp(mdp) {
  const provider = new ethers.providers.JsonRpcProvider(
    VMOONEY_TOKENS.find((t) => t.name === 'arbitrum').rpc
  )
  const proposals = new ethers.Contract(
    PROPOSALS_CONTRACT_ARBITRUM,
    PROPOSALS_ABI,
    provider
  )
  const approved = await proposals.tempCheckApproved(mdp)
  if (!approved) {
    throw new Error(
      `MDP-${mdp} hasn't passed Senate Temperature Check (tempCheckApproved=false).`
    )
  }
  const ts = Number((await proposals.tempCheckApprovedTimestamp(mdp)).toString())
  return ts + 60 * 60 * 24 * 5
}

async function getTotalVMooney(address, ts) {
  let total = 0
  for (const t of VMOONEY_TOKENS) {
    try {
      const provider = new ethers.providers.JsonRpcProvider(t.rpc)
      const c = new ethers.Contract(t.addr, VMOONEY_ABI, provider)
      const bal = await c['balanceOf(address,uint256)'](address, ts)
      total += parseFloat(ethers.utils.formatEther(bal))
    } catch (err) {
      console.error(`  [warn] ${t.name} balanceOf failed for ${address}: ${err?.message ?? err}`)
    }
  }
  return total
}

// Inline mirror of `lib/proposals/computeMemberProposalTally.ts` so this
// script stays standalone (no Next/Webpack import path). Keep these
// in lockstep — if the helper's math changes, update both.
function computeMemberProposalTally(votes, addressToVP) {
  let forVP = 0, againstVP = 0, abstainVP = 0, totalParticipationVP = 0
  for (const row of votes ?? []) {
    const lower = (row.address || '').toLowerCase()
    const power = addressToVP[lower] || 0
    if (power <= 0) continue
    const dist = row.vote || {}
    const pctFor = Number(dist[FOR_KEY]) || 0
    const pctAgainst = Number(dist[AGAINST_KEY]) || 0
    const pctAbstain = Number(dist[ABSTAIN_KEY]) || 0
    forVP += (power * pctFor) / 100
    againstVP += (power * pctAgainst) / 100
    abstainVP += (power * pctAbstain) / 100
    if (pctFor > 0 || pctAgainst > 0 || pctAbstain > 0) {
      totalParticipationVP += power
    }
  }
  const decidedVP = forVP + againstVP
  const forPctOfDecided = decidedVP > 0 ? (forVP / decidedVP) * 100 : 0
  const againstPctOfDecided = decidedVP > 0 ? (againstVP / decidedVP) * 100 : 0
  const abstainShareOfTurnout =
    totalParticipationVP > 0 ? (abstainVP / totalParticipationVP) * 100 : 0
  return {
    totalParticipationVP, forVP, againstVP, abstainVP, decidedVP,
    forPctOfDecided, againstPctOfDecided, abstainShareOfTurnout,
    passed: forPctOfDecided >= SUPER_MAJORITY,
  }
}

function dominantChoice(vote) {
  let best = null
  for (const [k, v] of Object.entries(vote)) {
    const n = Number(v) || 0
    if (best === null || n > best[1]) best = [k, n]
  }
  return best && best[1] > 0 ? CHOICE_LABELS[best[0]] ?? `Choice ${best[0]}` : 'Unknown'
}

;(async () => {
  const { mdp } = parseArgs()
  console.error(`[preview] MDP-${mdp} — fetching votes and close moment...`)

  const votes = await fetchVotes(mdp)
  console.error(`[preview] ${votes.length} unique voter(s).`)

  const closeTs = await getCloseTimestamp(mdp)
  const closeIso = new Date(closeTs * 1000).toISOString()
  const now = Math.floor(Date.now() / 1000)
  const stillOpen = now < closeTs
  console.error(
    `[preview] canonical close: ${closeTs} (${closeIso}) — ${
      stillOpen
        ? `${closeTs - now}s in the future (vote still open)`
        : `${now - closeTs}s ago (vote closed; tally would fire now)`
    }`
  )

  console.error(`[preview] resolving vMOONEY for each voter at close moment...`)
  const addressToVP = {}
  const addressToVMooney = {}
  for (const v of votes) {
    const total = await getTotalVMooney(v.address, closeTs)
    addressToVMooney[v.address] = total
    addressToVP[v.address] = Number.isFinite(total) && total >= 0 ? Math.sqrt(total) : 0
  }

  const tally = computeMemberProposalTally(votes, addressToVP)

  console.log('')
  console.log(`============================================================`)
  console.log(`Member Vote tally PREVIEW for MDP-${mdp}`)
  console.log(`(matches the on-chain decision in nonProjectVote.ts)`)
  console.log(`============================================================`)
  console.log(`Close moment:  ${closeIso} (${closeTs})`)
  console.log(`Voters:        ${votes.length}`)
  console.log(`Total turnout: ${tally.totalParticipationVP.toFixed(4)} VP`)
  console.log('')
  console.log(`Per-voter breakdown (sorted by voting power):`)
  console.log(`${'address'.padEnd(44)}  ${'vMOONEY'.padStart(15)}  ${'VP=√vMOONEY'.padStart(13)}  ${'choice'.padStart(8)}  raw vote JSON`)
  console.log('-'.repeat(120))
  const sorted = [...votes].sort((a, b) => (addressToVP[b.address] || 0) - (addressToVP[a.address] || 0))
  for (const v of sorted) {
    const vmoo = addressToVMooney[v.address] || 0
    const vp = addressToVP[v.address] || 0
    console.log(
      `${v.address.padEnd(44)}  ${vmoo.toFixed(4).padStart(15)}  ${vp.toFixed(4).padStart(13)}  ${dominantChoice(v.vote).padStart(8)}  ${JSON.stringify(v.vote)}`
    )
  }
  console.log('')
  console.log(`Decision (Abstain excluded from denominator):`)
  console.log(`  For VP:       ${tally.forVP.toFixed(4)}  (${tally.forPctOfDecided.toFixed(4)}% of decided)`)
  console.log(`  Against VP:   ${tally.againstVP.toFixed(4)}  (${tally.againstPctOfDecided.toFixed(4)}% of decided)`)
  console.log(`  Decided VP:   ${tally.decidedVP.toFixed(4)}  (For + Against)`)
  console.log('')
  console.log(`Abstain (informational, excluded from threshold):`)
  console.log(`  Abstain VP:   ${tally.abstainVP.toFixed(4)}  (${tally.abstainShareOfTurnout.toFixed(4)}% of total turnout)`)
  console.log('')
  console.log(`Pass threshold: ${SUPER_MAJORITY}% For of decided VP (supermajority)`)
  console.log(`For %:          ${tally.forPctOfDecided.toFixed(4)}%`)
  console.log(`Outcome:        ${tally.passed ? '✅ PASS' : '❌ FAIL'}`)
  console.log(`============================================================`)
  if (stillOpen) {
    console.log(`NOTE: vote is still open. Numbers will continue to change as`)
    console.log(`      additional votes are cast or existing voters re-cast.`)
  }
})().catch((err) => {
  console.error('[preview] FAILED:', err)
  process.exit(1)
})
