// Line-icon mapping for capability-race categories. Replaces emoji glyphs
// (fine for the 3D globe's legend, but out of place next to real currency
// figures and buttons) with the same icon set used across the rest of the
// app's UI chrome.

import {
  BeakerIcon,
  BoltIcon,
  GlobeAltIcon,
  MagnifyingGlassIcon,
  HomeModernIcon,
  RocketLaunchIcon,
  SignalIcon,
  Square3Stack3DIcon,
  TruckIcon,
  WrenchScrewdriverIcon,
} from '@heroicons/react/24/outline'
import type { ComponentType, SVGProps } from 'react'
import { PROJECT_TYPE_GLYPH } from '@/lib/lunar-atlas/display'
import type { ProjectType } from '@/lib/lunar-atlas/types'

const CATEGORY_ICON: Record<
  Exclude<ProjectType, 'mass_driver'>,
  ComponentType<SVGProps<SVGSVGElement>>
> = {
  habitat: HomeModernIcon,
  lander: RocketLaunchIcon,
  rover: TruckIcon,
  isru_plant: BeakerIcon,
  power: BoltIcon,
  comms_pnt: SignalIcon,
  orbital: GlobeAltIcon,
  construction: WrenchScrewdriverIcon,
  prospecting: MagnifyingGlassIcon,
  other: Square3Stack3DIcon,
}

export default function CategoryIcon({
  category,
  className = 'w-5 h-5',
}: {
  category: ProjectType
  className?: string
}) {
  if (category === 'mass_driver') {
    return (
      <span className="text-base leading-none" aria-hidden>
        {PROJECT_TYPE_GLYPH.mass_driver}
      </span>
    )
  }
  const Icon = CATEGORY_ICON[category] ?? Square3Stack3DIcon
  return <Icon className={className} aria-hidden />
}
