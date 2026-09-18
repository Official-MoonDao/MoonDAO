/// <reference types="node" />
/**
 * Acceptance: the old off-chain forecast stack is actually gone.
 *
 * Predictions are now Citizen votes in the deployed Votes.sol table. Redis, the
 * HSM relayer mirror, the pseudonymous handle and the revision history have no
 * role left, and a half-finished migration that leaves both paths alive is
 * worse than either one. These assertions exist to make that impossible to miss.
 */
import fs from 'fs'
import path from 'path'

const UI_ROOT = path.resolve(__dirname, '../../../../')
const REPO_ROOT = path.resolve(UI_ROOT, '..')

const uiPath = (...parts: string[]) => path.join(UI_ROOT, ...parts)
const repoPath = (...parts: string[]) => path.join(REPO_ROOT, ...parts)
const uiExists = (...parts: string[]) => fs.existsSync(uiPath(...parts))
const readUi = (...parts: string[]) => fs.readFileSync(uiPath(...parts), 'utf8')

function listSourceFiles(dir: string, acc: string[] = []): string[] {
  if (!fs.existsSync(dir)) return acc
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name)
    if (entry.isDirectory()) listSourceFiles(full, acc)
    else if (/\.(ts|tsx)$/.test(entry.name)) acc.push(full)
  }
  return acc
}

describe('deprize forecast teardown', () => {
  it('removes the Redis-era forecast modules', () => {
    for (const file of [
      'lib/forecasts/store.ts',
      'lib/forecasts/identity.ts',
      'lib/forecasts/displayName.ts',
      'lib/forecasts/tablelandMirror.ts',
      'lib/forecasts/schema.ts',
    ]) {
      expect(uiExists(file), `${file} should be deleted`).to.equal(false)
    }
  })

  it('removes the forecast write routes and keeps only the cached read', () => {
    for (const route of [
      'pages/api/forecasts/submit.ts',
      'pages/api/forecasts/mine.ts',
      'pages/api/forecasts/me.ts',
      'pages/api/forecasts/crowd.ts',
    ]) {
      expect(uiExists(route), `${route} should be deleted`).to.equal(false)
    }
    expect(
      uiExists('pages/api/forecasts/consensus.ts'),
      'consensus.ts is the one surviving forecast route'
    ).to.equal(true)
  })

  it('drops the bespoke Forecasts contract in favour of Votes.sol', () => {
    expect(fs.existsSync(repoPath('subscription-contracts/src/tables/Forecasts.sol'))).to.equal(
      false
    )
    expect(fs.existsSync(repoPath('subscription-contracts/script/Forecasts.s.sol'))).to.equal(false)
    expect(
      fs.existsSync(repoPath('subscription-contracts/src/tables/Votes.sol')),
      'Votes.sol is the table predictions now live in'
    ).to.equal(true)
  })

  it('replaces the FORECASTS_TABLE_* config with a reserved voteId range', () => {
    const config = readUi('const/config.ts')
    expect(config).to.not.match(/FORECASTS_TABLE_ADDRESSES/)
    expect(config).to.not.match(/FORECASTS_TABLE_NAMES/)
    expect(config).to.match(/DEPRIZE_FORECAST_VOTE_ID_BASE/)

    const base = config.match(/DEPRIZE_FORECAST_VOTE_ID_BASE\s*=\s*(\d+)/)
    expect(base, 'DEPRIZE_FORECAST_VOTE_ID_BASE must be a literal number').to.not.equal(null)
    expect(Number(base![1])).to.be.at.least(1000)
  })

  it('retires the off-chain rate limiting that gas now provides', () => {
    const constants = readUi('lib/forecasts/constants.ts')
    for (const dead of [
      'FORECAST_COOLDOWN_MS',
      'FORECAST_MAX_ENTRIES_PER_UTC_DAY',
      'FORECAST_CROWD_MIN',
    ]) {
      expect(constants, `${dead} should be gone`).to.not.match(new RegExp(dead))
    }
    expect(constants).to.match(/FORECAST_DAO_MIN_PARTICIPANTS/)
  })

  it('removes time-averaged scoring along with the history it consumed', () => {
    expect(readUi('lib/forecasts/brier.ts')).to.not.match(/timeAveragedBrier/)
    // The existing spec imports it statically; leaving that behind aborts the run.
    expect(
      readUi('cypress/integration/lib/forecasts/brier.cy.ts'),
      'brier.cy.ts must drop its time-averaged cases'
    ).to.not.match(/timeAveragedBrier/)
  })

  it('leaves no forecast code depending on Redis or the identity pepper', () => {
    const files = [
      ...listSourceFiles(uiPath('lib/forecasts')),
      ...listSourceFiles(uiPath('pages/api/forecasts')),
    ]
    expect(files.length).to.be.greaterThan(0)
    for (const file of files) {
      const src = fs.readFileSync(file, 'utf8')
      expect(src, `${file} should not use Redis`).to.not.match(/@upstash\/redis|UPSTASH_REDIS/)
      expect(src, `${file} should not use the identity pepper`).to.not.match(/FORECAST_ID_PEPPER/)
    }
  })

  it('adds the modules the new model runs on', () => {
    for (const file of [
      'lib/deprize/forecastVote.ts',
      'lib/deprize/fetchForecastConsensus.ts',
      'lib/forecasts/weighting.ts',
      'lib/forecasts/aggregate.ts',
      'lib/forecasts/pool.ts',
    ]) {
      expect(uiExists(file), `${file} should exist`).to.equal(true)
    }
  })
})
