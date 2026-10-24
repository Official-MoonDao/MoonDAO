/// <reference types="node" />

/**
 * A forecast signature can confirm after the viewer switches wallets.
 * Local saved-pick state has to stay with the wallet on screen, or Undo
 * deletes the new wallet's row.
 */
import fs from 'fs'
import path from 'path'
import { sameForecastSession } from '@/lib/forecasts/forecastSession'

const UI_ROOT = path.resolve(__dirname, '../../../../')

function readUi(...parts: string[]): string {
  return fs.readFileSync(path.join(UI_ROOT, ...parts), 'utf8')
}

const STARTED = { address: '0xAbC', chainSlug: 'arbitrum', deprizeId: 4 }

describe('sameForecastSession', () => {
  it('matches the signer regardless of checksum', () => {
    expect(
      sameForecastSession({ address: '0xabc', chainSlug: 'arbitrum', deprizeId: 4 }, STARTED)
    ).to.equal(true)
  })

  it('rejects a wallet switch so the new wallet does not inherit the saved pick', () => {
    expect(
      sameForecastSession({ address: '0xBBB', chainSlug: 'arbitrum', deprizeId: 4 }, STARTED)
    ).to.equal(false)
  })

  it('rejects a prize or chain change', () => {
    expect(
      sameForecastSession({ address: '0xabc', chainSlug: 'arbitrum', deprizeId: 5 }, STARTED)
    ).to.equal(false)
    expect(
      sameForecastSession({ address: '0xabc', chainSlug: 'sepolia', deprizeId: 4 }, STARTED)
    ).to.equal(false)
  })

  it('rejects a missing address', () => {
    expect(
      sameForecastSession({ address: '', chainSlug: 'arbitrum', deprizeId: 4 }, STARTED)
    ).to.equal(false)
    expect(
      sameForecastSession(
        { address: '0xabc', chainSlug: 'arbitrum', deprizeId: 4 },
        { address: null, chainSlug: 'arbitrum', deprizeId: 4 }
      )
    ).to.equal(false)
  })
})

describe('forecast writers gate local pick updates', () => {
  const files = ['lib/forecasts/useForecastPredict.ts', 'components/deprize/ForecastPanel.tsx']

  for (const file of files) {
    it(`${file} checks the session before storing a saved pick`, () => {
      const src = readUi(file)
      const commitAt = src.indexOf('async function commitPick')
      const clearAt = src.indexOf('async function clearPick')
      expect(commitAt).to.be.greaterThan(-1)
      expect(clearAt).to.be.greaterThan(commitAt)
      const commit = src.slice(commitAt, clearAt)
      const clear = src.slice(clearAt, src.indexOf('async function', clearAt + 1))
      expect(commit).to.match(/sameForecastSession\(sessionRef\.current, started\)/)
      expect(clear).to.match(/sameForecastSession\(sessionRef\.current, started\)/)
      const commitGuard = commit.indexOf('sameForecastSession(sessionRef.current, started)')
      const commitSave = commit.indexOf('setSavedPick(index)')
      expect(commitGuard).to.be.greaterThan(-1)
      expect(commitSave).to.be.greaterThan(commitGuard)
      const clearGuard = clear.indexOf('sameForecastSession(sessionRef.current, started)')
      const clearSave = clear.indexOf('setSavedPick(null)')
      expect(clearGuard).to.be.greaterThan(-1)
      expect(clearSave).to.be.greaterThan(clearGuard)
    })
  }
})
