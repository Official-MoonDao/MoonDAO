// Generates one-time "magic link" invite tokens for citizen mints.
//
// Each token grants a single mint to whoever redeems it. The default is a
// fully sponsored (free) mint. --discount 20 or 50 makes the recipient pay the
// remainder while the relayer covers the discount. Tokens are stored in
// Upstash Redis (key `citizen:invite:<token>`) and consumed atomically at mint
// time by /api/mission/freeMint.
//
// Usage (from repo root or ui/):
//   node ui/scripts/create-citizen-invite.mjs [--count 5] [--label "ETHDenver"] \
//       [--ttl-days 30] [--discount 20|50|100] [--base-url https://moondao.com]
//
// --discount is the percent taken off the first year. 100 (the default) is a
// fully sponsored mint. 20 and 50 require the recipient to pay the remainder.
//
// Reads UPSTASH_REDIS_URL and UPSTASH_REDIS_TOKEN from ui/.env.local (or env).

import { randomBytes } from 'crypto'
import { readFileSync } from 'fs'
import { dirname, join } from 'path'
import { fileURLToPath } from 'url'

function loadEnvLocal() {
  const here = dirname(fileURLToPath(import.meta.url))
  const envPath = join(here, '..', '.env.local')
  const env = {}
  try {
    const raw = readFileSync(envPath, 'utf8')
    for (const line of raw.split('\n')) {
      const trimmed = line.trim()
      if (!trimmed || trimmed.startsWith('#')) continue
      const eq = trimmed.indexOf('=')
      if (eq === -1) continue
      const key = trimmed.slice(0, eq).trim()
      let value = trimmed.slice(eq + 1).trim()
      if (
        (value.startsWith('"') && value.endsWith('"')) ||
        (value.startsWith("'") && value.endsWith("'"))
      ) {
        value = value.slice(1, -1)
      }
      env[key] = value
    }
  } catch (err) {
    console.warn(`Could not read ${envPath}: ${err.message}`)
  }
  return env
}

function discountToBps(discount) {
  if (discount === undefined) return 1000
  const percent = Number(discount)
  if (percent === 20) return 200
  if (percent === 50) return 500
  if (percent === 100) return 1000
  throw new Error('--discount must be 20, 50, or 100')
}

function parseArgs(argv) {
  const args = { count: 1, label: undefined, ttlDays: 30, baseUrl: undefined, discount: undefined }
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i]
    if (a === '--count') args.count = parseInt(argv[++i], 10)
    else if (a === '--label') args.label = argv[++i]
    else if (a === '--ttl-days') args.ttlDays = parseInt(argv[++i], 10)
    else if (a === '--base-url') args.baseUrl = argv[++i]
    else if (a === '--discount') args.discount = argv[++i]
  }
  if (!Number.isFinite(args.count) || args.count < 1) args.count = 1
  if (!Number.isFinite(args.ttlDays) || args.ttlDays < 1) args.ttlDays = 30
  return args
}

async function main() {
  const { count, label, ttlDays, baseUrl, discount } = parseArgs(process.argv.slice(2))
  const discountBps = discountToBps(discount)
  const percentOff = discountBps / 10

  const env = loadEnvLocal()
  const url = process.env.UPSTASH_REDIS_URL || env.UPSTASH_REDIS_URL
  const token = process.env.UPSTASH_REDIS_TOKEN || env.UPSTASH_REDIS_TOKEN
  if (!url || !token) {
    console.error(
      'Missing UPSTASH_REDIS_URL or UPSTASH_REDIS_TOKEN (checked env and ui/.env.local).'
    )
    process.exit(1)
  }
  const linkBase =
    baseUrl ||
    process.env.NEXT_PUBLIC_BASE_URL ||
    env.NEXT_PUBLIC_BASE_URL ||
    'https://moondao.com'
  const ttlSeconds = ttlDays * 24 * 60 * 60

  const { Redis } = await import('@upstash/redis')
  const redis = new Redis({ url, token })

  const links = []
  for (let i = 0; i < count; i++) {
    const inviteToken = randomBytes(32).toString('base64url')
    const meta = {
      createdAt: Date.now(),
      ...(label ? { label } : {}),
      createdBy: 'create-citizen-invite-script',
      discountBps,
    }
    await redis.set(`citizen:invite:${inviteToken}`, meta, { ex: ttlSeconds })
    links.push(`${linkBase.replace(/\/$/, '')}/citizen?invite=${inviteToken}`)
  }

  console.log(
    `\nCreated ${count} citizen invite link${count > 1 ? 's' : ''}` +
      ` (${percentOff}% off${label ? `, label: ${label}` : ''}), valid for ${ttlDays} day${
        ttlDays > 1 ? 's' : ''
      }:\n`
  )
  for (const link of links) console.log(link)
  console.log('\nEach link can be redeemed exactly once.\n')
}

main().catch((err) => {
  console.error('Failed to create invite(s):', err)
  process.exit(1)
})
