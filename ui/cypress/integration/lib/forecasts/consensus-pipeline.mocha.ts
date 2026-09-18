/// <reference types="node" />
/**
 * Acceptance: the consensus read follows the Fly with Frank pipeline.
 *
 * One Tableland SELECT, one batched balance read for every voter at once, one
 * batched Citizen lookup. Weight is recomputed live on read rather than
 * snapshotted at write time, which is why the cost is flat in the number of
 * voters instead of linear.
 */
import fs from 'fs'
import path from 'path'

const UI_ROOT = path.resolve(__dirname, '../../../../')
const uiPath = (...parts: string[]) => path.join(UI_ROOT, ...parts)
const uiExists = (...parts: string[]) => fs.existsSync(uiPath(...parts))
const readUi = (...parts: string[]) => fs.readFileSync(uiPath(...parts), 'utf8')

describe('deprize consensus pipeline', () => {
  let src = ''

  before(() => {
    if (!uiExists('lib/deprize/fetchForecastConsensus.ts')) {
      throw new Error(
        '[not implemented] ui/lib/deprize/fetchForecastConsensus.ts does not exist yet. ' +
          'Model it on ui/lib/overview-delegate/fetchLeaderboard.ts.'
      )
    }
    src = readUi('lib/deprize/fetchForecastConsensus.ts')
  })

  it('reads the votes for one prize out of the shared Votes table', () => {
    expect(src).to.match(/VOTES_TABLE_NAMES/)
    expect(src).to.match(/queryTable/)
    expect(src).to.match(/voteId/)
  })

  it('reads every voter\u2019s balance in one batch rather than per voter', () => {
    expect(src).to.match(/fetchTotalVMOONEYs|engineBatchRead/)
    // A per-voter await inside a loop is the thing this must not become.
    expect(src).to.not.match(/for\s*\([^)]*\)\s*\{[^}]*await\s+fetchTotalVMOONEYs/s)
  })

  it('falls back to the stored value only when the batch read failed', () => {
    expect(src).to.match(/Number\.isFinite|VMOONEY_UNAVAILABLE|resolveVmooney/)
  })

  it('joins Citizens in one batched lookup and drops everyone else', () => {
    expect(src).to.match(/buildCitizenOwnerLookupStatement|CITIZEN_TABLE_NAMES/)
    expect(src).to.match(/filterToCitizens|citizen/i)
  })

  it('computes weight on read instead of persisting it', () => {
    expect(src).to.match(/votingWeight|capWeights/)
    // Nothing here should be writing state back.
    expect(src).to.not.match(/insertIntoTable|updateTableCol|sendAndConfirmTransaction/)
  })

  it('serves the aggregate from a cacheable endpoint, since it is not geo-sensitive', () => {
    expect(uiExists('pages/api/forecasts/consensus.ts')).to.equal(true)
    const route = readUi('pages/api/forecasts/consensus.ts')
    expect(route).to.match(/setCDNCacheHeaders/)
    expect(route).to.match(/fetchForecastConsensus/)
  })
})
