/**
 * Preconditions `provision-sepolia-side-markets.ts` cannot check offline.
 *
 * The script validates plenty at run time, but by then it is talking to a
 * chain and the outcome set is one transaction away from freezing at
 * `prepareCondition`. These are the checks that can fail in CI instead.
 */
import {
  OPEN_FIELD_TEAM_ID,
  findDePrizeIdForGoal,
  getDePrizeQuestionId,
  getDePrizeRaceBinding,
} from '@/lib/deprize/competitions'
import { SIDE_MARKETS } from '@/lib/deprize/sideMarkets'
import { SEED_ATLAS } from '@/lib/lunar-atlas/seed'

const CHAINS = ['sepolia', 'arbitrum'] as const
// The competitions map is module-private on purpose. Registry ids are small
// and dense, so walking a generous range is cheaper than widening its API.
const ID_SCAN = Array.from({ length: 64 }, (_, i) => i + 1)

describe('side market provisioning preconditions', () => {
  it('satisfies DePrizeRegistry.register on every definition', () => {
    // register() requires at least two teamIds, all non-zero and unique. It
    // does not look up a Team NFT, which is what makes synthetic ids legal.
    for (const def of SIDE_MARKETS) {
      const teamIds = def.outcomes.map((o) => o.teamId)
      expect(teamIds.length, `${def.key} count`).to.be.at.least(2)
      expect(new Set(teamIds).size, `${def.key} unique`).to.equal(teamIds.length)
      for (const id of teamIds) {
        expect(id, `${def.key} non-zero`).to.be.greaterThan(0)
      }
    }
  })

  it('never reuses a teamId that a race roster already means something by', () => {
    // A side market's teamIds are synthetic, but they are displayed and
    // logged. Reusing 24 (the open field) or a lander's id would make a
    // provisioning log read as if a competitor were involved.
    const raceTeamIds = new Set<number>([OPEN_FIELD_TEAM_ID])
    for (const chain of CHAINS) {
      for (const id of ID_SCAN) {
        const binding = getDePrizeRaceBinding(chain, id)
        if (!binding) continue
        for (const outcome of binding.outcomes) {
          // teamId is optional on a race outcome — only the checksummed ones
          // are ids anybody could confuse a side market's for.
          if (outcome.teamId !== undefined) raceTeamIds.add(outcome.teamId)
        }
      }
    }
    expect(raceTeamIds.size, 'fixture sanity: races have teamIds').to.be.greaterThan(1)
    for (const def of SIDE_MARKETS) {
      for (const outcome of def.outcomes) {
        expect(
          raceTeamIds.has(outcome.teamId),
          `${def.key}/${outcome.key} reuses race teamId ${outcome.teamId}`
        ).to.equal(false)
      }
    }
  })

  it('points every definition at a real atlas goal that has an open race', () => {
    // The script refuses to provision against a parent that is not OPEN, but
    // it can only discover a typo'd goal id after spending gas on a mission.
    const goalIds = new Set(SEED_ATLAS.sharedGoals.map((g) => g.id))
    for (const def of SIDE_MARKETS) {
      expect(goalIds.has(def.parentGoalId), def.parentGoalId).to.equal(true)
      expect(
        findDePrizeIdForGoal('sepolia', def.parentGoalId),
        `${def.key} parent on sepolia`
      ).to.not.equal(undefined)
    }
  })

  it('derives a questionId that cannot collide with a race questionId', () => {
    // Both scripts hash `deprize:sepolia:<...>:<version>`. The side-market
    // path inserts a `side:` segment; without it, a side market keyed the same
    // as a goal id would prepare a condition over the race's question.
    const raceQuestionIds = new Set<string>()
    for (const chain of CHAINS) {
      for (const id of ID_SCAN) {
        const q = getDePrizeQuestionId(chain, id)
        if (q) raceQuestionIds.add(q.toLowerCase())
      }
    }
    for (const def of SIDE_MARKETS) {
      const preimage = `deprize:sepolia:side:${def.key}:v1`
      expect(preimage).to.include(':side:')
      // The goal-keyed preimage the races script would build for the parent.
      expect(preimage).to.not.equal(`deprize:sepolia:${def.parentGoalId}:v1`)
    }
    expect(raceQuestionIds.size, 'fixture sanity: races have questionIds').to.be.greaterThan(0)
  })
})
