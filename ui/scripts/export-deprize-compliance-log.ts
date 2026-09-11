/**
 * Monthly archive of DePrize compliance records.
 *
 * Prints newline-delimited JSON to stdout. Redirect to encrypted cold storage.
 * Never prints raw IP addresses, private keys, or Redis credentials.
 *
 *   yarn export:deprize-compliance
 */
import { getComplianceRedis, scanComplianceKeys } from '../lib/deprize/complianceStore'

type Row = { kind: string; key: string; value: unknown }

function assertNoSecrets(value: unknown): void {
  const text = JSON.stringify(value)
  if (!text) return
  if (/0x[a-fA-F0-9]{64}/.test(text)) {
    throw new Error('refusing to export a value that looks like a private key')
  }
  if (process.env.UPSTASH_REDIS_TOKEN && text.includes(process.env.UPSTASH_REDIS_TOKEN)) {
    throw new Error('refusing to export a Redis token')
  }
  if (process.env.DEPRIZE_COMPLIANCE_SIGNER_KEY) {
    const key = process.env.DEPRIZE_COMPLIANCE_SIGNER_KEY.replace(/^0x/, '')
    if (key && text.toLowerCase().includes(key.toLowerCase())) {
      throw new Error('refusing to export the compliance signer key')
    }
  }
}

function writeRow(row: Row): void {
  assertNoSecrets(row)
  process.stdout.write(`${JSON.stringify(row)}\n`)
}

async function main() {
  const cache = getComplianceRedis()
  if (!cache) {
    console.error('[deprize] export aborted: redis is not configured')
    process.exit(1)
  }

  const historyKeys = await scanComplianceKeys('deprize:accept:history:*')
  for (const key of historyKeys) {
    const values = await cache.lrange(key, 0, -1)
    for (const value of values) writeRow({ kind: 'acceptance', key, value })
  }

  const permitKeys = await scanComplianceKeys('deprize:permit:record:*')
  for (const key of permitKeys) {
    writeRow({ kind: 'permit', key, value: await cache.get(key) })
  }

  const observationKeys = await scanComplianceKeys('deprize:observation:history:*')
  for (const key of observationKeys) {
    const values = await cache.lrange(key, 0, -1)
    for (const value of values) writeRow({ kind: 'observation', key, value })
  }

  const deniedKeys = (await scanComplianceKeys('deprize:denied:*')).filter(
    (key) => key !== 'deprize:denied:audit'
  )
  for (const key of deniedKeys) {
    writeRow({ kind: 'denial', key, value: await cache.get(key) })
  }

  const audit = await cache.lrange('deprize:denied:audit', 0, -1)
  for (const value of audit) {
    writeRow({ kind: 'denial-audit', key: 'deprize:denied:audit', value })
  }
}

main().catch((err) => {
  console.error('[deprize] export failed', err)
  process.exit(1)
})
