/**
 * Poll Tableland until the updated row is indexed so a page reload shows the
 * new image/details instead of the stale ones. Best-effort and time-bounded.
 */
export default async function waitForTablelandIndexed(
  tableName: string,
  tokenId: string,
  expected: { image: string; name: string; description: string },
): Promise<void> {
  if (!tableName) return

  const statement = `SELECT id, name, description, image FROM ${tableName} WHERE id = ${tokenId}`
  const baseUrl = `/api/tableland/query?statement=${encodeURIComponent(statement)}`
  const MAX_ATTEMPTS = 20
  const INTERVAL_MS = 3000

  for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt++) {
    try {
      // Add cache-busting parameter to prevent CDN from serving stale data
      const cacheBuster = `&_=${Date.now()}`
      const res = await fetch(baseUrl + cacheBuster)
      if (res.ok) {
        const rows = await res.json()
        const row = Array.isArray(rows) ? rows[0] : undefined
        if (
          row &&
          row.image === expected.image &&
          row.name === expected.name &&
          (row.description ?? '') === (expected.description ?? '')
        ) {
          return
        }
      }
    } catch (err) {
      console.warn('Error polling Tableland for updated data:', err)
    }
    await new Promise((resolve) => setTimeout(resolve, INTERVAL_MS))
  }
}
