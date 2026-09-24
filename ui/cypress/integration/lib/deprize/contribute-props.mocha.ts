/**
 * Prize 2 on Sepolia is Juicebox project 270, mission 16 on the DePrize-only
 * MissionCreator. That row is not in the app-wide mission table.
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
    expect(extra).to.include('0xa692eEd67c4D2C1C73DC0515240d27cf7d6fF9D1')
  })
})
