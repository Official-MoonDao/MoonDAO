/**
 * Regression tests for the four bugs that were silently rewriting past
 * audit results at /projects/audit. Each `describe` block names one
 * bug, demonstrates the buggy behavior, and asserts the fix.
 *
 * If a future refactor removes any of the defenses, the test in the
 * matching block should turn red BEFORE the audit re-introduces drift
 * in production.
 *
 * Bugs covered:
 *
 *   1. `balanceOf(addr, _t)` extrapolation — the live audit pipeline
 *      was reading vMOONEY balances at audit-render time using a
 *      contract function that LOOKS historical but actually projects
 *      the voter's *latest* user_point back to `_t`. Any post-close
 *      lock activity silently rewrote past results.
 *
 *   2. Arbitrum L1/L2 block-number mismatch — when we recovered past
 *      cycles via `balanceOfAt(addr, blockNumber)`, the snapshot
 *      script was passing the L2 (Arbitrum) block number. On
 *      Arbitrum, `block.number` returns the L1 (Ethereum) block, and
 *      the contract's `balanceOfAt` does `assert _block <= block.number`,
 *      so passing the L2 block reverted with empty data. The script
 *      silently treated the revert as 0, undercounting Arbitrum
 *      balances ~80%.
 *
 *   3. Tableland distribution drift — voter ballots are stored as
 *      Tableland rows. If submissions are re-opened or a row is
 *      manually edited after close, the audit silently re-tallied
 *      with the new values. Snapshotting distributions alongside
 *      vMOONEY closes this gap.
 *
 *   4. Derived vote-close timestamp diverges from governance — the
 *      formula `getThirdThursdayOfQuarterTimestamp + 5 days` returns
 *      a date the EB doesn't always honor (e.g. Q2 2026 actually
 *      closed 2026-04-20, not the formula's 2026-04-21). When a
 *      snapshot pins its own `voteCloseTimestamp`, that pin must win
 *      over the derived value so the displayed close date and the
 *      snapshotted balances stay internally consistent.
 *
 * Plus an end-to-end Q2 2026 outcome regression: feeding the pinned
 * snapshot through the same math primitives the production pipeline
 * uses must reproduce the originally-published audit screenshot
 * (MDP-240 22.01% / MDP-235 16.68% / MDP-245 10.20% / MDP-237 10.17%)
 * to within 0.01%.
 */

import {
  MEMBER_VOTE_VMOONEY_SNAPSHOTS,
  RETRO_VMOONEY_SNAPSHOTS,
  resolveSnapshotDistributions,
  resolveSnapshotVMooney,
  snapshotHasDistributions,
} from '../../../lib/proposals/vMooneySnapshots'
import type { VMooneySnapshot } from '../../../lib/proposals/vMooneySnapshots'
import {
  getApprovedProjects,
  runIterativeNormalization,
  runQuadraticVoting,
} from '../../../lib/utils/rewards'

// =============================================================================
// BUG 1 — `balanceOf(addr, _t)` extrapolation
// =============================================================================
//
// We can't unit-test the contract behavior directly, but we CAN
// guard the structural defenses that prevent the live extrapolation
// path from ever running for a cycle that has a frozen snapshot.

describe('BUG 1 regression — balanceOf(addr, _t) extrapolation', () => {
  it('every pinned snapshot uses true-historical method (not the buggy projection)', () => {
    // The snapshot CLI supports two methods:
    //   - `historical` (default): balanceOfAt(addr, block) — true lookup
    //   - `projected`: balanceOf(addr, ts) — the BUGGY method, only
    //                  useful for in-flight cycles where blockAtClose
    //                  doesn't exist yet
    // No PAST cycle should ever be pinned with `projected` — that
    // would re-introduce the drift bug for that cycle.
    const all = [
      ...Object.entries(MEMBER_VOTE_VMOONEY_SNAPSHOTS),
      ...Object.entries(RETRO_VMOONEY_SNAPSHOTS),
    ]
    for (const [key, snap] of all) {
      // `method` is optional for backward compat, but absent means
      // "historical" (the default). Explicit `'projected'` is the
      // failure mode we're catching.
      expect(
        snap.method,
        `${key} pinned with method='projected' — this re-introduces the buggy extrapolation`
      ).to.not.equal('projected')
    }
  })

  it('every pinned member-vote snapshot has a recoverable blockAtClose per chain', () => {
    // True-historical recovery requires a per-chain block height. If
    // someone pins a snapshot without `blockAtClose`, the script must
    // have fallen back to the projected method (or a manual paste
    // bypassed the script entirely) — both paths re-introduce drift.
    for (const [key, snap] of Object.entries(MEMBER_VOTE_VMOONEY_SNAPSHOTS)) {
      expect(snap.blockAtClose, `${key} missing blockAtClose`).to.exist
      expect(snap.blockAtClose, `${key} blockAtClose missing arbitrum`).to.have.property('arbitrum')
      expect(snap.blockAtClose, `${key} blockAtClose missing ethereum`).to.have.property('ethereum')
      expect(snap.blockAtClose, `${key} blockAtClose missing polygon`).to.have.property('polygon')
      expect(snap.blockAtClose, `${key} blockAtClose missing base`).to.have.property('base')
    }
  })
})

// =============================================================================
// BUG 2 — Arbitrum L1/L2 block-number mismatch
// =============================================================================

describe('BUG 2 regression — Arbitrum L1/L2 block mismatch', () => {
  it('every pinned snapshot uses L1-block for Arbitrum (== ethereum block)', () => {
    // On Arbitrum, `block.number` returns the L1 (Ethereum) block,
    // and `balanceOfAt(addr, _block)` does
    // `assert _block <= block.number`. The snapshot script's
    // resolveChainContexts substitutes Arbitrum's block-at-timestamp
    // with Ethereum's block-at-timestamp specifically to satisfy
    // that assert. If anyone re-pins without the substitution, the
    // L2 block (in the 400M+ range) blows past the L1 block (~24M)
    // and balanceOfAt reverts — silently dropping all Arbitrum
    // balances from the snapshot.
    //
    // This invariant catches that regression at file-integrity time,
    // before the audit ships with a partially-zero snapshot.
    const all = [
      ...Object.entries(MEMBER_VOTE_VMOONEY_SNAPSHOTS),
      ...Object.entries(RETRO_VMOONEY_SNAPSHOTS),
    ]
    for (const [key, snap] of all) {
      if (!snap.blockAtClose) continue
      const { arbitrum, ethereum } = snap.blockAtClose
      if (arbitrum == null || ethereum == null) continue
      expect(
        arbitrum,
        `${key}: Arbitrum block (${arbitrum}) must equal Ethereum block ` +
          `(${ethereum}) because balanceOfAt on Arbitrum expects an L1 block ` +
          `number. See vMooneySnapshots.ts and snapshot-vmooney.mjs.`
      ).to.equal(ethereum)
    }
  })

  it('Arbitrum block is in the L1 range (not L2), as a sanity check', () => {
    // Belt-and-braces: even if someone hand-pins arbitrum=ethereum
    // but uses the L2 number for both, that's still wrong (Ethereum's
    // block height is ~24M, Arbitrum L2 is ~454M+). Any "arbitrum"
    // value over 100M is almost certainly an L2 block number that
    // slipped through.
    const all = [
      ...Object.entries(MEMBER_VOTE_VMOONEY_SNAPSHOTS),
      ...Object.entries(RETRO_VMOONEY_SNAPSHOTS),
    ]
    for (const [key, snap] of all) {
      const arbBlock = snap.blockAtClose?.arbitrum
      if (arbBlock == null) continue
      expect(
        arbBlock,
        `${key}: arbitrum block ${arbBlock} looks like an L2 block (>100M). ` +
          `It should be the Ethereum L1 block at the close timestamp.`
      ).to.be.lessThan(100_000_000)
    }
  })

  it('Q2 2026 vMOONEY balances reflect Arbitrum totals (regression: the L2-block bug zeroed them)', () => {
    // Concrete pin: under the L2-block bug, several Q2 2026 voters
    // were recorded with their non-Arbitrum-only balance because
    // Arbitrum's balanceOfAt was reverting and the script swallowed
    // the revert. Specifically `0xb2d3...` was 2,118,427 (eth-only)
    // when the true at-close total (with Arbitrum) is 25,198,767.
    // Any drop back below ~10M for that voter at Q2 2026 would
    // indicate the L2-block fix was inadvertently reverted.
    const snap = MEMBER_VOTE_VMOONEY_SNAPSHOTS['2026-Q2']
    expect(snap, 'Q2 2026 snapshot should be pinned').to.exist
    expect(
      snap.vMOONEY['0xb2d3900807094d4fe47405871b0c8adb58e10d42'],
      'Q2 2026: 0xb2d3... vMOONEY collapsed to ~2M — Arbitrum L1-block fix reverted?'
    ).to.be.greaterThan(10_000_000)
    expect(
      snap.vMOONEY['0x679d87d8640e66778c3419d164998e720d7495f6'],
      'Q2 2026: 0x679d... vMOONEY collapsed to ~2M — Arbitrum L1-block fix reverted?'
    ).to.be.greaterThan(10_000_000)
    expect(
      snap.vMOONEY['0xe2d3ac725e6ffe2b28a9ed83bedaaf6672f2c801'],
      'Q2 2026: 0xe2d3... vMOONEY collapsed to ~38k — Arbitrum L1-block fix reverted?'
    ).to.be.greaterThan(1_000_000)
  })
})

// =============================================================================
// BUG 3 — Tableland distribution drift
// =============================================================================

describe('BUG 3 regression — Tableland distribution drift', () => {
  it('every PAST snapshot also pins distributions (member vote)', () => {
    // Member vote distributions are stored in `Proposals_*`, which
    // could in theory be edited (re-opened submissions, manual owner
    // write) after close. Pinning distributions alongside vMOONEY
    // makes the audit fully drift-proof: the compute pipeline reads
    // from the snapshot and never re-queries Tableland for past
    // cycles.
    //
    // Active cycles legitimately don't have a snapshot yet, so we
    // only assert this for cycles that ARE pinned in the file.
    for (const [key, snap] of Object.entries(MEMBER_VOTE_VMOONEY_SNAPSHOTS)) {
      expect(
        snapshotHasDistributions(snap),
        `${key} member-vote snapshot is missing distributions — ` +
          `Tableland drift can still mutate this audit`
      ).to.equal(true)
    }
  })

  it('every PAST snapshot also pins distributions (retro)', () => {
    for (const [key, snap] of Object.entries(RETRO_VMOONEY_SNAPSHOTS)) {
      expect(
        snapshotHasDistributions(snap),
        `${key} retro snapshot is missing distributions — ` +
          `Tableland drift can still mutate this audit`
      ).to.equal(true)
    }
  })

  it('resolveSnapshotDistributions returns rows in the live-Tableland shape (drop-in replacement)', () => {
    // The compute pipeline destructures the same fields whether the
    // rows came from `queryTable(... Proposals_*)` or
    // `resolveSnapshotDistributions(snap)`. If this contract ever
    // changes, the snapshot fallback silently breaks.
    const snap = MEMBER_VOTE_VMOONEY_SNAPSHOTS['2026-Q2']
    if (!snap || !snap.distributions) {
      throw new Error('Q2 2026 snapshot missing — required for this test')
    }
    const rows = resolveSnapshotDistributions(snap)
    expect(rows.length).to.be.greaterThan(0)
    for (const row of rows) {
      expect(row).to.have.all.keys('address', 'distribution', 'quarter', 'year')
      expect(row.address).to.equal(row.address.toLowerCase())
      expect(row.quarter).to.equal(snap.quarter)
      expect(row.year).to.equal(snap.year)
      expect(row.distribution).to.be.an('object')
    }
  })
})

// =============================================================================
// BUG 4 — Derived vote-close timestamp diverges from governance
// =============================================================================

describe('BUG 4 regression — pinned voteCloseTimestamp wins over derived', () => {
  it('every pinned snapshot has a finite, positive voteCloseTimestamp', () => {
    // A snapshot without a pinned close timestamp would force the
    // compute pipeline to fall back to the derived formula, which
    // can disagree with what the EB designated as the close moment.
    const all = [
      ...Object.entries(MEMBER_VOTE_VMOONEY_SNAPSHOTS),
      ...Object.entries(RETRO_VMOONEY_SNAPSHOTS),
    ]
    for (const [key, snap] of all) {
      expect(
        Number.isFinite(snap.voteCloseTimestamp),
        `${key}: voteCloseTimestamp must be a finite number`
      ).to.equal(true)
      expect(snap.voteCloseTimestamp, `${key}: voteCloseTimestamp must be > 0`).to.be.greaterThan(0)
    }
  })

  it('Q2 2026 voteCloseTimestamp is pinned to the canonical 2026-04-20 00:00 UTC', () => {
    // Spec pin: the originally-published Q2 2026 audit screenshot
    // displays "Snapshot at vote close (4/20/2026)". The formula
    // `getThirdThursdayOfQuarterTimestamp + 5 days` would put close
    // ~April 26 (it treats the submission deadline as vote-open).
    // The pinned value must be the EB-designated close, not the
    // formula default.
    const snap = MEMBER_VOTE_VMOONEY_SNAPSHOTS['2026-Q2']
    expect(snap, 'Q2 2026 snapshot should be pinned').to.exist
    expect(
      snap.voteCloseTimestamp,
      'Q2 2026: voteCloseTimestamp must be 1776643200 (2026-04-20 00:00 UTC)'
    ).to.equal(1776643200)
  })
})

// =============================================================================
// END-TO-END — Q2 2026 outcome regression
// =============================================================================
//
// Reproduces the same orchestration as `computeMemberVoteOutcome` but
// using the snapshot as the source of truth for both vMOONEY and
// distributions. If this test passes, all four bug fixes above are
// behaving correctly together: the audit at /projects/audit for
// Q2 2026 will display the same percentages and funded set as the
// originally-published screenshot.

describe('END-TO-END — Q2 2026 audit reproduces published screenshot', () => {
  // The 10 senate-approved projects from the Q2 2026 ballot.
  // (id, MDP, budget, author) — pinned here so the test doesn't
  // depend on Tableland / IPFS availability. Authors come from each
  // proposal's IPFS payload (`authorAddress` field) and are needed
  // by the production preprocessing step (a voter cannot vote on
  // their own project; the cell is omitted so `runIterativeNormalization`
  // imputes it with the column average of OTHER voters).
  const Q2_2026_PROJECTS: Array<{
    id: number
    MDP: number
    budget: number
    author: string
  }> = [
    { id: 113, MDP: 231, budget: 4682, author: '0x3d89f8f96ccc8acbdd9f5326f9ee20ff76f7d078' },
    { id: 114, MDP: 232, budget: 4380, author: '0x59041d70deaefe849a48e77e0b273ddd072ea9e4' },
    { id: 117, MDP: 235, budget: 3600, author: '0x95593cbbcc29239e02178d7b3272a83eab26a046' },
    { id: 119, MDP: 237, budget: 4650, author: '0x3112c093b0f89799a7739ec67aac1a3e162a04fb' }, // budgetOverrides.ts pin on budget
    { id: 121, MDP: 239, budget: 4300, author: '0x47cc4c7fef42187f9f7901838f316b033e92be05' },
    { id: 122, MDP: 240, budget: 3955, author: '0x977e3f778d1afce209fa0d2299374b1875f5238a' },
    { id: 123, MDP: 241, budget: 3815, author: '0xc0f91468116d88ee2615ef71697a400be7858544' },
    { id: 126, MDP: 244, budget: 2950, author: '0x0e92e0e2fb6624e64ae9d0283aa3fb76972cae7a' },
    { id: 127, MDP: 245, budget: 3233.84, author: '0x37e6c43ae0341304ff181da55e8d2593f1728c45' },
    { id: 130, MDP: 248, budget: 3000, author: '0xa64f2228ccec96076c82abb903021c33859082f8' },
  ]

  const QUARTERLY_BUDGET_USD = 23409
  const EXCLUDED_ADDRESSES = new Set([
    // e-Cat (excluded per `MEMBER_VOTE_EXCLUDED_ADDRESSES`).
    '0x47cc4c7fef42187f9f7901838f316b033e92be05',
  ])

  function computeOutcomeFromSnapshot(snap: VMooneySnapshot) {
    const projectShape = Q2_2026_PROJECTS.map((p) => ({ id: String(p.id) }))
    // Resolve voter list from the snapshotted distributions (this is
    // exactly what the production compute pipeline does when the
    // snapshot has distributions pinned).
    const distRows = resolveSnapshotDistributions(snap).filter(
      (r) => !EXCLUDED_ADDRESSES.has(r.address)
    )
    // Mirror the production preprocessing in computeMemberVoteOutcome:
    //   - Author's own-project cell: OMIT entirely (NaN downstream → imputed)
    //   - Other missing cells: explicit 0 (silence ≠ implicit support)
    // This is what makes the screenshot's percentages reproducible —
    // the raw runIterativeNormalization on un-preprocessed data would
    // synthesize support for projects voters never endorsed.
    const projectIdToAuthor: Record<string, string> = {}
    for (const p of Q2_2026_PROJECTS) projectIdToAuthor[String(p.id)] = p.author
    const preprocessed = distRows.map((r) => {
      const cleaned: Record<string, number> = {}
      for (const p of Q2_2026_PROJECTS) {
        const pid = String(p.id)
        if (projectIdToAuthor[pid] === r.address) continue
        const raw = r.distribution[pid]
        const n = Number(raw)
        cleaned[pid] = raw != null && Number.isFinite(n) && n >= 0 ? n : 0
      }
      return { ...r, distribution: cleaned }
    })
    const voterAddresses = preprocessed.map((r) => r.address)
    const vMOONEYs = resolveSnapshotVMooney(snap, voterAddresses)
    const power: Record<string, number> = {}
    voterAddresses.forEach((addr, i) => {
      const v = vMOONEYs[i] || 0
      power[addr] = isNaN(v) ? 0 : Math.sqrt(v)
    })
    const [normalized] = runIterativeNormalization(preprocessed, projectShape)
    const outcome = runQuadraticVoting(normalized, power, 100)
    return outcome
  }

  it('top 4 percentages match the screenshot to 0.01% (with Arbitrum L1-block fix)', () => {
    const snap = MEMBER_VOTE_VMOONEY_SNAPSHOTS['2026-Q2']
    expect(snap, 'Q2 2026 snapshot should be pinned').to.exist
    const outcome = computeOutcomeFromSnapshot(snap)
    // From the originally-published audit screenshot. Tolerance 0.01%
    // covers any benign floating-point rounding without permitting
    // the silent regressions that the L2-block bug or the
    // extrapolation bug would introduce (those would shift values
    // by multiple percentage points, easily caught by 0.01).
    const TOLERANCE = 0.01
    expect(outcome[String(122)], 'MDP-240 (Space Content) — screenshot 22.01%').to.be.closeTo(22.01, TOLERANCE)
    expect(outcome[String(117)], 'MDP-235 (ACMA Ignites) — screenshot 16.68%').to.be.closeTo(16.68, TOLERANCE)
    expect(outcome[String(127)], 'MDP-245 (Sounding Rocket) — screenshot 10.20%').to.be.closeTo(10.20, TOLERANCE)
    expect(outcome[String(119)], 'MDP-237 (Moon Founder\'s Club) — screenshot 10.17%').to.be.closeTo(10.17, TOLERANCE)
  })

  it('funded set matches the screenshot exactly: MDP-235, MDP-240, MDP-245, MDP-237', () => {
    const snap = MEMBER_VOTE_VMOONEY_SNAPSHOTS['2026-Q2']
    if (!snap) throw new Error('Q2 2026 snapshot missing — required for this test')
    const outcome = computeOutcomeFromSnapshot(snap)
    const usdBudgets: Record<string, number> = {}
    for (const p of Q2_2026_PROJECTS) usdBudgets[String(p.id)] = p.budget
    const projectShape = Q2_2026_PROJECTS.map((p) => ({ id: String(p.id) }))
    const approved = getApprovedProjects(projectShape, outcome, usdBudgets, QUARTERLY_BUDGET_USD)
    const approvedMDPs = Q2_2026_PROJECTS.filter((p) => approved[String(p.id)])
      .map((p) => p.MDP)
      .sort((a, b) => a - b)
    expect(approvedMDPs).to.deep.equal([235, 237, 240, 245])
  })

  it('total approved budget equals the screenshot ($15,438.84 of $17,556.75 cap)', () => {
    const snap = MEMBER_VOTE_VMOONEY_SNAPSHOTS['2026-Q2']
    if (!snap) throw new Error('Q2 2026 snapshot missing — required for this test')
    const outcome = computeOutcomeFromSnapshot(snap)
    const usdBudgets: Record<string, number> = {}
    for (const p of Q2_2026_PROJECTS) usdBudgets[String(p.id)] = p.budget
    const projectShape = Q2_2026_PROJECTS.map((p) => ({ id: String(p.id) }))
    const approved = getApprovedProjects(projectShape, outcome, usdBudgets, QUARTERLY_BUDGET_USD)
    const totalApproved = Q2_2026_PROJECTS.filter((p) => approved[String(p.id)]).reduce(
      (s, p) => s + p.budget,
      0
    )
    expect(totalApproved).to.be.closeTo(15438.84, 0.01)
    const cap = (QUARTERLY_BUDGET_USD * 3) / 4
    expect(cap).to.be.closeTo(17556.75, 0.01)
    expect(totalApproved, 'approved must fit under cap').to.be.at.most(cap)
  })

  it('regression sentinel: would FAIL if Arbitrum L1-block fix was reverted', () => {
    // Construct a hypothetical "buggy" snapshot where Arbitrum
    // balances are silently dropped (simulating the L2-block revert).
    // Verify that THIS would NOT reproduce the screenshot — i.e.
    // confirms the Arbitrum balances are load-bearing for the
    // canonical outcome, so any future regression of the L1/L2 fix
    // will fail the percentage assertions above.
    const snap = MEMBER_VOTE_VMOONEY_SNAPSHOTS['2026-Q2']
    if (!snap) throw new Error('Q2 2026 snapshot missing — required for this test')

    // Crude approximation of "Arbitrum dropped": shrink each non-
    // tiny voter to roughly their non-Arbitrum portion. We don't need
    // to reconstruct the exact pre-fix values; we just need to show
    // that materially different inputs produce materially different
    // outcomes (so the screenshot match isn't an accident of
    // tolerances).
    const buggyVMOONEY: Record<string, number> = {}
    for (const [addr, value] of Object.entries(snap.vMOONEY)) {
      // Heuristic: the L2-block bug cut large voters' balances by
      // roughly 80-90% (Arbitrum was the dominant chain). Simulate
      // by shrinking. Voters with very small balances are mostly on
      // mainnet, leave alone.
      buggyVMOONEY[addr] = value > 100000 ? value * 0.1 : value
    }
    const buggySnap: VMooneySnapshot = { ...snap, vMOONEY: buggyVMOONEY }
    const buggyOutcome = computeOutcomeFromSnapshot(buggySnap)

    // The buggy outcome should NOT match the screenshot percentages.
    // If this assertion fires, it means even a 10x shrinkage of
    // Arbitrum balances doesn't change the outcome — i.e. our other
    // assertions above are passing by accident, not because the
    // recovered balances are correct. That would be a much subtler
    // bug to catch and we want to scream loud.
    const tolerance = 0.5 // half a percentage point
    const mdp240 = buggyOutcome[String(122)] ?? 0
    expect(
      Math.abs(mdp240 - 22.01),
      'sentinel: 10x shrunk Arbitrum balances should NOT reproduce MDP-240 22.01%. ' +
        'If this fails, the canonical-outcome test above is passing by accident.'
    ).to.be.greaterThan(tolerance)
  })
})
