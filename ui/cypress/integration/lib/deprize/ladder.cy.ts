import fs from 'fs'
import path from 'path'
import {
  CAPABILITY_LADDER,
  LADDER_GOAL_IDS,
  getLadderForCompetition,
  isLadderGoal,
} from '@/lib/deprize/capabilityLadder'
import { findDePrizeIdForGoal } from '@/lib/deprize/competitions'
import { SEED_ATLAS } from '@/lib/lunar-atlas/seed'

const REPO_ROOT = path.resolve(__dirname, '../../../../../')
const CHAMBER_NEEDLE = ['NIGHT', 'SHIFT'].join('_')

describe('capability ladder', () => {
  it('CAPABILITY_LADDER has four rungs, 0..3, in order touchdown → first-tracks → ice → night-shift', () => {
    expect(CAPABILITY_LADDER.map((r) => r.rung)).to.deep.equal([0, 1, 2, 3])
    expect(CAPABILITY_LADDER.map((r) => r.key)).to.deep.equal([
      'touchdown',
      'first-tracks',
      'ice',
      'night-shift',
    ])
  })

  it('survives a supersede: with 23 superseding 22 under the same goal, getLadderForCompetition("sepolia", 23) keeps touchdown current and hrefs /deprize/23', () => {
    const result = getLadderForCompetition('sepolia', 23, {
      findDePrizeIdForGoal: () => 23,
    })
    const touchdown = result.rungs.find((r) => r.key === 'touchdown')
    expect(touchdown?.status).to.equal('live')
    expect(touchdown?.current).to.equal(true)
    expect(touchdown?.href).to.equal('/deprize/23')
    expect(result.currentKey).to.equal('touchdown')
    for (const rung of result.rungs) {
      expect(rung.href ?? '').to.not.include('22')
    }
  })

  it('every non-empty specHref resolves to a file that exists under docs/', () => {
    for (const rung of CAPABILITY_LADDER) {
      if (!rung.specHref) continue
      const file = rung.specHref.split('/docs/')[1]
      expect(file, rung.key).to.be.a('string').and.not.equal('')
      expect(fs.existsSync(path.join(REPO_ROOT, 'docs', file)), file).to.equal(true)
    }
  })

  it('getLadderForCompetition("sepolia", 2): touchdown is live, current, href /deprize/2', () => {
    const result = getLadderForCompetition('sepolia', 2)
    const touchdown = result.rungs.find((r) => r.key === 'touchdown')
    expect(touchdown?.status).to.equal('live')
    expect(touchdown?.current).to.equal(true)
    expect(touchdown?.href).to.equal('/deprize/2')
    expect(touchdown?.deprizeId).to.equal(2)
    expect(result.currentKey).to.equal('touchdown')
  })

  it('getLadderForCompetition("sepolia", 1): touchdown still current via lineage; href points at 2, not 1', () => {
    const result = getLadderForCompetition('sepolia', 1)
    const touchdown = result.rungs.find((r) => r.key === 'touchdown')
    expect(touchdown?.current).to.equal(true)
    expect(touchdown?.href).to.equal('/deprize/2')
    expect(touchdown?.href).to.not.include('/1')
    expect(result.currentKey).to.equal('touchdown')
  })

  it('every registered rung is live', () => {
    const result = getLadderForCompetition('sepolia', 2)
    const night = result.rungs.find((r) => r.key === 'night-shift')
    expect(night?.status).to.equal('live')
    expect(night?.deprizeId).to.equal(3)
    expect(night?.href).to.equal('/deprize/3')
    const tracks = result.rungs.find((r) => r.key === 'first-tracks')
    expect(tracks?.status).to.equal('live')
    expect(tracks?.deprizeId).to.equal(5)
    expect(tracks?.href).to.equal('/deprize/5')
    const ice = result.rungs.find((r) => r.key === 'ice')
    expect(ice?.status).to.equal('live')
    expect(ice?.deprizeId).to.equal(6)
    expect(ice?.href).to.equal('/deprize/6')
  })

  it('no ladder entry references the chamber spec', () => {
    for (const rung of CAPABILITY_LADDER) {
      expect(rung.specHref.includes(CHAMBER_NEEDLE), rung.key).to.equal(false)
    }
    expect(CAPABILITY_LADDER[3].key).to.equal('night-shift')
    expect(CAPABILITY_LADDER[3].specHref).to.equal('')
  })

  it('getLadderForCompetition("arbitrum", 1): no current key, touchdown not live on this chain', () => {
    const result = getLadderForCompetition('arbitrum', 1)
    expect(result.currentKey).to.equal(undefined)
    const touchdown = result.rungs.find((r) => r.key === 'touchdown')
    expect(touchdown?.status).to.not.equal('live')
    expect(touchdown?.current).to.equal(false)
  })

  it('getLadderForCompetition("sepolia", undefined) returns four rungs, none current', () => {
    const result = getLadderForCompetition('sepolia', undefined)
    expect(result.rungs).to.have.length(4)
    expect(result.rungs.every((r) => r.current === false)).to.equal(true)
    expect(result.currentKey).to.equal(undefined)
  })

  it('every status value in the union has a producer', () => {
    const live = getLadderForCompetition('sepolia', 2)
    expect(live.rungs[0].status).to.equal('live')
    const planned = getLadderForCompetition('sepolia', 2, {
      findDePrizeIdForGoal: () => undefined,
    })
    expect(planned.rungs[1].status).to.equal('planned')

    const rung0 = CAPABILITY_LADDER[0]
    const prev = rung0.statusOverride
    rung0.statusOverride = 'achieved'
    try {
      const retired = getLadderForCompetition('sepolia', 2)
      expect(retired.rungs[0].status).to.equal('achieved')
      expect(retired.rungs[0].deprizeId).to.equal(undefined)
    } finally {
      if (prev === undefined) delete rung0.statusOverride
      else rung0.statusOverride = prev
    }
  })
})

describe('LADDER_GOAL_IDS — which races the Moonbase calls real', () => {
  it('names one goal per rung, and every one exists on the atlas', () => {
    expect(LADDER_GOAL_IDS.length).to.equal(CAPABILITY_LADDER.length)
    const atlas = new Set(SEED_ATLAS.sharedGoals.map((g) => g.id))
    for (const id of LADDER_GOAL_IDS) {
      expect(atlas.has(id), `${id} is not an atlas goal`).to.equal(true)
    }
  })

  // The bug this exists to prevent. The Moonbase legend used to split its race
  // list on "has a DePrize on the connected chain", which is a different
  // question from "is this a race we run". Arbitrum has none of the four bound,
  // so on production that split demoted every real race to Potential and left
  // the list with nothing highlighted at all.
  it('is the same on a chain with no markets as on one with four', () => {
    const bound = (chain: string) =>
      LADDER_GOAL_IDS.filter((id) => findDePrizeIdForGoal(chain, id) !== undefined)
    expect(bound('sepolia').length, 'fixture: sepolia has the ladder bound')
      .to.be.greaterThan(0)
    expect(bound('arbitrum').length, 'fixture: arbitrum has none bound')
      .to.equal(0)
    for (const id of LADDER_GOAL_IDS) {
      expect(isLadderGoal(id), `${id} on arbitrum`).to.equal(true)
    }
  })

  it('excludes the capabilities we track but do not race', () => {
    for (const goal of SEED_ATLAS.sharedGoals) {
      if (LADDER_GOAL_IDS.includes(goal.id)) continue
      expect(isLadderGoal(goal.id), `${goal.id} should not be on the ladder`)
        .to.equal(false)
    }
    expect(isLadderGoal(undefined)).to.equal(false)
    expect(isLadderGoal('')).to.equal(false)
  })
})
