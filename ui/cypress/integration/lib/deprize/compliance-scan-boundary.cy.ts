import fs from 'fs'
import path from 'path'

const EXPORT_SRC = fs.readFileSync(
  path.resolve(__dirname, '../../../../scripts/export-deprize-compliance-log.ts'),
  'utf8'
)

describe('compliance export scan boundary', () => {
  const matches = [...EXPORT_SRC.matchAll(/scanComplianceKeys\(\s*'([^']+)'\s*\)/g)].map(
    (m) => m[1]
  )

  it('scans only deprize: keys', () => {
    expect(matches.length).to.be.greaterThan(0)
    for (const pattern of matches) {
      expect(pattern.startsWith('deprize:'), pattern).to.equal(true)
      expect(pattern.startsWith('forecast:'), pattern).to.equal(false)
      expect(pattern.includes('oddswire'), pattern).to.equal(false)
      expect(pattern.startsWith('@upstash/ratelimit'), pattern).to.equal(false)
    }
  })

  it('does not match forecast or rate-limit prefixes', () => {
    const wouldMatch = (pattern: string, key: string) => {
      const prefix = pattern.replace(/\*$/, '')
      return key.startsWith(prefix)
    }
    for (const pattern of matches) {
      expect(wouldMatch(pattern, 'forecast:user:1')).to.equal(false)
      expect(wouldMatch(pattern, 'deprize:oddswire:latest')).to.equal(false)
      expect(wouldMatch(pattern, '@upstash/ratelimit:ip')).to.equal(false)
    }
  })
})
