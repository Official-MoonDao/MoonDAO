import { useMemo } from 'react'
import { stopFocus, type TourTarget } from '@/lib/home-tour/stops'
import { SEED_ATLAS } from '@/lib/lunar-atlas'
import { useSitedColony } from '@/lib/lunar-atlas/colonyLayout'
import { TIME_STATUS_OPACITY } from '@/lib/lunar-atlas/display'
import {
  atlasNowYear,
  datasetYearRange,
  projectStateAtYear,
  raceArrivalYear,
} from '@/lib/lunar-atlas/selectors'
import type { Project } from '@/lib/lunar-atlas/types'
import type { MarkerStyle } from '@/components/lunar-atlas/MarkerLayer'
import MoonGlobeLazy from '@/components/lunar-atlas/MoonGlobeLazy'

export type TourGlobeProps = {
  target: TourTarget
  // Calendar year the base is shown at; null shows it complete.
  year: number | null
  onReady?: () => void
}

export default function TourGlobe({ target, year, onReady }: TourGlobeProps) {
  const dataset = SEED_ATLAS
  const { layout, sitedTrees } = useSitedColony(
    dataset.projects,
    dataset.sharedGoals
  )

  const focus = useMemo(() => stopFocus(target, layout), [target, layout])

  const range = useMemo(() => datasetYearRange(dataset), [dataset])
  const sceneYear =
    year == null ? range.max : Math.min(range.max, Math.max(range.min, year))

  const raceYears = useMemo(() => {
    const now = atlasNowYear()
    const years = new Map<string, number | null>()
    for (const p of dataset.projects) {
      years.set(p.id, raceArrivalYear(p, dataset.sharedGoals, now))
    }
    return years
  }, [dataset.projects, dataset.sharedGoals])

  const getProjectStyle = useMemo(
    () =>
      (project: Project): MarkerStyle => {
        const st = projectStateAtYear(
          project,
          sceneYear,
          atlasNowYear(),
          raceYears.get(project.id)
        )
        return { opacity: TIME_STATUS_OPACITY[st.status], visible: true }
      },
    [sceneYear, raceYears]
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
