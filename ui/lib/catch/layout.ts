/**
 * Starbase launch-site layout for Catch, in metres. Pure data: the renderer
 * builds the models from it and the physics will test debris and blast
 * against it. The surrounding country (shore, bays, roads, buildings, tanks)
 * is in siteMap.ts.
 *
 * Axes: x east (the Gulf is +x), y up, z south. The origin is on the ground
 * directly under the Pad 1 catch point.
 *
 * Sourced: tower 143 m (146 m with mast); ship 52.1 m x 9 m; booster about
 * 71 m x 9 m; the two pads about 370 m apart, south of the highway. Estimated
 * from photos: tower width, arm length and depth, mount sizes, catch heights.
 * Game licence: Pad 1 is turned so its arms reach west, toward a ship that
 * comes in over the production site; an overshoot ends in the Gulf.
 */

export const SHIP = {
  height: 52.1,
  radius: 4.5,
  /** Where the ogive nose begins, measured from the base. */
  noseBase: 34.5,
  /** Catch pins: height above the base (about 13 m below the nose tip). */
  catchY: 38.6,
  /** Catch pins stick out sideways (local +/-x), just under the forward flaps. */
  catchReach: 5.3,
}

export const BOOSTER = {
  height: 71,
  radius: 4.5,
  /** Catch pins sit just under the grid fins. */
  catchY: 65.5,
}

export const TOWER = {
  width: 12,
  height: 143,
  mastTop: 146,
  /** Tower centre to the catch point, along the arms. */
  catchDist: 34,
}

export const ARMS = {
  length: 36,
  /** Half the gap between the arm centre lines when closed on a vehicle. */
  pivotX: 5.7,
  /** Pivots stand this far out from the tower centre, toward the catch point. */
  pivotOut: TOWER.width / 2 + 1.5,
  rootDepth: 9,
  tipDepth: 2.6,
  /** Radians each arm swings outward when fully open. */
  openAngle: 0.62,
}

export type Pad = {
  /** Ground point under the catch position. */
  x: number
  z: number
  /** Unit vector from the tower toward the catch point: the way the arms reach. */
  ax: number
  az: number
  /** Height of the catch rails. */
  railY: number
}

/** Pad 1: the player's target. Its arms reach west, toward the incoming ship. */
export const PAD1: Pad = { x: 0, z: 0, ax: -1, az: 0, railY: 86 }
/** Pad 2: arms reach south. A booster hangs in them. */
export const PAD2: Pad = { x: -362, z: -70, ax: 0, az: 1, railY: 96 }

/** Launch mount: a square deck over a flame trench, centred under the catch point. */
export const MOUNT = {
  size: 24,
  top: 11.5,
}

export function towerCentre(p: Pad): { x: number; z: number } {
  return { x: p.x - p.ax * TOWER.catchDist, z: p.z - p.az * TOWER.catchDist }
}
