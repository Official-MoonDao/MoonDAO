/**
 * vMOONEY at a past timestamp, recomputed from lock checkpoints.
 *
 * `VotingEscrow.balanceOf(addr, _t)` reverts when the voter's latest
 * checkpoint is newer than `_t`, and the tally path recorded that as 0
 * voting power. MDP-271 hit this: Moonshot voted Against with ~1.51M
 * vMOONEY at the reference time, then added to their lock four hours
 * later and read as 0. Fixture points below are Moonshot's real Arbitrum
 * `user_point_history` entries 5–7.
 */
import {
  biasAtTimestamp,
  findPointAtOrBefore,
  vMooneyWeiAtTimestamp,
  VotingEscrowPoint,
} from '../../../lib/tokens/vMooneyAtTimestamp'

const MDP_271_REFERENCE_TS = BigInt(1792279267)

const MOONSHOT_POINTS: Record<number, VotingEscrowPoint> = {
  5: {
    bias: BigInt('344722851159837994304250'),
    slope: BigInt('2736581288051750'),
    ts: BigInt(1786409169),
  },
  6: {
    bias: BigInt('1582996624656006681823572'),
    slope: BigInt('12566616803018772'),
    ts: BigInt(1786409199),
  },
  7: {
    bias: BigInt('1616259235805860212641208'),
    slope: BigInt('13459558712919119'),
    ts: BigInt(1792294968),
  },
}

function readerFor(points: Record<number, VotingEscrowPoint>) {
  const reads: number[] = []
  const read = async (epoch: number) => {
    reads.push(epoch)
    const point = points[epoch]
    if (!point) throw new Error(`no point at epoch ${epoch}`)
    return point
  }
  return { read, reads }
}

function filledHistory(latestEpoch: number): Record<number, VotingEscrowPoint> {
  const points: Record<number, VotingEscrowPoint> = {}
  for (let epoch = 1; epoch <= latestEpoch; epoch++) {
    points[epoch] = MOONSHOT_POINTS[epoch] ?? {
      bias: BigInt(0),
      slope: BigInt(0),
      ts: BigInt(1700000000 + epoch),
    }
  }
  return points
}

describe('vMooneyAtTimestamp', () => {
  it('uses the checkpoint in effect at the reference time, not a later one', async () => {
    const { read } = readerFor(filledHistory(7))
    const wei = await vMooneyWeiAtTimestamp(7, MDP_271_REFERENCE_TS, read)
    expect(wei.toString()).to.equal('1509229729492343884907076')
    expect(Math.sqrt(Number(wei) / 1e18)).to.be.closeTo(1228.507, 0.001)
  })

  it('returns the latest checkpoint when it predates the reference time', async () => {
    const { read } = readerFor(filledHistory(6))
    const point = await findPointAtOrBefore(6, MDP_271_REFERENCE_TS, read)
    expect(point).to.equal(MOONSHOT_POINTS[6])
  })

  it('returns 0 when the first lock is after the reference time', async () => {
    const { read } = readerFor({ 1: MOONSHOT_POINTS[7] })
    const wei = await vMooneyWeiAtTimestamp(1, MDP_271_REFERENCE_TS, read)
    expect(wei.toString()).to.equal('0')
  })

  it('returns 0 without reading when the voter has never locked', async () => {
    const { read, reads } = readerFor({})
    const wei = await vMooneyWeiAtTimestamp(0, MDP_271_REFERENCE_TS, read)
    expect(wei.toString()).to.equal('0')
    expect(reads).to.deep.equal([])
  })

  it('floors an expired lock at 0', () => {
    const farFuture = MOONSHOT_POINTS[6].ts + BigInt(10) * BigInt(365 * 24 * 60 * 60)
    expect(biasAtTimestamp(MOONSHOT_POINTS[6], farFuture).toString()).to.equal('0')
  })

  it('binary-searches long histories', async () => {
    const { read, reads } = readerFor(filledHistory(7))
    await findPointAtOrBefore(7, MDP_271_REFERENCE_TS, read)
    expect(reads.length).to.be.at.most(3)
  })
})
