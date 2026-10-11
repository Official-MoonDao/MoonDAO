import { useMemo } from 'react'
import { stopFocus, type TourTarget } from '@/lib/home-tour/stops'
import { SEED_ATLAS } from '@/lib/lunar-atlas'
import { useSitedColony } from '@/lib/lunar-atlas/colonyLayout'
import { TIME_STATUS_OPACITY } from '@/lib/lunar-atlas/display'
import {
  atlasNowYear,
  datasetYearRange,
  projectDateRange,
  projectStateAtYear,
  raceArrivalYear,
} from '@/lib/lunar-atlas/selectors'
import type { Project } from '@/lib/lunar-atlas/types'
import type { MarkerStyle } from '@/components/lunar-atlas/MarkerLayer'
import MoonGlobeLazy from '@/components/lunar-atlas/MoonGlobeLazy'

export type TourGlobeProps = {
  target: TourTarget
  // Share of the base's arrivals standing on the surface, 0 to 1; null shows
  // it complete.
  build: number | null
  onReady?: () => void
}

export default function TourGlobe({ target, build, onReady }: TourGlobeProps) {
  const dataset = SEED_ATLAS
  const { layout, sitedTrees } = useSitedColony(
    dataset.projects,
    dataset.sharedGoals
  )

  const focus = useMemo(() => stopFocus(target, layout), [target, layout])

  const range = useMemo(() => datasetYearRange(dataset), [dataset])

  const raceYears = useMemo(() => {
    const now = atlasNowYear()
    const years = new Map<string, number | null>()
    for (const p of dataset.projects) {
      years.set(p.id, raceArrivalYear(p, dataset.sharedGoals, now))
    }
    return years
  }, [dataset.projects, dataset.sharedGoals])

  // Arrivals bunch into the last couple of years, so stepping the calendar
  // leaves the ground empty for most of the scroll and then fills it at once.
  // Revealing in arrival order instead puts sites down at an even pace. The
  // roads, lights and solar fields follow the construction race
  // (settlementPresence), so it goes first: otherwise the whole street grid
  // lands in a single step partway through.
  const arrivalRank = useMemo(() => {
    const now = atlasNowYear()
    const dated = dataset.projects
      .map((p) => ({
        id: p.id,
        first: p.type === 'construction' ? 0 : 1,
        at: projectDateRange(p, now, raceYears.get(p.id))?.earliest,
      }))
      .filter((d): d is { id: string; first: number; at: number } => d.at != null)
      .sort((a, b) => a.first - b.first || a.at - b.at)
    return new Map(dated.map((d, i) => [d.id, i]))
  }, [dataset.projects, raceYears])

  const revealed = build == null ? Infinity : Math.round(build * arrivalRank.size)

  const getProjectStyle = useMemo(
    () =>
      (project: Project): MarkerStyle => {
        const rank = arrivalRank.get(project.id)
        if (rank != null && rank >= revealed) {
          return { opacity: TIME_STATUS_OPACITY.future, visible: true }
        }
        const st = projectStateAtYear(
          project,
          range.max,
          atlasNowYear(),
          raceYears.get(project.id)
        )
        return { opacity: TIME_STATUS_OPACITY[st.status], visible: true }
      },
    [arrivalRank, revealed, range.max, raceYears]
  )

  return (
    <MoonGlobeLazy
      focus={focus}
      trees={sitedTrees}
      organizations={dataset.organizations}
      layout={layout}
      getProjectStyle={getProjectStyle}
      cinematic
      interactive={false}
      onReady={onReady}
    />
  )
}
