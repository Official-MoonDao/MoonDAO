/**
 * MDP-267 / Project System v9.0 — pot, grant, and cycle versioning.
 */
import { expect } from 'chai'
import {
  communityCircleUSD,
  projectFundingRulesForCycle,
  projectGrantCapUSD,
  projectGrantUSD,
  projectPotForCycle,
  projectPotFromOfficialAum,
  retroPoolUSD,
  roundToNearest500,
} from '@/lib/projectCycle/projectBudget'

describe('projectBudget / MDP-267', () => {
  it('rounds 3% of the Aug 14 official AUM snapshot to $10,000', () => {
    // Proposal worked example: official liquid AUM $327,851.
    expect(projectPotFromOfficialAum(327851)).to.equal(10000)
    expect(roundToNearest500(327851 * 0.03)).to.equal(10000)
  })

  it('rounds the July 1 lock print ($288,847) to $8,500', () => {
    expect(projectPotFromOfficialAum(288847)).to.equal(8500)
  })

  it('grant cap is ¼ pot', () => {
    expect(projectGrantCapUSD(10000)).to.equal(2500)
    expect(projectGrantCapUSD(8500)).to.equal(2125)
  })

  it('grant is min(ask, pot/4) under v9', () => {
    expect(projectGrantUSD(4640, 10000)).to.equal(2500)
    expect(projectGrantUSD(1100, 10000)).to.equal(1100)
    expect(projectGrantUSD(2430, 10000)).to.equal(2430)
  })

  it('v8 grant is the ask (no ¼ cap at tally time)', () => {
    expect(projectGrantUSD(4640, 24310, 'v8')).to.equal(4640)
  })

  it('replays the MDP-267 Q3 table: grants $6,030, retro $2,970', () => {
    const pot = 10000
    const grants = [4640, 1100, 2430].map((ask) => projectGrantUSD(ask, pot))
    const grantTotal = grants.reduce((s, n) => s + n, 0)
    expect(grants).to.deep.equal([2500, 1100, 2430])
    expect(grantTotal).to.equal(6030)
    expect(communityCircleUSD(pot)).to.equal(1000)
    expect(retroPoolUSD(pot, grantTotal)).to.equal(2970)
  })

  it('versions rules at Q4 2026', () => {
    expect(projectFundingRulesForCycle(3, 2026)).to.equal('v8')
    expect(projectFundingRulesForCycle(4, 2026)).to.equal('v9')
    expect(projectFundingRulesForCycle(1, 2027)).to.equal('v9')
  })

  it('pins historical pots so Q2/Q3 audits do not inherit the live pot', () => {
    expect(projectPotForCycle(2, 2026, 8500)).to.equal(23409)
    expect(projectPotForCycle(3, 2026, 8500)).to.equal(24310)
    expect(projectPotForCycle(4, 2026, 8500)).to.equal(8500)
  })
})
