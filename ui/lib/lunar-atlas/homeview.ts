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

// Standing at the edge of the settlement rather than surveying it from orbit:
// the eye is ~215 m from the core at drone height (~80 m), looking north-west
// across it.
//
// The colony is 190 m across and 240 m deep now that each race stands its whole
// field on the ground, and NOT trying to fit all of that in frame is deliberate.
// Backing off far enough to see the landing zone, the power district and the
// comms yard at once puts the eye ~400 m out, at which range a 4.5 m rover is a
// speck and the whole thing reads as a diorama. So the home shot frames the
// CORE and the near districts — habitat, rovers, construction, comms — with the
// 52 m Starship towering at the back of the pad road as the backdrop, and the
// two western districts falling off the left of frame. Opening a race flies to
// its district, which is how the rest is meant to be reached.
export const HOME_TARGET = ridgePoint(0, 20, CAP_CENTER_HEIGHT_M + 25)
export const HOME_CAM = ridgePoint(125, -155, CAP_CENTER_HEIGHT_M + 80)
