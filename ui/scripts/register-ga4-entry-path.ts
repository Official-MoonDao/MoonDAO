/**
 * Register the event-scoped GA4 custom dimension entry_path.
 * Never a CI step. Credentials come from the environment:
 *   GA4_PROPERTY_ID           numeric property id
 *   GA4_SERVICE_ACCOUNT_JSON  service account key, raw JSON or base64
 * The account needs Editor on the property.
 *
 *   yarn analytics:entry-path
 */

import path from 'path'
import dotenv from 'dotenv'
import { getMissingConfig } from '../lib/analytics/ga4DataApi'
import { ensureEntryPathDimension } from '../lib/analytics/ga4Admin'

dotenv.config({ path: path.resolve(__dirname, '../.env.local') })

async function main() {
  const missing = getMissingConfig()
  if (missing.length) {
    console.error(`Missing ${missing.join(' and ')}. Both are read from the environment.`)
    process.exit(1)
  }
  const result = await ensureEntryPathDimension()
  console.log(result.created ? 'Registered entry_path.' : 'entry_path was already registered.')
}

main().catch((err) => {
  const message = err instanceof Error ? err.message : 'Registration failed'
  console.error(message)
  process.exit(1)
})
