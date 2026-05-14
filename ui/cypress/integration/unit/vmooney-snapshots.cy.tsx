/**
 * Pin tests for the frozen vMOONEY snapshot lookup used by the
 * Member Vote and Retroactive Rewards audits.
 *
 * The snapshots exist so the audit page (`/projects/audit`) doesn't drift
 * when voters change their vMOONEY lock after vote close. The on-chain
 * `balanceOf(addr, _t)` extrapolates from the LATEST user point — see
 * `lib/proposals/vMooneySnapshots.ts` for the full rationale — so without
 * these snapshots, every late deposit/extension silently rewrote past
 * audit results.
 *
 * These tests guard the lookup contract (snapshot-first, address-case
 * insensitive, missing voters → 0) so a future cleanup that removes them
 * trips a red test before the audit re-introduces drift.
 */
import {
  MEMBER_VOTE_VMOONEY_SNAPSHOTS,
  RETRO_VMOONEY_SNAPSHOTS,
  getMemberVoteVMooneySnapshot,
  getRetroVMooneySnapshot,
  resolveSnapshotVMooney,
} from '../../../lib/proposals/vMooneySnapshots'
import type { VMooneySnapshot } from '../../../lib/proposals/vMooneySnapshots'

const sampleSnapshot: VMooneySnapshot = {
  quarter: 99,
  year: 2099,
  voteCloseTimestamp: 9_999_999_999,
  snapshotTakenAt: 9_999_999_999,
  vMOONEY: {
    '0xaaaa000000000000000000000000000000000001': 100,
    '0xaaaa000000000000000000000000000000000002': 250.5,
    '0xaaaa000000000000000000000000000000000003': 0,
  },
}

describe('vMooneySnapshots / lookup helpers', () => {
  describe('getMemberVoteVMooneySnapshot', () => {
    it('returns null for a (quarter, year) with no entry', () => {
      // Years far in the future will never have a real entry — gives us
      // a stable assertion that doesn't break when the EB pins a new
      // historical cycle.
      expect(getMemberVoteVMooneySnapshot(1, 2099)).to.equal(null)
      expect(getMemberVoteVMooneySnapshot(4, 2099)).to.equal(null)
    })

    it('returns the snapshot reference for any pinned cycle', () => {
      const entries = Object.entries(MEMBER_VOTE_VMOONEY_SNAPSHOTS)
      if (entries.length === 0) return
      for (const [key, snap] of entries) {
        // Map keys are `${year}-Q${quarter}`. Parse them rather than
        // hardcoding which cycles exist so adding a new snapshot doesn't
        // require touching this test.
        const m = key.match(/^(\d{4})-Q([1-4])$/)
        expect(m, `unexpected snapshot key shape: ${key}`).to.not.equal(null)
        const year = Number(m![1])
        const quarter = Number(m![2])
        expect(getMemberVoteVMooneySnapshot(quarter, year)).to.equal(snap)
      }
    })
  })

  describe('getRetroVMooneySnapshot', () => {
    it('returns null for a (quarter, year) with no entry', () => {
      expect(getRetroVMooneySnapshot(1, 2099)).to.equal(null)
      expect(getRetroVMooneySnapshot(4, 2099)).to.equal(null)
    })

    it('returns the snapshot reference for any pinned cycle', () => {
      const entries = Object.entries(RETRO_VMOONEY_SNAPSHOTS)
      if (entries.length === 0) return
      for (const [key, snap] of entries) {
        const m = key.match(/^(\d{4})-Q([1-4])$/)
        expect(m, `unexpected snapshot key shape: ${key}`).to.not.equal(null)
        const year = Number(m![1])
        const quarter = Number(m![2])
        expect(getRetroVMooneySnapshot(quarter, year)).to.equal(snap)
      }
    })
  })

  describe('resolveSnapshotVMooney', () => {
    it('returns balances in input order, defaulting missing voters to 0', () => {
      const result = resolveSnapshotVMooney(sampleSnapshot, [
        '0xAAAA000000000000000000000000000000000001',
        '0xaaaa000000000000000000000000000000000002',
        '0xnotinthesnapshot00000000000000000000000a',
      ])
      expect(result).to.deep.equal([100, 250.5, 0])
    })

    it('is address-case insensitive', () => {
      // Snapshot stores lowercased keys (and the EB capture script
      // normalizes them). Voter addresses come back from Tableland in
      // whatever case the on-chain insert used (always lowercased today,
      // but defensive normalization shouldn't break if that ever drifts).
      const lower = resolveSnapshotVMooney(sampleSnapshot, [
        '0xaaaa000000000000000000000000000000000001',
      ])
      const mixed = resolveSnapshotVMooney(sampleSnapshot, [
        '0xAaAa000000000000000000000000000000000001',
      ])
      const upper = resolveSnapshotVMooney(sampleSnapshot, [
        '0xAAAA000000000000000000000000000000000001',
      ])
      expect(lower).to.deep.equal([100])
      expect(mixed).to.deep.equal([100])
      expect(upper).to.deep.equal([100])
    })

    it('preserves explicit zeros (snapshotted voter with 0 vMOONEY)', () => {
      // A voter who voted but had 0 vMOONEY at close should still appear
      // in the snapshot (the on-chain insert doesn't gate on power) and
      // resolve to 0 — which downstream maps to 0 voting power, the same
      // outcome the live fetcher produces. Pin this so a future cleanup
      // doesn't accidentally collapse 0 to "missing → fallback".
      const result = resolveSnapshotVMooney(sampleSnapshot, [
        '0xaaaa000000000000000000000000000000000003',
      ])
      expect(result).to.deep.equal([0])
    })

    it('returns 0 for empty / falsy address inputs', () => {
      // Cast to `any[]` so the test can pass deliberately-degenerate
      // inputs through the lookup without per-element ts-ignore noise.
      const result = resolveSnapshotVMooney(
        sampleSnapshot,
        ['', null, undefined] as any
      )
      expect(result).to.deep.equal([0, 0, 0])
    })

    it('returns an empty array for an empty address list', () => {
      expect(resolveSnapshotVMooney(sampleSnapshot, [])).to.deep.equal([])
    })

    it('coerces malformed snapshot values to 0', () => {
      // Snapshots are hand-pasted from CLI output. Defensive: a bad
      // value (NaN, negative, string) should resolve to 0 rather than
      // poisoning downstream √vMOONEY math.
      const malformed: VMooneySnapshot = {
        ...sampleSnapshot,
        vMOONEY: {
          '0xbad1000000000000000000000000000000000000': NaN,
          '0xbad2000000000000000000000000000000000000': -1,
          // String value is a degenerate paste-typo case; cast through
          // `any` so the test can verify the runtime defense without a
          // per-line ts-ignore.
          '0xbad3000000000000000000000000000000000000': 'not a number' as any,
        },
      }
      const result = resolveSnapshotVMooney(malformed, [
        '0xbad1000000000000000000000000000000000000',
        '0xbad2000000000000000000000000000000000000',
        '0xbad3000000000000000000000000000000000000',
      ])
      expect(result).to.deep.equal([0, 0, 0])
    })
  })

  describe('snapshot file integrity', () => {
    it('every member-vote snapshot uses the canonical `${year}-Q${quarter}` key', () => {
      for (const key of Object.keys(MEMBER_VOTE_VMOONEY_SNAPSHOTS)) {
        expect(key, `unexpected snapshot key: ${key}`).to.match(
          /^\d{4}-Q[1-4]$/
        )
      }
    })

    it('every retro snapshot uses the canonical `${year}-Q${quarter}` key', () => {
      for (const key of Object.keys(RETRO_VMOONEY_SNAPSHOTS)) {
        expect(key, `unexpected snapshot key: ${key}`).to.match(
          /^\d{4}-Q[1-4]$/
        )
      }
    })

    it("each snapshot's quarter/year fields agree with its map key", () => {
      // Catches paste-typo bugs (e.g. pasting Q3 data under the Q2 key)
      // before they show up as a silent mismatch in the audit.
      const all = [
        ...Object.entries(MEMBER_VOTE_VMOONEY_SNAPSHOTS),
        ...Object.entries(RETRO_VMOONEY_SNAPSHOTS),
      ]
      for (const [key, snap] of all) {
        const m = key.match(/^(\d{4})-Q([1-4])$/)
        if (!m) continue
        expect(snap.year, `mismatched year for ${key}`).to.equal(Number(m[1]))
        expect(snap.quarter, `mismatched quarter for ${key}`).to.equal(
          Number(m[2])
        )
      }
    })

    it('every snapshotted address is lowercased', () => {
      // The lookup is case-insensitive at read time, but storing
      // lowercased addresses keeps the file diffable and prevents
      // accidental duplicate entries (one mixed-case, one lower).
      const all = [
        ...Object.values(MEMBER_VOTE_VMOONEY_SNAPSHOTS),
        ...Object.values(RETRO_VMOONEY_SNAPSHOTS),
      ]
      for (const snap of all) {
        for (const addr of Object.keys(snap.vMOONEY)) {
          expect(addr, `address not lowercased: ${addr}`).to.equal(
            addr.toLowerCase()
          )
        }
      }
    })

    it('every snapshotted vMOONEY value is a finite non-negative number', () => {
      const all = [
        ...Object.values(MEMBER_VOTE_VMOONEY_SNAPSHOTS),
        ...Object.values(RETRO_VMOONEY_SNAPSHOTS),
      ]
      for (const snap of all) {
        for (const [addr, value] of Object.entries(snap.vMOONEY)) {
          expect(
            Number.isFinite(value),
            `non-finite vMOONEY for ${addr}: ${value}`
          ).to.equal(true)
          expect(value, `negative vMOONEY for ${addr}`).to.be.at.least(0)
        }
      }
    })
  })
})
