import cleanData, {
  escapeSingleQuotes,
  formatCitizenLocationForTable,
  sanitizeTablelandField,
  unescapeQuotes,
} from '../lib/tableland/cleanData'

function expectEqual<T>(actual: T, expected: T, label: string) {
  if (actual !== expected) {
    throw new Error(`${label}: expected ${JSON.stringify(expected)}, got ${JSON.stringify(actual)}`)
  }
}

describe('escapeSingleQuotes', () => {
  it('doubles single quotes', () => {
    expectEqual(escapeSingleQuotes("O'Brien"), "O''Brien", 'apostrophe in name')
  })

  it('leaves strings without quotes unchanged', () => {
    expectEqual(escapeSingleQuotes('Alice'), 'Alice', 'no quotes')
  })

  it('handles multiple apostrophes', () => {
    expectEqual(escapeSingleQuotes("it's Brazil's"), "it''s Brazil''s", 'multiple')
  })

  it('handles empty string', () => {
    expectEqual(escapeSingleQuotes(''), '', 'empty')
  })

  it('passes non-strings through unchanged', () => {
    expectEqual(escapeSingleQuotes(42 as any), 42 as any, 'number passthrough')
  })
})

describe('sanitizeTablelandField', () => {
  it('is exported and callable', () => {
    if (typeof sanitizeTablelandField !== 'function') {
      throw new Error('sanitizeTablelandField must be a function')
    }
  })

  it('produces the same result as escapeSingleQuotes', () => {
    const inputs = ["O'Brien", "Brazil's coast", 'no apostrophe', '', "''already doubled''"]
    for (const input of inputs) {
      expectEqual(
        sanitizeTablelandField(input),
        escapeSingleQuotes(input),
        `sanitizeTablelandField("${input}")`
      )
    }
  })
})

describe('unescapeQuotes', () => {
  it('converts doubled quotes back to single', () => {
    expectEqual(unescapeQuotes("O''Brien"), "O'Brien", 'unescape')
  })

  it('round-trips through escape then unescape', () => {
    const original = "Brazil's"
    expectEqual(unescapeQuotes(escapeSingleQuotes(original)), original, 'round-trip')
  })
})

describe('cleanData', () => {
  it('sanitizes all string values in an object', () => {
    const result = cleanData({ name: "O'Brien", bio: "Loves Brazil's beaches" })
    expectEqual(result.name, "O''Brien", 'name escaped')
    expectEqual(result.bio, "Loves Brazil''s beaches", 'bio escaped')
  })

  it('passes non-string values through unchanged', () => {
    const result = cleanData({ lat: 51.5, lng: -0.1, active: true })
    expectEqual(result.lat, 51.5, 'lat')
    expectEqual(result.lng, -0.1, 'lng')
    expectEqual(result.active, true, 'active')
  })

  it('handles an empty object', () => {
    const result = cleanData({})
    expectEqual(Object.keys(result).length, 0, 'empty object')
  })

  it('does not mutate the original object', () => {
    const input = { name: "O'Brien" }
    cleanData(input)
    expectEqual(input.name, "O'Brien", 'original unchanged')
  })
})

describe('formatCitizenLocationForTable', () => {
  it('is exported and callable', () => {
    if (typeof formatCitizenLocationForTable !== 'function') {
      throw new Error('formatCitizenLocationForTable must be a function')
    }
  })

  it('returns valid JSON with lat, lng, and name', () => {
    const result = formatCitizenLocationForTable(51.5074, -0.1278, 'London, UK')
    const parsed = JSON.parse(result)
    expectEqual(parsed.lat, 51.5074, 'lat')
    expectEqual(parsed.lng, -0.1278, 'lng')
    expectEqual(parsed.name, 'London, UK', 'name')
  })

  it('sanitizes single quotes in the location name', () => {
    const result = formatCitizenLocationForTable(48.8566, 2.3522, "Côte d'Ivoire")
    const parsed = JSON.parse(result)
    expectEqual(parsed.name, "Côte d''Ivoire", 'name escaped')
  })

  it('handles zero coordinates (no-geocode sentinel)', () => {
    const result = formatCitizenLocationForTable(0, 0, 'Remote')
    const parsed = JSON.parse(result)
    expectEqual(parsed.lat, 0, 'lat zero')
    expectEqual(parsed.lng, 0, 'lng zero')
    expectEqual(parsed.name, 'Remote', 'name')
  })
})
