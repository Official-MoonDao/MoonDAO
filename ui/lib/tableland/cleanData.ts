export function unescapeQuotes(v: string) {
  return v.replace(/''/g, "'")
}

const EMOJI_REGEX =
  /([\u2700-\u27BF]|[\uE000-\uF8FF]|\uD83C[\uDC00-\uDFFF]|\uD83D[\uDC00-\uDFFF]|[\u2011-\u26FF]|\uD83E[\uDD10-\uDDFF])/g

/** Strip emoji from a user-facing string before on-chain storage. */
export function stripEmojis(v: string): string {
  return v.replace(EMOJI_REGEX, '')
}

/**
 * Escape single quotes for an on-chain Tableland mutation.
 *
 * Tableland UPDATE/INSERT SQL is assembled on-chain with `SQLHelpers.quote()`,
 * which wraps a value in single quotes and does NOT escape embedded quotes. An
 * unescaped `'` in any user field (e.g. a bio containing "Brazil's") produces
 * malformed SQL that the Tableland validator rejects — the NFT still mints, but
 * the metadata row is never created, permanently. Double the quote (`'` -> `''`)
 * so SQLite stores it back as a single `'`. Smart/curly apostrophes are
 * normalized to ASCII first.
 *
 * This is the same escape `cleanData()` applies on the profile-edit path; use it
 * for every free-text field passed to `mintTo`/`crossChainMint`/`freeMint`.
 */
export function escapeSingleQuotes(v: string): string {
  if (typeof v !== 'string') return ''
  const normalized = v.replace(/[\u2018\u2019\u0060]/g, "'")
  return normalized.replace(/'/g, "''")
}

/** Prepare one free-text field for a Tableland mutation payload. */
export function sanitizeTablelandField(v: unknown): string {
  if (v === null || v === undefined) return ''
  if (typeof v !== 'string') return escapeSingleQuotes(String(v))
  return escapeSingleQuotes(stripEmojis(v))
}

/** JSON location blob written to the citizen table `location` column. */
export function formatCitizenLocationForTable(
  lat: number,
  lng: number,
  name: string,
): string {
  return JSON.stringify({
    lat,
    lng,
    name: sanitizeTablelandField(name),
  })
}

export default function cleanData(obj: any) {
  const formattedObj: any = {}

  for (const key in obj) {
    if (obj.hasOwnProperty(key)) {
      let formattedString = obj[key] // Directly assign obj[key] to formattedString

      // Check if the value is a string before attempting to replace
      if (typeof formattedString === 'string') {
        formattedString = sanitizeTablelandField(formattedString)
      }

      // Add the key and the potentially modified value to the new object
      formattedObj[key] = formattedString
    }
  }

  return formattedObj
}
