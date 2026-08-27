/**
 * Lunar Atlas selectors (headless, mocha + chai).
 *
 * Covers date parsing, timeline reveal/dim derivation (the core of the year
 * scrubber), dataset year range, filtering, and the Tableland index projection.
 * Also asserts the bundled seed dataset is internally consistent.
 */

import { expect } from 'chai'
import { SEED_ATLAS } from '../../../lib/lunar-atlas/seed'
import {
  atlasYear,
  buildTechTrees,
  datasetYearRange,
  filterProjects,
  indexRowsFromDataset,
  isMoonMilestone,
  parseAtlasYear,
  projectDateRange,
  projectStateAtYear,
  raceArrivalYear,
} from '../../../lib/lunar-atlas/selectors'
import type {
  Milestone,
  Project,
  SharedGoal,
} from '../../../lib/lunar-atlas/types'

function makeProject(overrides: Partial<Project>): Project {
  return {
    id: 'p',
    orgId: 'org',
    name: 'P',
    type: 'lander',
    summary: '',
    locationPrecision: 'approximate',
    milestones: [],
    sharedGoalIds: [],
    sources: [],
    visibility: 'public',
    ...overrides,
  }
}

// A dated milestone. No `location`, so it counts as one at the Moon — the
// default the dataset relies on for landings and deliveries.
function ms(
  id: string,
  targetDate: string,
  status: Milestone['status']
): Milestone {
  return { id, title: id, targetDate, datePrecision: 'year', status, sources: [] }
}

// A capability race with a target window, entered by the project `ms` builds
// above. Only the window matters to the timeline.
function race(from: string, to: string): SharedGoal {
  return {
    id: 'race',
    title: 'race',
    description: '',
    projectIds: ['entrant'],
    category: 'lander',
    targetWindow: { from, to },
    sources: [],
  }
}

describe('lunar-atlas selectors', () => {
  describe('date parsing', () => {
    it('parses year, year-month, and full dates', () => {
      expect(atlasYear('2027')).to.equal(2027)
      expect(atlasYear('2027-09')).to.equal(2027)
      expect(atlasYear('2027-09-15')).to.equal(2027)
      expect(atlasYear('')).to.equal(null)
      expect(atlasYear(undefined)).to.equal(null)
    })
    it('orders months within a year via fractional years', () => {
      const jan = parseAtlasYear('2027-01') as number
      const dec = parseAtlasYear('2027-12') as number
      expect(dec).to.be.greaterThan(jan)
      expect(Math.floor(jan)).to.equal(2027)
    })
  })

  describe('projectStateAtYear (timeline reveal/dim)', () => {
    // "Now" is pinned for every case below. Whether a target date is a live
    // forecast or a date that has already slipped depends on the real year, so
    // a test that read the clock would quietly change meaning each January.
    const NOW = 2026

    const p = makeProject({
      milestones: [ms('m1', '2029', 'planned'), ms('m2', '2032', 'planned')],
    })

    it('hides the project before its first arrival', () => {
      const s = projectStateAtYear(p, 2028, NOW)
      expect(s.revealed).to.equal(false)
      expect(s.status).to.equal('future')
    })
    it('reveals the project once its arrival year is reached', () => {
      const s = projectStateAtYear(p, 2029, NOW)
      expect(s.revealed).to.equal(true)
      expect(s.status).to.equal('planned')
      expect(s.activeMilestone?.id).to.equal('m1')
    })
    it('marks a project achieved when its arrival actually happened', () => {
      const a = makeProject({ milestones: [ms('m', '2024', 'achieved')] })
      expect(projectStateAtYear(a, 2025, NOW).status).to.equal('achieved')
    })

    // The three ways the scrubber used to claim hardware was on the Moon when
    // it was not. Each of these is a bug report turned into a test.

    it('will not land a mission that has not flown', () => {
      // Targeted at the current year and still only planned: that is a slip,
      // not an arrival, so the Moon does not have it yet...
      const slipped = makeProject({ milestones: [ms('m', '2026', 'planned')] })
      expect(projectStateAtYear(slipped, 2026, NOW).revealed).to.equal(false)
      expect(projectStateAtYear(slipped, 2025, NOW).revealed).to.equal(false)
      // ...but it is still the plan for years genuinely ahead of us.
      expect(projectStateAtYear(slipped, 2027, NOW).revealed).to.equal(true)
    })

    it('will not stand a failed attempt up on the surface', () => {
      const crashed = makeProject({ milestones: [ms('m', '2023', 'cancelled')] })
      expect(projectStateAtYear(crashed, 2025, NOW).revealed).to.equal(false)
      expect(projectDateRange(crashed, NOW)).to.equal(null)
    })

    it('keeps a project with no date and no race off the surface entirely', () => {
      // Earth-side development with nothing on its way to the Moon on a date
      // anyone has named, and no race window to borrow one from.
      const undated = makeProject({ milestones: [] })
      const s = projectStateAtYear(undated, 2050, NOW)
      expect(s.revealed).to.equal(false)
      expect(s.status).to.equal('future')
    })

    // An undated entrant in a race that does have a window is a different
    // case: real hardware with no manifest. It turns up when its race expects
    // the field, so the race is not simply missing from the base.
    it('lands an undated entrant in the year its race expects it', () => {
      const undated = makeProject({ id: 'entrant', milestones: [] })
      const raceYear = raceArrivalYear(undated, [race('2028', '2032')], NOW)
      expect(raceYear).to.equal(2032)
      expect(
        projectStateAtYear(undated, 2031, NOW, raceYear).revealed
      ).to.equal(false)
      const s = projectStateAtYear(undated, 2032, NOW, raceYear)
      expect(s.revealed).to.equal(true)
      expect(s.status).to.equal('planned')
      // Nothing achieved it — there is no milestone to point at.
      expect(s.activeMilestone).to.equal(undefined)
    })

    it("prefers a project's own date over its race window", () => {
      const dated = makeProject({
        id: 'entrant',
        milestones: [ms('m', '2029', 'planned')],
      })
      const raceYear = raceArrivalYear(dated, [race('2028', '2032')], NOW)
      expect(projectStateAtYear(dated, 2029, NOW, raceYear).revealed).to.equal(
        true
      )
    })

    it('will not use a race window to resurrect a failed attempt', () => {
      // It has a date, it just did not survive it. The race window is for
      // hardware with no date at all, not for retrying a crash.
      const crashed = makeProject({
        id: 'entrant',
        milestones: [ms('m', '2023', 'cancelled')],
      })
      const raceYear = raceArrivalYear(crashed, [race('2028', '2032')], NOW)
      expect(projectStateAtYear(crashed, 2040, NOW, raceYear).revealed).to.equal(
        false
      )
    })

    it('ignores Earth-side milestones when deciding what is on the Moon', () => {
      const award = makeProject({
        milestones: [{ ...ms('award', '2023', 'achieved'), location: 'earth' }],
      })
      expect(projectStateAtYear(award, 2050, NOW).revealed).to.equal(false)
    })

    it('flags a delayed arrival and a cancelled follow-on', () => {
      const delayed = makeProject({ milestones: [ms('m', '2030', 'delayed')] })
      expect(projectStateAtYear(delayed, 2030, NOW).status).to.equal('delayed')
      // Hardware that did arrive and whose next step was then cancelled: it is
      // on the Moon, so it shows, but the programme stopping is the headline.
      const stopped = makeProject({
        milestones: [ms('a', '2024', 'achieved'), ms('b', '2030', 'cancelled')],
      })
      expect(projectStateAtYear(stopped, 2029, NOW).status).to.equal('achieved')
      expect(projectStateAtYear(stopped, 2030, NOW).status).to.equal('cancelled')
    })
  })

  describe('date range helpers', () => {
    const NOW = 2026

    it('computes a project date range', () => {
      const p = makeProject({
        milestones: [ms('a', '2029', 'planned'), ms('b', '2031', 'planned')],
      })
      const r = projectDateRange(p, NOW)
      expect(r?.earliest).to.equal(2029)
      expect(r?.latest).to.equal(2031)
    })

    it('pushes a date that has already slipped to the next open year', () => {
      const p = makeProject({ milestones: [ms('a', '2024', 'planned')] })
      expect(projectDateRange(p, NOW)?.earliest).to.equal(NOW + 1)
    })

    it('spans the whole seed dataset', () => {
      const { min, max } = datasetYearRange(SEED_ATLAS, NOW)
      expect(min).to.be.lessThan(max)
      expect(max).to.be.greaterThan(2030)
    })

    // The scrubber must open on the year of the first real arrival. Starting it
    // earlier gives you years of empty Moon to scrub through, or worse, years
    // furnished with hardware that was only ever announced.
    // How the page itself resolves state: own dates first, race window behind.
    const stateAt = (p: Project, year: number) =>
      projectStateAtYear(
        p,
        year,
        NOW,
        raceArrivalYear(p, SEED_ATLAS.sharedGoals, NOW)
      )

    // The scrubber opens on today. The years before it held one or two landers
    // and never changed between them, and everything those years did hold is
    // still standing at the left edge anyway.
    it('opens the scrubber on today', () => {
      const { min, max } = datasetYearRange(SEED_ATLAS, NOW)
      expect(min).to.equal(NOW)
      expect(max).to.be.greaterThan(min)
      // Whatever landed before today is still on the Moon in the opening year.
      const landedEarly = SEED_ATLAS.projects.filter((p) =>
        p.milestones.some(
          (m) =>
            m.status === 'achieved' &&
            isMoonMilestone(m) &&
            (atlasYear(m.targetDate) ?? Infinity) < NOW
        )
      )
      expect(landedEarly.length).to.be.greaterThan(0)
      for (const p of landedEarly) {
        expect(
          stateAt(p, min).revealed,
          `${p.id} landed before the window and is missing from its first year`
        ).to.equal(true)
      }
    })

    it('never hands out an empty range', () => {
      const stale = { projects: [], sharedGoals: [] }
      const { min, max } = datasetYearRange(stale, NOW)
      expect(max).to.be.greaterThan(min)
    })

    // What the scrubber says about today has to be history, not forecast.
    it('shows only hardware that really got there at the current year', () => {
      for (const p of SEED_ATLAS.projects) {
        if (!stateAt(p, NOW).revealed) continue
        const landed = p.milestones.some(
          (m) =>
            m.status === 'achieved' &&
            isMoonMilestone(m) &&
            (atlasYear(m.targetDate) ?? Infinity) <= NOW
        )
        expect(landed, `${p.id} is shown on the Moon without having landed`).to.equal(
          true
        )
      }
    })

    // The far end of the scrubber is the finished base, so everything in the
    // dataset has to stand somewhere on it. Tightening the arrival rule once
    // emptied the whole regolith-construction district, because none of that
    // field has a manifested lunar date and nothing was standing in for one.
    it('leaves nothing off the Moon at the end of the timeline', () => {
      const { max } = datasetYearRange(SEED_ATLAS, NOW)
      for (const p of SEED_ATLAS.projects) {
        expect(
          stateAt(p, max).revealed,
          `${p.id} never appears anywhere on the timeline`
        ).to.equal(true)
      }
    })
  })

  describe('filtering', () => {
    const projects = SEED_ATLAS.projects
    it('filters by organization', () => {
      const nasa = filterProjects(projects, { orgIds: ['nasa'] })
      expect(nasa.length).to.be.greaterThan(0)
      expect(nasa.every((p) => p.orgId === 'nasa')).to.equal(true)
    })
    it('filters by shared goal membership', () => {
      const base = filterProjects(projects, { sharedGoalId: 'shared-habitat' })
      expect(base.length).to.be.greaterThan(1)
      expect(base.every((p) => p.sharedGoalIds.includes('shared-habitat'))).to.equal(true)
    })
    it('finds the landing-pad race competitors', () => {
      const racers = filterProjects(projects, { sharedGoalId: 'shared-landing-pads' })
      expect(racers.length).to.be.greaterThan(2)
      expect(racers.every((p) => p.type === 'construction')).to.equal(true)
    })
  })

  describe('tech trees (one surface site per capability category)', () => {
    const trees = buildTechTrees(SEED_ATLAS.projects, SEED_ATLAS.sharedGoals)

    it('groups every located surface project into exactly one tree', () => {
      const surface = SEED_ATLAS.projects.filter(
        (p) => p.location && p.type !== 'orbital'
      )
      const grouped = trees.flatMap((t) => t.projects.map((p) => p.id))
      expect(grouped.length).to.equal(surface.length)
      expect(new Set(grouped).size).to.equal(surface.length)
      for (const t of trees) {
        for (const p of t.projects) {
          expect(p.type, `project ${p.id} in tree ${t.category}`).to.equal(
            t.category
          )
        }
      }
    })

    it('excludes orbital and unlocated projects from surface sites', () => {
      const ids = new Set(trees.flatMap((t) => t.projects.map((p) => p.id)))
      expect(ids.has('nasa-gateway')).to.equal(false)
    })

    it('binds the race goal declared for a category', () => {
      const construction = trees.find((t) => t.category === 'construction')
      expect(construction?.goal?.id).to.equal('shared-landing-pads')
      const lander = trees.find((t) => t.category === 'lander')
      expect(lander?.goal?.id).to.equal('shared-crewed-lander')
    })

    it('falls back to a goal listing a member when no category race exists', () => {
      const orphan = makeProject({
        id: 'orphan',
        type: 'power',
        location: { lat: -89, lon: 0 },
      })
      const [tree] = buildTechTrees(
        [orphan],
        [
          {
            id: 'borrowed',
            title: 'A goal that lists the member but declares another category',
            description: '',
            projectIds: ['orphan'],
            category: 'isru_plant',
            sources: [],
          },
        ]
      )
      expect(tree.goal?.id).to.equal('borrowed')
    })

    // The seed itself should never need that fallback. A category whose site
    // borrows another category's race shows the wrong competitors behind its
    // marker — which is exactly what the power site did while fission surface
    // power was being scored inside the ISRU goal.
    it('gives every surface category in the seed its own declared race', () => {
      for (const tree of trees) {
        expect(tree.goal, `${tree.category} has no race`).to.not.equal(undefined)
        expect(tree.goal?.category, `${tree.category} borrowed ${tree.goal?.id}`).to.equal(
          tree.category
        )
      }
    })

    // Every entrant in a race has to be a member of the site that opens it,
    // otherwise the panel lists a competitor the globe can never show.
    it('keeps each race\'s competitors inside its own category', () => {
      for (const goal of SEED_ATLAS.sharedGoals) {
        if (!goal.category) continue
        for (const pid of goal.projectIds) {
          const p = SEED_ATLAS.projects.find((x) => x.id === pid)
          expect(p?.type, `${goal.id} -> ${pid}`).to.equal(goal.category)
        }
      }
    })

    it('anchors a site at its own race region, not a borrowed goal region', () => {
      const construction = trees.find((t) => t.category === 'construction')
      expect(construction?.location).to.deep.equal({ lat: -88, lon: 60 })
      // power borrows the ISRU goal (no location, different category) so it
      // must fall back to the member centroid, not any goal anchor.
      const power = trees.find((t) => t.category === 'power')
      expect(power).to.not.equal(undefined)
      expect(power!.location.lat).to.be.within(-90, 90)
      expect(power!.location.lon).to.be.within(-180, 180)
    })

    it('applies after filtering, so filtered-out categories have no site', () => {
      const landersOnly = filterProjects(SEED_ATLAS.projects, {
        types: ['lander'],
      })
      const filtered = buildTechTrees(landersOnly, SEED_ATLAS.sharedGoals)
      expect(filtered.length).to.equal(1)
      expect(filtered[0].category).to.equal('lander')
    })
  })

  describe('tableland index projection', () => {
    it('projects one row per project with lat/lon + date bounds', () => {
      const rows = indexRowsFromDataset(SEED_ATLAS, 'bafyTESTCID')
      expect(rows.length).to.equal(SEED_ATLAS.projects.length)
      for (const row of rows) {
        expect(row.cid).to.equal('bafyTESTCID')
        expect(row.projectId).to.be.a('string')
      }
    })
  })

  describe('seed dataset integrity', () => {
    it('every project references a real organization', () => {
      const orgIds = new Set(SEED_ATLAS.organizations.map((o) => o.id))
      for (const p of SEED_ATLAS.projects) {
        expect(orgIds.has(p.orgId), `project ${p.id} orgId`).to.equal(true)
      }
    })
    it('every shared-goal projectId references a real project, and vice versa', () => {
      const projectIds = new Set(SEED_ATLAS.projects.map((p) => p.id))
      for (const g of SEED_ATLAS.sharedGoals) {
        for (const pid of g.projectIds) {
          expect(projectIds.has(pid), `goal ${g.id} -> ${pid}`).to.equal(true)
        }
      }
      const goalIds = new Set(SEED_ATLAS.sharedGoals.map((g) => g.id))
      for (const p of SEED_ATLAS.projects) {
        for (const gid of p.sharedGoalIds) {
          expect(goalIds.has(gid), `project ${p.id} -> ${gid}`).to.equal(true)
        }
      }
    })
    it('every project and milestone carries at least one source', () => {
      for (const p of SEED_ATLAS.projects) {
        expect(p.sources.length, `project ${p.id}`).to.be.greaterThan(0)
        for (const m of p.milestones) {
          expect(m.sources.length, `milestone ${m.id}`).to.be.greaterThan(0)
        }
      }
    })
    it('roster statuses, when present, are valid values', () => {
      const valid = new Set(['listed', 'invited', 'consented', 'declined'])
      for (const p of SEED_ATLAS.projects) {
        if (p.rosterStatus !== undefined) {
          expect(valid.has(p.rosterStatus), `project ${p.id} rosterStatus`).to.equal(true)
        }
      }
    })
    it('every competitor in a race (goal with criteria) declares a roster status', () => {
      const projectMap = new Map(SEED_ATLAS.projects.map((p) => [p.id, p]))
      for (const g of SEED_ATLAS.sharedGoals) {
        if (!g.criteria?.length) continue
        for (const pid of g.projectIds) {
          const p = projectMap.get(pid)
          expect(p?.rosterStatus, `race ${g.id} competitor ${pid}`).to.be.a('string')
        }
      }
    })
    it('capability criteria are well-formed and goals with criteria are sourced', () => {
      for (const g of SEED_ATLAS.sharedGoals) {
        if (!g.criteria) continue
        expect(g.criteria.length, `goal ${g.id} criteria`).to.be.greaterThan(0)
        expect(g.sources.length, `goal ${g.id} sources`).to.be.greaterThan(0)
        const ids = new Set<string>()
        for (const c of g.criteria) {
          expect(c.id, `criterion in ${g.id}`).to.be.a('string').and.not.equal('')
          expect(c.statement, `criterion ${c.id}`).to.be.a('string').and.not.equal('')
          expect(ids.has(c.id), `duplicate criterion id ${c.id} in ${g.id}`).to.equal(false)
          ids.add(c.id)
        }
      }
    })
    it('race goals with a globe anchor have valid coordinates and a region label', () => {
      for (const g of SEED_ATLAS.sharedGoals) {
        if (!g.location) continue
        expect(g.location.lat, `goal ${g.id} lat`).to.be.within(-90, 90)
        expect(g.location.lon, `goal ${g.id} lon`).to.be.within(-180, 180)
        expect(g.regionLabel, `goal ${g.id} regionLabel`).to.be.a('string').and.not.equal('')
      }
    })
    it('market payout splits sum to 1', () => {
      for (const g of SEED_ATLAS.sharedGoals) {
        const split = g.market?.payoutSplit
        if (!split) continue
        expect(split.capability + split.flight, `goal ${g.id} payoutSplit`).to.be.closeTo(1, 1e-9)
      }
    })
    it('a goal that declares a race category lists competitors of that category', () => {
      const projectMap = new Map(SEED_ATLAS.projects.map((p) => [p.id, p]))
      for (const g of SEED_ATLAS.sharedGoals) {
        if (!g.category) continue
        const ofCategory = g.projectIds.filter(
          (pid) => projectMap.get(pid)?.type === g.category
        )
        expect(
          ofCategory.length,
          `goal ${g.id} has no ${g.category} competitor`
        ).to.be.greaterThan(0)
      }
    })
    it('at most one goal declares each race category', () => {
      const seen = new Map<string, string>()
      for (const g of SEED_ATLAS.sharedGoals) {
        if (!g.category) continue
        expect(
          seen.has(g.category),
          `category ${g.category} raced by ${seen.get(g.category)} and ${g.id}`
        ).to.equal(false)
        seen.set(g.category, g.id)
      }
    })
  })
})
