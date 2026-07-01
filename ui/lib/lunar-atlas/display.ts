// Presentation helpers for the atlas: human labels + colors for project types,
// milestone statuses, timeline states, and organization fallbacks. Pure (no
// React) so both the 3D layer and the HTML panels share one source of truth.

import type {
  MilestoneStatus,
  Organization,
  ProjectType,
} from './types'
import type { ProjectTimeStatus } from './selectors'

export const PROJECT_TYPE_LABEL: Record<ProjectType, string> = {
  crewed_base: 'Crewed base',
  habitat: 'Habitat',
  lander: 'Lander',
  rover: 'Rover',
  isru_plant: 'ISRU plant',
  power: 'Power',
  comms_pnt: 'Comms / PNT',
  orbital: 'Orbital',
  other: 'Other',
}

// A compact emoji glyph per type — cheap, legible iconography for markers and
// legends without shipping an icon set.
export const PROJECT_TYPE_GLYPH: Record<ProjectType, string> = {
  crewed_base: '🏛',
  habitat: '🛖',
  lander: '🛬',
  rover: '🚙',
  isru_plant: '⚗️',
  power: '⚡',
  comms_pnt: '📡',
  orbital: '🛰',
  other: '◆',
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
