import { orgColor } from '@/lib/lunar-atlas/display'
import { M_TO_UNITS } from '@/lib/lunar-atlas/southpole'
import { buriedVault } from '@/lib/lunar-atlas/subplan'
import type { AtlasDataset, Project } from '@/lib/lunar-atlas/types'
import { spanForRadius, type ItemKind, type Rot } from '@/lib/my-moonbase/grid'
import { isPredictableRace } from '@/lib/my-moonbase/picks'
import {
  SAME_VEHICLE,
  displayFootprintRadiusM,
  displaySizeM,
  projectScale,
} from '@/components/lunar-atlas/ProjectModel'

export type BuilderTool = 'select' | 'place' | 'road' | 'erase'

/** The item riding the pointer until it is dropped on the plot. */
export type PendingPlacement = {
  kind: ItemKind
  ref: string
  span: number
  rot: Rot
  /** Set when an item already on the plot is being moved rather than added. */
  moveId?: string
}

export type CameraFocus = {
  /** Where to look, in meters from the plot centre. */
  xM: number
  zM: number
  /** How far back to stand, in meters. */
  distM: number
  /** Changes on every request, so asking for the same spot twice flies twice. */
  nonce: number
}

export type AssetInfo = {
  project: Project
  /** The project whose model is drawn. Differs for a later flight of a vehicle already modelled. */
  modelProject: Project
  orgName: string
  /** Organization colour, for the model's accents. */
  accent: string
  /** Scene meters per model unit. */
  scale: number
  /** Footprint edge in cells. */
  span: number
  /** Largest dimension as drawn, in meters. */
  sizeM: number
}

/** Every atlas project that stands in a race someone can predict. */
export function buildAssetCatalog(dataset: AtlasDataset): Map<string, AssetInfo> {
  const orgs = new Map(dataset.organizations.map((org) => [org.id, org]))
  const raced = new Set(
    dataset.sharedGoals.filter(isPredictableRace).flatMap((goal) => goal.projectIds)
  )
  const byId = new Map(dataset.projects.map((project) => [project.id, project]))
  const catalog = new Map<string, AssetInfo>()
  for (const project of dataset.projects) {
    if (!raced.has(project.id)) continue
    const org = orgs.get(project.orgId)
    // IM-4 flies the Nova-C that IM-3 does. Draw that vehicle, not the generic lander.
    const modelProject = byId.get(SAME_VEHICLE[project.id] ?? '') ?? project
    const sizeM = displaySizeM(modelProject)
    // Moon Base Zero buries two habitats under a mound and spaces them by that
    // earthwork. Here the module stands on the surface, so it takes only the
    // ground the module itself covers.
    const radiusM = buriedVault(modelProject.id)
      ? sizeM / 2
      : displayFootprintRadiusM(modelProject)
    catalog.set(project.id, {
      project,
      modelProject,
      orgName: org?.name ?? '',
      accent: orgColor(org),
      // The atlas scales models for a globe measured in Moon radii. This scene
      // is measured in meters.
      scale: projectScale(modelProject) / M_TO_UNITS,
      span: spanForRadius(radiusM),
      sizeM,
    })
  }
  return catalog
}
