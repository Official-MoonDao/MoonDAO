import fs from 'fs'
import path from 'path'
import {
  CAPABILITY_LADDER,
  getLadderForCompetition,
} from '@/lib/deprize/capabilityLadder'

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

  it('getLadderForCompetition("sepolia", 22): touchdown is live, current, href /deprize/22', () => {
    const result = getLadderForCompetition('sepolia', 22)
    const touchdown = result.rungs.find((r) => r.key === 'touchdown')
    expect(touchdown?.status).to.equal('live')
    expect(touchdown?.current).to.equal(true)
    expect(touchdown?.href).to.equal('/deprize/22')
    expect(touchdown?.deprizeId).to.equal(22)
    expect(result.currentKey).to.equal('touchdown')
  })

  it('getLadderForCompetition("sepolia", 21): touchdown still current via lineage; href points at 22, not 21', () => {
    const result = getLadderForCompetition('sepolia', 21)
    const touchdown = result.rungs.find((r) => r.key === 'touchdown')
    expect(touchdown?.current).to.equal(true)
    expect(touchdown?.href).to.equal('/deprize/22')
    expect(touchdown?.href).to.not.include('21')
    expect(result.currentKey).to.equal('touchdown')
  })

  it('planned rungs have no href and no deprizeId', () => {
    const result = getLadderForCompetition('sepolia', 22)
    for (const key of ['first-tracks', 'ice', 'night-shift'] as const) {
      const rung = result.rungs.find((r) => r.key === key)
      expect(rung?.status, key).to.equal('planned')
      expect(rung?.href, key).to.equal(undefined)
      expect(rung?.deprizeId, key).to.equal(undefined)
    }
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
    const live = getLadderForCompetition('sepolia', 22)
    expect(live.rungs[0].status).to.equal('live')
    expect(live.rungs[1].status).to.equal('planned')

    const rung0 = CAPABILITY_LADDER[0]
    const prev = rung0.statusOverride
    rung0.statusOverride = 'achieved'
    try {
      const retired = getLadderForCompetition('sepolia', 22)
      expect(retired.rungs[0].status).to.equal('achieved')
      expect(retired.rungs[0].deprizeId).to.equal(undefined)
    } finally {
      if (prev === undefined) delete rung0.statusOverride
      else rung0.statusOverride = prev
    }
  })
})
