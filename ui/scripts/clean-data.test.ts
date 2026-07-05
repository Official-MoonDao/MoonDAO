import { expect } from 'chai'
import cleanData, {
  escapeSingleQuotes,
  formatCitizenLocationForTable,
  sanitizeTablelandField,
  stripEmojis,
  unescapeQuotes,
} from '../lib/tableland/cleanData'

// Regression guard: a botched merge previously dropped several exports from
// cleanData.ts while keeping their call sites, breaking the TS build and
// throwing ReferenceError on every mint/onboarding/profile-edit path.
describe('tableland/cleanData exports', () => {
  it('exports all helpers consumed across the app', () => {
    expect(unescapeQuotes).to.be.a('function')
    expect(stripEmojis).to.be.a('function')
    expect(escapeSingleQuotes).to.be.a('function')
    expect(sanitizeTablelandField).to.be.a('function')
    expect(formatCitizenLocationForTable).to.be.a('function')
    expect(cleanData).to.be.a('function')
  })

  it('escapeSingleQuotes doubles quotes and normalizes curly apostrophes', () => {
    expect(escapeSingleQuotes("Brazil's")).to.equal("Brazil''s")
    expect(escapeSingleQuotes('Brazil\u2019s')).to.equal("Brazil''s")
    // @ts-expect-error non-string input handled defensively
    expect(escapeSingleQuotes(null)).to.equal('')
  })

  it('sanitizeTablelandField strips emoji, escapes quotes, and is null-safe', () => {
    expect(sanitizeTablelandField(null)).to.equal('')
    expect(sanitizeTablelandField(undefined)).to.equal('')
    expect(sanitizeTablelandField("O'Brien \uD83D\uDE80")).to.equal("O''Brien ")
  })

  it('formatCitizenLocationForTable emits sanitized JSON', () => {
    const out = formatCitizenLocationForTable(1, 2, "Cote d'Ivoire")
    const parsed = JSON.parse(out)
    expect(parsed.lat).to.equal(1)
    expect(parsed.lng).to.equal(2)
    expect(parsed.name).to.equal("Cote d''Ivoire")
  })

  it('default cleanData sanitizes every string field without throwing', () => {
    const result = cleanData({ name: "A's", count: 3, bio: null })
    expect(result.name).to.equal("A''s")
    expect(result.count).to.equal(3)
    expect(result.bio).to.equal(null)
  })

  it('unescapeQuotes reverses the on-chain escape', () => {
    expect(unescapeQuotes("Brazil''s")).to.equal("Brazil's")
  })
})
