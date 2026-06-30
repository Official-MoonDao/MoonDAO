export function unescapeQuotes(v: string) {
  return v.replace(/''/g, "'")
}

/**
 * Escape single quotes for an on-chain Tableland mutation.
 *
 * Tableland INSERTs are assembled on-chain with `SQLHelpers.quote()`, which only
 * wraps a value in single quotes and does NOT escape embedded quotes. An
 * unescaped `'` in any user field (e.g. a bio containing "Brazil's") produces
 * malformed SQL that the Tableland validator rejects — the NFT still mints, but
 * the metadata row is never created, permanently. Doubling the quote (`'` ->
 * `''`) is the SQLite-correct escape; SQLite stores it back as a single `'`.
 *
 * This is the same escape `cleanData()` applies on the profile-edit path; use it
 * for every free-text field passed to `mintTo`/`crossChainMint`/`freeMint`.
 */
export function escapeSingleQuotes(v: string): string {
  return typeof v === 'string' ? v.replace(/'/g, "''") : v
}

export default function cleanData(obj: any) {
  const formattedObj: any = {}

  for (const key in obj) {
    if (obj.hasOwnProperty(key)) {
      let formattedString = obj[key] // Directly assign obj[key] to formattedString

      // Check if the value is a string before attempting to replace
      if (typeof formattedString === 'string') {
        //Escape single quote with double single quotes
        formattedString = formattedString.replace(/'/g, "''")
        // Replace emojis with nothing
        formattedString = formattedString.replace(
          /([\u2700-\u27BF]|[\uE000-\uF8FF]|\uD83C[\uDC00-\uDFFF]|\uD83D[\uDC00-\uDFFF]|[\u2011-\u26FF]|\uD83E[\uDD10-\uDDFF])/g,
          '',
        )
      }

      // Add the key and the potentially modified value to the new object
      formattedObj[key] = formattedString
    }
  }

  return formattedObj
}
