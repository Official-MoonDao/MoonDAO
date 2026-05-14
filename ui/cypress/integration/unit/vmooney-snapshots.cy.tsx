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
  resolveSnapshotDistributions,
  resolveSnapshotVMooney,
  snapshotHasDistributions,
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

    it('snapshots that pin distributions store lowercased addresses too', () => {
      // Same diffability / dedupe argument as for vMOONEY addresses.
      // Pinning distributions only helps if the lookup is consistent.
      const all = [
        ...Object.values(MEMBER_VOTE_VMOONEY_SNAPSHOTS),
        ...Object.values(RETRO_VMOONEY_SNAPSHOTS),
      ]
      for (const snap of all) {
        if (!snap.distributions) continue
        for (const addr of Object.keys(snap.distributions)) {
          expect(addr, `distribution address not lowercased: ${addr}`).to.equal(
            addr.toLowerCase()
          )
        }
      }
    })

    it('every snapshotted distribution percent is a finite non-negative number', () => {
      const all = [
        ...Object.values(MEMBER_VOTE_VMOONEY_SNAPSHOTS),
        ...Object.values(RETRO_VMOONEY_SNAPSHOTS),
      ]
      for (const snap of all) {
        if (!snap.distributions) continue
        for (const [addr, dist] of Object.entries(snap.distributions)) {
          for (const [pid, value] of Object.entries(dist)) {
            expect(
              Number.isFinite(value),
              `non-finite distribution[${pid}] for ${addr}: ${value}`
            ).to.equal(true)
            expect(
              value,
              `negative distribution[${pid}] for ${addr}`
            ).to.be.at.least(0)
          }
        }
      }
    })

    it('every voter in `distributions` also appears in `vMOONEY` (no orphan rows)', () => {
      // The compute pipeline exclusively iterates voters from the
      // distribution rows, so a voter pinned in `distributions` but
      // missing from `vMOONEY` would silently get 0 power. Catch the
      // paste-typo case where someone pins a distributions map for a
      // larger voter set than they captured vMOONEY for.
      const all = [
        ...Object.entries(MEMBER_VOTE_VMOONEY_SNAPSHOTS),
        ...Object.entries(RETRO_VMOONEY_SNAPSHOTS),
      ]
      for (const [key, snap] of all) {
        if (!snap.distributions) continue
        for (const addr of Object.keys(snap.distributions)) {
          expect(
            snap.vMOONEY,
            `${key}: distribution voter ${addr} missing from vMOONEY map`
          ).to.have.property(addr)
        }
      }
    })
  })

  describe('snapshotHasDistributions', () => {
    it('returns false for null / undefined / empty / no field', () => {
      expect(snapshotHasDistributions(null)).to.equal(false)
      expect(snapshotHasDistributions(undefined)).to.equal(false)
      expect(snapshotHasDistributions(sampleSnapshot)).to.equal(false)
      expect(
        snapshotHasDistributions({
          ...sampleSnapshot,
          distributions: {},
        })
      ).to.equal(false)
    })

    it('returns true for a snapshot with at least one pinned distribution', () => {
      expect(
        snapshotHasDistributions({
          ...sampleSnapshot,
          distributions: { '0xaaaa000000000000000000000000000000000001': { '1': 100 } },
        })
      ).to.equal(true)
    })
  })

  describe('resolveSnapshotDistributions', () => {
    it('returns rows in the queryTable shape with quarter/year propagated', () => {
      const snap: VMooneySnapshot = {
        ...sampleSnapshot,
        distributions: {
          '0xaaaa000000000000000000000000000000000001': { '10': 50, '11': 50 },
          '0xaaaa000000000000000000000000000000000002': { '12': 100 },
        },
      }
      const rows = resolveSnapshotDistributions(snap)
      expect(rows).to.have.length(2)
      // Order isn't part of the contract, but every row should carry
      // the snapshot's (quarter, year) pair so the existing
      // `excludeMemberVotesByAddress` filter (which keys on these
      // fields) keeps working.
      for (const row of rows) {
        expect(row.quarter).to.equal(99)
        expect(row.year).to.equal(2099)
        expect(row.address).to.equal(row.address.toLowerCase())
      }
    })

    it('returns an empty array when distributions are absent or empty', () => {
      expect(resolveSnapshotDistributions(sampleSnapshot)).to.deep.equal([])
      expect(
        resolveSnapshotDistributions({ ...sampleSnapshot, distributions: {} })
      ).to.deep.equal([])
    })

    it('clones the inner distribution objects (mutation-safe)', () => {
      const snap: VMooneySnapshot = {
        ...sampleSnapshot,
        distributions: {
          '0xaaaa000000000000000000000000000000000001': { '10': 50, '11': 50 },
        },
      }
      const rows = resolveSnapshotDistributions(snap)
      // Mutating a returned row's distribution must not bleed back
      // into the snapshot — otherwise the audit could mutate the
      // pinned constant on subsequent calls.
      rows[0].distribution['10'] = 999
      expect(
        snap.distributions!['0xaaaa000000000000000000000000000000000001']['10']
      ).to.equal(50)
    })

    it('skips rows with falsy address keys', () => {
      // Defensive — `Object.entries` on a paste-typo with an empty
      // string key shouldn't surface as an unaddressable voter row.
      const snap: VMooneySnapshot = {
        ...sampleSnapshot,
        distributions: {
          '': { '10': 100 } as any,
          '0xaaaa000000000000000000000000000000000001': { '11': 100 },
        },
      }
      const rows = resolveSnapshotDistributions(snap)
      expect(rows).to.have.length(1)
      expect(rows[0].address).to.equal(
        '0xaaaa000000000000000000000000000000000001'
      )
    })
  })
})
