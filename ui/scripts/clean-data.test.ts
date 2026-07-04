import cleanData, {
  escapeSingleQuotes,
  formatCitizenLocationForTable,
  sanitizeTablelandField,
  stripEmojis,
  unescapeQuotes,
} from '../lib/tableland/cleanData'

function expectEqual<T>(actual: T, expected: T, label: string) {
  if (actual !== expected) {
    throw new Error(`${label}: expected ${String(expected)}, got ${String(actual)}`)
  }
}

// Regression guard: a botched merge once dropped stripEmojis /
// sanitizeTablelandField / formatCitizenLocationForTable from this module while
// leaving cleanData() (and CitizenMetadataModal) calling them, which threw a
// ReferenceError and broke every citizen/team mint and profile edit. These
// tests fail to even import if any of those exports go missing again.
describe('cleanData exports', () => {
  it('exposes every helper the mint / edit paths import', () => {
    expectEqual(typeof cleanData, 'function', 'cleanData')
    expectEqual(typeof escapeSingleQuotes, 'function', 'escapeSingleQuotes')
    expectEqual(typeof sanitizeTablelandField, 'function', 'sanitizeTablelandField')
    expectEqual(typeof formatCitizenLocationForTable, 'function', 'formatCitizenLocationForTable')
    expectEqual(typeof stripEmojis, 'function', 'stripEmojis')
    expectEqual(typeof unescapeQuotes, 'function', 'unescapeQuotes')
  })
})

describe('escapeSingleQuotes', () => {
  it("doubles a single quote so SQLHelpers.quote() yields valid SQL", () => {
    expectEqual(escapeSingleQuotes("Brazil's"), "Brazil''s", 'apostrophe')
  })

  it('normalizes smart/curly apostrophes to ASCII before escaping', () => {
    expectEqual(escapeSingleQuotes('Brazil\u2019s'), "Brazil''s", 'curly apostrophe')
  })

  it('returns empty string for non-string input', () => {
    // @ts-expect-error deliberately passing a non-string
    expectEqual(escapeSingleQuotes(undefined), '', 'undefined')
  })
})

describe('sanitizeTablelandField', () => {
  it('escapes quotes and strips emoji', () => {
    expectEqual(sanitizeTablelandField("d'Or 🚀"), "d''Or ", 'quote + emoji')
  })

  it('coerces null / undefined to an empty string (never throws)', () => {
    expectEqual(sanitizeTablelandField(null), '', 'null')
    expectEqual(sanitizeTablelandField(undefined), '', 'undefined')
  })
})

describe('formatCitizenLocationForTable', () => {
  it('produces JSON with an escaped name', () => {
    const json = formatCitizenLocationForTable(1, 2, "O'Brien")
    const parsed = JSON.parse(json)
    expectEqual(parsed.lat, 1, 'lat')
    expectEqual(parsed.lng, 2, 'lng')
    expectEqual(parsed.name, "O''Brien", 'escaped name')
  })
})

describe('cleanData', () => {
  it('sanitizes each string field without throwing (the merge regression)', () => {
    const out = cleanData({ name: "Brazil's", description: 'Space 🚀', view: 'public' })
    expectEqual(out.name, "Brazil''s", 'name')
    expectEqual(out.description, 'Space ', 'description')
    expectEqual(out.view, 'public', 'view')
  })
})
