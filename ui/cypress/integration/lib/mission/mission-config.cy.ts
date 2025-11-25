import { MISSION_TOKEN_WEIGHTS, MISSION_STAGE_NAMES } from '@/lib/mission/missionConfig'

describe('missionConfig', () => {
  it('exports MISSION_TOKEN_WEIGHTS as expected array', () => {
    expect(MISSION_TOKEN_WEIGHTS).to.be.an('array')
    expect(MISSION_TOKEN_WEIGHTS).to.have.length(3)
    expect(MISSION_TOKEN_WEIGHTS).to.deep.equal([2000, 1000, 500])
  })

  it('exports MISSION_STAGE_NAMES as expected array', () => {
    expect(MISSION_STAGE_NAMES).to.be.an('array')
    expect(MISSION_STAGE_NAMES).to.have.length(5)
    expect(MISSION_STAGE_NAMES[0]).to.be.undefined
    expect(MISSION_STAGE_NAMES[1]).to.equal('Ignition')
    expect(MISSION_STAGE_NAMES[2]).to.equal('Ascent')
    expect(MISSION_STAGE_NAMES[3]).to.equal('Orbit')
    expect(MISSION_STAGE_NAMES[4]).to.equal('Refund')
  })
})
