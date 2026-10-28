/**
 * DePrize prize pools are not in the public mission table.
 * Sepolia prize 2 is Juicebox project 270, mission 16.
 * Arbitrum Touchdown (DePrize 2) is Juicebox project 83, mission 1.
 */
import fs from 'fs'
import path from 'path'

const UI_ROOT = path.resolve(__dirname, '../../../../')

describe('launchpad contribute props', () => {
  const route = fs.readFileSync(
    path.join(UI_ROOT, 'pages/api/mission/contribute-props.ts'),
    'utf8'
  )
  const extra = fs.readFileSync(
    path.join(UI_ROOT, 'lib/deprize/extraMissionCreators.ts'),
    'utf8'
  )

  it('falls back to the DePrize mission creator when the public table has no row', () => {
    expect(route).to.include('findMissionByJuiceboxProject')
    expect(route).to.include('Promise.all')
    expect(extra).to.include('0xa692eEd67c4D2C1C73DC0515240d27cf7d6fF9D1')
    expect(extra).to.include('0xe103fBE8a0A04d6664755aDa6D2da3D66d3c394a')
    expect(extra).to.include('0x87307f5D73c93B5b0a2e250194d62CD2D4BfEe3B')
    expect(extra).to.include('0x6dB622369C46F9480915AE8394e6202C000D7CFb')
    expect(route).to.include('scanned.creator')
  })
})
