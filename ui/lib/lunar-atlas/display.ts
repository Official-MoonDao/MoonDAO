// Presentation helpers for the atlas: human labels + colors for project types,
// milestone statuses, timeline states, and organization fallbacks. Pure (no
// React) so both the 3D layer and the HTML panels share one source of truth.

import type {
  MilestoneStatus,
  Organization,
  ProjectType,
  RosterStatus,
} from './types'
import type { ProjectTimeStatus } from './selectors'

export const PROJECT_TYPE_LABEL: Record<ProjectType, string> = {
  habitat: 'Habitat',
  lander: 'Lander',
  rover: 'Rover',
  isru_plant: 'ISRU plant',
  power: 'Power',
  comms_pnt: 'Comms / PNT',
  orbital: 'Orbital',
  construction: 'Surface construction',
  mass_driver: 'Mass driver',
  other: 'Other',
}

// A compact emoji glyph per type — cheap, legible iconography for markers and
// legends without shipping an icon set.
export const PROJECT_TYPE_GLYPH: Record<ProjectType, string> = {
  habitat: '🛖',
  lander: '🛬',
  rover: '🚙',
  isru_plant: '⚗️',
  power: '⚡',
  comms_pnt: '📡',
  orbital: '🛰',
  construction: '🧱',
  mass_driver: '🧲',
  other: '◆',
}

// Accent color per tech-tree category. Sites on the globe are category-level
// (one generic asset per tech tree), so they color by capability, not by
// organization — org brand colors take over once a specific competitor is
// selected.
export const PROJECT_TYPE_COLOR: Record<ProjectType, string> = {
  habitat: '#86efac', // green
  lander: '#67e8f9', // cyan
  rover: '#fcd34d', // amber
  isru_plant: '#c4b5fd', // violet
  power: '#fde047', // yellow
  comms_pnt: '#93c5fd', // blue
  orbital: '#a5b4fc', // indigo
  construction: '#f0abfc', // fuchsia — matches the race zone rings
  mass_driver: '#5eead4', // teal — freed up by the crewed_base/habitat merge
  other: '#d1d5db', // gray
}

// How a roster status reads to a visitor. "Listed" was curator jargon and
// looked like a confirmed entry; official / unofficial is the actual split.
export type ParticipationKind = 'official' | 'unofficial' | 'declined'

export function participationKind(
  status?: RosterStatus
): ParticipationKind | undefined {
  if (!status) return undefined
  if (status === 'consented') return 'official'
  if (status === 'declined') return 'declined'
  return 'unofficial'
}

export const PARTICIPATION_LABEL: Record<ParticipationKind, string> = {
  official: 'Official participant',
  unofficial: 'Unofficial — listed by MoonDAO, not confirmed',
  declined: 'Declined to participate',
}

export const ROSTER_STATUS_LABEL: Record<RosterStatus, string> = {
  listed: PARTICIPATION_LABEL.unofficial,
  invited: 'Unofficial — invited, awaiting a response',
  consented: PARTICIPATION_LABEL.official,
  declined: PARTICIPATION_LABEL.declined,
}

export const MILESTONE_STATUS_LABEL: Record<MilestoneStatus, string> = {
  planned: 'Planned',
  in_progress: 'In progress',
  achieved: 'Achieved',
  delayed: 'Delayed',
  cancelled: 'Cancelled',
}

// Tailwind class fragments for status chips (text + subtle bg/border).
export const MILESTONE_STATUS_CLASSES: Record<MilestoneStatus, string> = {
  planned: 'text-sky-200 bg-sky-500/15 border-sky-400/30',
  in_progress: 'text-amber-200 bg-amber-500/15 border-amber-400/30',
  achieved: 'text-emerald-200 bg-emerald-500/15 border-emerald-400/30',
  delayed: 'text-orange-200 bg-orange-500/15 border-orange-400/30',
  cancelled: 'text-rose-200 bg-rose-500/15 border-rose-400/30',
}

// How a timeline state modulates marker appearance.
export const TIME_STATUS_OPACITY: Record<ProjectTimeStatus, number> = {
  future: 0.12,
  planned: 0.85,
  achieved: 1,
  delayed: 0.7,
  cancelled: 0.35,
}

export function orgColor(org: Organization | undefined): string {
  return org?.brandColor ?? '#9ca3af'
}

export const LOCATION_PRECISION_LABEL: Record<string, string> = {
  exact: 'Exact location',
  approximate: 'Approximate location',
  region: 'Regional (target area)',
}

export function formatPlace(n: number): string {
  const v = Math.abs(n)
  const mod100 = v % 100
  const mod10 = v % 10
  const suffix =
    mod100 >= 11 && mod100 <= 13
      ? 'th'
      : mod10 === 1
        ? 'st'
        : mod10 === 2
          ? 'nd'
          : mod10 === 3
            ? 'rd'
            : 'th'
  return `${n}${suffix}`
}
