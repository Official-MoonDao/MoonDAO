// VotingEscrow.balanceOf(addr, _t) extrapolates from the voter's LATEST
// checkpoint and reverts when that checkpoint is newer than `_t` (the
// `_t - last_point.ts` subtraction underflows). A voter who touches their
// lock after a vote's reference time therefore reads as a failed call,
// which callers record as 0 vMOONEY. These helpers recompute the balance
// from the checkpoint that was in effect at `_t`, using the same
// `bias - slope * (t - ts)` formula as the contract.

export type VotingEscrowPoint = {
  bias: bigint
  slope: bigint
  ts: bigint
}

export function biasAtTimestamp(point: VotingEscrowPoint, timestamp: bigint): bigint {
  if (point.ts > timestamp) return BigInt(0)
  const bias = point.bias - point.slope * (timestamp - point.ts)
  return bias > BigInt(0) ? bias : BigInt(0)
}

// Checkpoint epochs are 1-indexed and their timestamps are non-decreasing,
// so binary search for the last epoch with ts <= timestamp.
export async function findPointAtOrBefore(
  latestEpoch: number,
  timestamp: bigint,
  readPoint: (epoch: number) => Promise<VotingEscrowPoint>
): Promise<VotingEscrowPoint | null> {
  let lo = 1
  let hi = latestEpoch
  let found: VotingEscrowPoint | null = null
  while (lo <= hi) {
    const mid = Math.floor((lo + hi) / 2)
    const point = await readPoint(mid)
    if (point.ts <= timestamp) {
      found = point
      lo = mid + 1
    } else {
      hi = mid - 1
    }
  }
  return found
}

export async function vMooneyWeiAtTimestamp(
  latestEpoch: number,
  timestamp: bigint,
  readPoint: (epoch: number) => Promise<VotingEscrowPoint>
): Promise<bigint> {
  if (latestEpoch <= 0) return BigInt(0)
  const point = await findPointAtOrBefore(latestEpoch, timestamp, readPoint)
  return point ? biasAtTimestamp(point, timestamp) : BigInt(0)
}
