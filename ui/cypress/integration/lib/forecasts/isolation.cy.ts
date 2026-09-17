import fs from 'fs'
import path from 'path'
import { assertForecastVersion, UnknownForecastSchemaError } from '@/lib/forecasts/schema'

const UI_ROOT = path.resolve(__dirname, '../../../../')
const API_DIR = path.join(UI_ROOT, 'pages/api/forecasts')
const EXPORT_SRC = fs.readFileSync(
  path.join(UI_ROOT, 'scripts/export-deprize-compliance-log.ts'),
  'utf8'
)

const ISOLATION_RE = /evaluateEligibility|runEligibilityChecks|walletFromSession|permit/

describe('forecast route isolation and schema', () => {
  it('source-level isolation: forecast routes do not import eligibility, session wallet, or permit', () => {
    const files = fs.existsSync(API_DIR)
      ? fs.readdirSync(API_DIR).filter((f) => f.endsWith('.ts'))
      : []
    expect(files.length).to.be.greaterThan(0)
    for (const file of files) {
      const text = fs.readFileSync(path.join(API_DIR, file), 'utf8')
      expect(ISOLATION_RE.test(text), file).to.equal(false)
    }
  })

  it('compliance-export boundary: scan patterns do not match forecast:*', () => {
    const matches = [...EXPORT_SRC.matchAll(/scanComplianceKeys\(\s*'([^']+)'\s*\)/g)].map(
      (m) => m[1]
    )
    expect(matches.length).to.be.greaterThan(0)
    for (const pattern of matches) {
      const prefix = pattern.replace(/\*$/, '')
      expect(prefix.startsWith('forecast:'), pattern).to.equal(false)
      expect('forecast:dev:sepolia:22:users'.startsWith(prefix)).to.equal(false)
    }
  })

  it('unknown schema version refuses rather than guessing', () => {
    expect(() => assertForecastVersion({ v: 2 })).to.throw(UnknownForecastSchemaError)
    expect(() => assertForecastVersion({ v: 1 })).to.not.throw()
    expect(() => assertForecastVersion({})).to.throw(UnknownForecastSchemaError)
  })
})
