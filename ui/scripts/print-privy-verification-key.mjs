// Prints your Privy app's ES256 auth-token verification key (a public key).
//
// Add the output to ui/.env.local as PRIVY_VERIFICATION_KEY so the server can
// verify Privy access tokens LOCALLY (offline) instead of fetching the JWKS
// from Privy on every request. That network fetch has no timeout and can stall
// the entire API route on flaky connectivity — which is what was hanging the
// citizen onboarding "Processing your profile" step.
//
// Usage (from repo root or ui/):
//   node ui/scripts/print-privy-verification-key.mjs
//
// It reads NEXT_PUBLIC_PRIVY_APP_ID and PRIVY_APP_SECRET from ui/.env.local.

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

async function main() {
  const env = loadEnvLocal()
  const appId =
    process.env.NEXT_PUBLIC_PRIVY_APP_ID || env.NEXT_PUBLIC_PRIVY_APP_ID
  const appSecret = process.env.PRIVY_APP_SECRET || env.PRIVY_APP_SECRET

  if (!appId || !appSecret) {
    console.error(
      'Missing NEXT_PUBLIC_PRIVY_APP_ID or PRIVY_APP_SECRET (checked env and ui/.env.local).'
    )
    process.exit(1)
  }

  const { PrivyClient } = await import('@privy-io/server-auth')
  const privy = new PrivyClient(appId, appSecret)
  const key = await privy.getVerificationKey()

  console.log('\nAdd this to ui/.env.local (keep the surrounding quotes):\n')
  // Encode newlines so it fits on a single env line; the SDK accepts the PEM
  // with literal \n sequences, but to be safe we print the raw PEM too.
  console.log(`PRIVY_VERIFICATION_KEY="${key.replace(/\n/g, '\\n')}"`)
  console.log('\nRaw PEM:\n')
  console.log(key)
}

main().catch((err) => {
  console.error('Failed to fetch verification key:', err)
  process.exit(1)
})
