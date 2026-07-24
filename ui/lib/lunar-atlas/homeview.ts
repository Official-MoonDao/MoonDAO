// The home ("load-in") framing of Moon Base Zero.
//
// This lives in lib rather than in MoonGlobe because two unrelated parts of
// the scene need the same viewpoint: the camera rig starts here, and the
// on-surface models yaw their presentation side toward it (see
// MODEL_FRONT_AZ in ProjectModel). Importing it from the globe component
// would make the model layer depend on its own parent.

import { latLonToVector3, type Vec3 } from './geo'
import {
  CAP_CENTER_HEIGHT_M,
  capOffsetLatLon,
  heightToRadius,
} from './southpole'

// A scene-space point at a map-frame offset (meters east/north of the ridge
// center) and a height in meters above the datum sphere.
export function ridgePoint(
  eastM: number,
  northM: number,
  heightM: number
): Vec3 {
  const ll = capOffsetLatLon(eastM, northM)
  return latLonToVector3(ll.lat, ll.lon, heightToRadius(heightM))
}

// Standing INSIDE the settlement, not surveying it: the eye is ~130 m from
// the hub at drone height (~45 m), so every asset fills real pixels at
// load-in, with the 52 m Starship on the back pad towering as the backdrop.
export const HOME_TARGET = ridgePoint(0, 15, CAP_CENTER_HEIGHT_M + 22)
export const HOME_CAM = ridgePoint(70, -90, CAP_CENTER_HEIGHT_M + 45)
