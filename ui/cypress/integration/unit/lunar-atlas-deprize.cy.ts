/**
 * Cross-check the Moon Base Zero atlas against the DePrize race binding, and
 * prove the Wave 2 merge helper accepts real SharedGoal values.
 */

import { expect } from 'chai'
import {
  findDePrizeIdForGoal,
  getDePrizeRaceBinding,
  OPEN_FIELD_PROJECT_ID,
} from '../../../lib/deprize/competitions'
import { LADDER_GOAL_IDS } from '../../../lib/deprize/capabilityLadder'
import { BASE_PLAN } from '../../../lib/lunar-atlas/baseplan'
import { mergeLiveMarketInto } from '../../../lib/deprize/goal-market'
import {
  EARTH_SIDE_VENUE,
  earthSideVenue,
} from '../../../lib/lunar-atlas/display'
import { SEED_ATLAS } from '../../../lib/lunar-atlas/seed'
import { buildTechTrees, sharedGoalById } from '../../../lib/lunar-atlas/selectors'

describe('lunar-atlas × DePrize binding', () => {
  const binding = getDePrizeRaceBinding('sepolia', 2)
  const goal = sharedGoalById(SEED_ATLAS, 'shared-next-landing')
  const nightShift = sharedGoalById(SEED_ATLAS, 'shared-night-shift')

  it('binds Sepolia DePrize 2 to the Touchdown shared goal with matching projectIds', () => {
    expect(binding?.sharedGoalId).to.equal('shared-next-landing')
    expect(goal).to.exist
    const competitorIds = (binding?.outcomes ?? [])
      .filter((o) => !o.field)
      .map((o) => o.projectId)
    expect(competitorIds).to.have.length.greaterThan(0)
    for (const id of competitorIds) {
      expect(goal!.projectIds, `atlas goal missing ${id}`).to.include(id)
    }
  })

  it('merges live odds into the real SharedGoal without dropping atlas market fields', () => {
    expect(goal?.market?.resolutionAuthority).to.equal('senate')
    const live = {
      deprizeId: 9,
      oddsByProjectId: {
        'westinghouse-fission-surface-power': 0.4,
        'lockheed-fission-surface-power': 0.35,
        'ix-fission-surface-power': 0.15,
      },
      fieldOdds: 0.1,
      status: 'live' as const,
    }
    const next = mergeLiveMarketInto(
      [...SEED_ATLAS.sharedGoals],
      'shared-fission-power',
      live
    )
    const merged = next.find((g) => g.id === 'shared-fission-power')
    expect(merged?.market?.status).to.equal('live')
    expect(merged?.market?.impliedOdds?.[OPEN_FIELD_PROJECT_ID]).to.equal(0.1)
    // Atlas-only fields the panel still reads must survive the merge.
    expect(merged?.market?.resolutionAuthority).to.equal('senate')

    // buildTechTrees accepts the merged mutable array with no cast.
    const trees = buildTechTrees(SEED_ATLAS.projects, next)
    const power = trees.find((t) => t.goal?.id === 'shared-fission-power')
    expect(power?.goal?.market?.status).to.equal('live')
    expect(power?.goal?.market?.impliedOdds?.['westinghouse-fission-surface-power']).to.equal(
      0.4
    )
  })

  it('seeds Night Shift as an unbound planned race with seven named systems', () => {
    expect(nightShift).to.exist
    expect(nightShift!.title).to.match(/Night Shift/)
    expect(nightShift!.projectIds).to.deep.equal([
      'zeno-harmonia',
      'astrobotic-nite',
      'venturi-lunar-battery',
      'perpetual-atomics-endure',
      'cnnc-lunar-rtg',
      'rosatom-lunar-rtg',
      'isro-barc-rhu',
    ])
    // Power chip only. `category` is the unique tech-tree race, and fission
    // already owns Power — Night Shift must not take that binding.
    expect(nightShift!.category).to.equal(undefined)
    expect(nightShift!.indexCategory).to.equal('power')
    expect(nightShift!.description).to.match(
      /^Deliver at least 10 watts of electricity, continuously, for 354 hours/,
    )
    expect(nightShift!.description).to.match(/not a 9\.8 W waiver/)
    const sustained = nightShift!.criteria?.find((c) => c.id === 'sustained-output')
    expect(sustained?.threshold).to.match(/first hour/)
    expect(sustained?.threshold).to.not.match(/over the window/)
    expect(nightShift!.criteria?.some((c) => c.id === 'size-disclosure')).to.equal(true)
    expect(nightShift!.criteria?.some((c) => c.id === 'independent-meters')).to.equal(true)
  })

  // v0.7 closed the hole that owning the meters does not make the meters good
  // enough: a legitimately calibrated instrument reading high turns a 9.85 We
  // article into an honest file that passes every other check. The public
  // criteria have to carry it, or the site advertises a bar the rules no longer
  // set.
  it('states the measurement-uncertainty rule on the criteria the site renders', () => {
    const tenWatts = nightShift!.criteria?.find((c) => c.id === 'ten-watts')
    expect(tenWatts?.threshold).to.match(/lower bound/)
    expect(tenWatts?.threshold).to.match(/uncertainty/)

    const meters = nightShift!.criteria?.find((c) => c.id === 'independent-meters')
    expect(meters?.threshold).to.match(/0\.5% expanded uncertainty/)
    expect(meters?.threshold).to.match(/traceably calibrated/)
    expect(nightShift!.market?.status).to.equal('planned')
    expect(findDePrizeIdForGoal('sepolia', 'shared-night-shift')).to.equal(3)
    for (const id of nightShift!.projectIds) {
      const project = SEED_ATLAS.projects.find((p) => p.id === id)
      expect(project, id).to.exist
      expect(project!.sharedGoalIds).to.include('shared-night-shift')
      expect(project!.location, `${id} must stay off the globe`).to.equal(undefined)
    }
  })
})

// Staying off the globe is only half of it. A race that is merely ABSENT reads
// as one whose models have not been built yet — which is true of several here
// and will stop being true as they get built. Night Shift will never be built,
// because it is not won on the Moon, so the atlas marks it rather than leaving
// it blank. These lock the marking to the facts that justify it: the moment
// the dataset stops describing a chamber test, or an entrant gets ground, the
// marking is a lie and one of these fails.
describe('EARTH_SIDE_VENUE — races the Moon does not settle', () => {
  const marked = Object.keys(EARTH_SIDE_VENUE)
  const nightShift = sharedGoalById(SEED_ATLAS, 'shared-night-shift')

  it('marks Night Shift, and nothing else', () => {
    expect(marked).to.deep.equal(['shared-night-shift'])
    expect(earthSideVenue('shared-night-shift')?.chip).to.match(/Earth/)
    expect(earthSideVenue('shared-next-landing')).to.equal(undefined)
    expect(earthSideVenue(null)).to.equal(undefined)
  })

  it('only marks goals that exist', () => {
    for (const id of marked) {
      expect(sharedGoalById(SEED_ATLAS, id), id).to.exist
    }
  })

  // The panel renders the region pin and the Earth card in the same slot. A
  // goal carrying both would claim a patch of lunar ground and an Earth
  // chamber in consecutive lines.
  it('never marks a goal that also claims somewhere on the Moon', () => {
    for (const id of marked) {
      const goal = sharedGoalById(SEED_ATLAS, id)!
      expect(goal.location, `${id} cannot be marked AND sited`).to.equal(undefined)
      expect(goal.regionLabel, `${id} cannot be marked AND sited`).to.equal(
        undefined
      )
    }
  })

  // The justification, not a restatement of it. If the bar ever becomes a
  // surface demonstration, this race belongs on the globe and the Earth-side
  // treatment has to go.
  it('marks it because the bar really is an Earth chamber test', () => {
    const env = nightShift!.criteria?.find((c) => c.id === 'environment')
    expect(env?.threshold).to.match(/100 K/)
    expect(env?.threshold).to.match(/torr/)
    const unplug = nightShift!.criteria?.find((c) => c.id === 'unplug')
    expect(unplug?.statement).to.match(/chamber boundary/)
    expect(nightShift!.description).to.match(/vacuum chamber/)
  })

  // Absence would be least noticed on exactly the race that can least afford
  // it: one of the four we ship, sitting in "Racing now" with no district
  // while its three neighbours have one each.
  it('is a shipping race, which is why silence would not do', () => {
    for (const id of marked) {
      expect(LADDER_GOAL_IDS, `${id} is marked but not on the ladder`).to.include(
        id
      )
    }
  })

  // Every ladder race is either on the ground or explained. A fifth state —
  // on the ladder, off the globe, unexplained — is the gap this closes.
  //
  // "On the ground" is asked of the base plan, not of the dataset's
  // coordinates. Almost nothing here carries real coordinates: the colony
  // layout sites a competitor by its hardware TYPE and lets the street plan
  // decide where, which is why First Tracks' five rovers stand in a district
  // without one of them having a lat/lon. So the question that actually
  // separates Night Shift from the rest is whether BASE_PLAN zones the kind
  // of hardware a race fields at all — and it zones no district for `other`,
  // which is every one of Night Shift's seven.
  it('leaves no shipping race both off the globe and unexplained', () => {
    for (const id of LADDER_GOAL_IDS) {
      const goal = sharedGoalById(SEED_ATLAS, id)
      if (!goal) continue
      const couldStand = goal.projectIds.some((pid) => {
        const type = SEED_ATLAS.projects.find((p) => p.id === pid)?.type
        return type ? Boolean(BASE_PLAN[type]) : false
      })
      expect(
        couldStand || Boolean(earthSideVenue(id)),
        `${id} fields nothing the base plan can site, and says nowhere it happens instead`
      ).to.equal(true)
    }
  })

  // The other direction. Night Shift is marked because its field is entirely
  // hardware the settlement has no district for; if that ever stops being
  // true the race can stand somewhere and the marking should go.
  it('marks only races the base plan cannot site', () => {
    for (const id of marked) {
      for (const pid of sharedGoalById(SEED_ATLAS, id)!.projectIds) {
        const type = SEED_ATLAS.projects.find((p) => p.id === pid)?.type
        expect(BASE_PLAN[type!], `${pid} (${type}) has a district`).to.equal(
          undefined
        )
      }
    }
  })
})
