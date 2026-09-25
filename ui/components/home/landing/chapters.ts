/**
 * The landing page reads as one narrative: hook, credibility, proof,
 * endorsement, how it works, a live mission, the road ahead, the ask.
 * Section order in `pages/index.tsx` follows this list, and ChapterRail
 * renders from it, so the two cannot drift apart.
 */
export type Chapter = {
  id: string
  label: string
}

export const LANDING_CHAPTERS: Chapter[] = [
  { id: 'landing-hero', label: 'Start' },
  { id: 'coverage', label: 'Coverage' },
  { id: 'track-record', label: 'Track Record' },
  { id: 'voices', label: 'Voices' },
  { id: 'network', label: 'The Network' },
  { id: 'governance', label: 'Governance' },
  { id: 'launchpad', label: 'Launchpad' },
  { id: 'live-mission', label: 'Live Mission' },
  { id: 'roadmap', label: 'Roadmap' },
  { id: 'join', label: 'Join' },
]
