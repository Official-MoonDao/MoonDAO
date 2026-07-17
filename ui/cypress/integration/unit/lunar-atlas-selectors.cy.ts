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
  datasetYearRange,
  filterProjects,
  indexRowsFromDataset,
  parseAtlasYear,
  projectDateRange,
  projectStateAtYear,
} from '../../../lib/lunar-atlas/selectors'
import type { Project } from '../../../lib/lunar-atlas/types'

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
    const p = makeProject({
      milestones: [
        { id: 'm1', title: 'demo', targetDate: '2026', datePrecision: 'year', status: 'planned', sources: [] },
        { id: 'm2', title: 'land', targetDate: '2029', datePrecision: 'year', status: 'planned', sources: [] },
      ],
    })

    it('hides the project before its earliest milestone', () => {
      const s = projectStateAtYear(p, 2024)
      expect(s.revealed).to.equal(false)
      expect(s.status).to.equal('future')
    })
    it('reveals the project once its first milestone year is reached', () => {
      const s = projectStateAtYear(p, 2026)
      expect(s.revealed).to.equal(true)
      expect(s.status).to.equal('planned')
      expect(s.activeMilestone?.id).to.equal('m1')
    })
    it('marks a project achieved when a reached milestone is achieved', () => {
      const a = makeProject({
        milestones: [
          { id: 'm', title: 'done', targetDate: '2023', datePrecision: 'year', status: 'achieved', sources: [] },
        ],
      })
      expect(projectStateAtYear(a, 2025).status).to.equal('achieved')
    })
    it('flags delayed and cancelled milestones once reached', () => {
      const delayed = makeProject({
        milestones: [
          { id: 'm', title: 'slip', targetDate: '2025', datePrecision: 'year', status: 'delayed', sources: [] },
        ],
      })
      const cancelled = makeProject({
        milestones: [
          { id: 'm', title: 'axed', targetDate: '2025', datePrecision: 'year', status: 'cancelled', sources: [] },
        ],
      })
      expect(projectStateAtYear(delayed, 2026).status).to.equal('delayed')
      expect(projectStateAtYear(cancelled, 2026).status).to.equal('cancelled')
    })
    it('treats undated projects as always-present planned', () => {
      const undated = makeProject({ milestones: [] })
      const s = projectStateAtYear(undated, 1999)
      expect(s.revealed).to.equal(true)
      expect(s.status).to.equal('planned')
    })
  })

  describe('date range helpers', () => {
    it('computes a project date range', () => {
      const p = makeProject({
        milestones: [
          { id: 'a', title: '', targetDate: '2026', datePrecision: 'year', status: 'planned', sources: [] },
          { id: 'b', title: '', targetDate: '2031', datePrecision: 'year', status: 'planned', sources: [] },
        ],
      })
      const r = projectDateRange(p)
      expect(r?.earliest).to.equal(2026)
      expect(r?.latest).to.equal(2031)
    })
    it('spans the whole seed dataset', () => {
      const { min, max } = datasetYearRange(SEED_ATLAS)
      expect(min).to.be.lessThan(max)
      expect(min).to.be.lessThan(2025)
      expect(max).to.be.greaterThan(2030)
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
      const base = filterProjects(projects, { sharedGoalId: 'shared-south-pole-base' })
      expect(base.length).to.be.greaterThan(1)
      expect(base.every((p) => p.sharedGoalIds.includes('shared-south-pole-base'))).to.equal(true)
    })
    it('finds the landing-pad race competitors', () => {
      const racers = filterProjects(projects, { sharedGoalId: 'shared-landing-pads' })
      expect(racers.length).to.be.greaterThan(2)
      expect(racers.every((p) => p.type === 'construction')).to.equal(true)
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
  })
})
