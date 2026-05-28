/* eslint-disable no-console */
/**
 * LIVE sandbox integration check for the Coinbase Headless Onramp create-order
 * flow.
 *
 * This is the certainty check the unit/component tests can't provide: it makes a
 * REAL signed request to Coinbase's Headless Onramp API using your CDP
 * credentials, in SANDBOX mode (partnerUserRef prefixed with `sandbox-`, so no
 * card is ever charged). It validates, end to end:
 *
 *   1. The host + path are correct (no 404).
 *   2. The EdDSA JWT auth is accepted (no 401).
 *   3. Coinbase accepts our request body (field names / enums correct).
 *   4. The response matches the shape `extractOrderResult` parses.
 *
 * It deliberately reuses the SAME production helpers the API route uses
 * (`buildCreateOrderRequestBody`, `makeCDPRequest`, `extractOrderResult`) so a
 * green run means the real handler would work too.
 *
 * Usage:
 *   yarn onramp:sandbox-check
 *
 * Requires CB_API_KEY + CB_API_SECRET in ui/.env.local. Exits 0 on success,
 * 1 on failure, and 2 (skipped) when credentials are absent.
 */

import { config as loadEnv } from 'dotenv'
import path from 'path'

// Load ui/.env.local before importing anything that reads process.env.
loadEnv({ path: path.resolve(__dirname, '../.env.local') })

import {
  validateCDPCredentials,
  makeCDPRequest,
  CDP_HOST_V2,
} from '../lib/coinbase'
import {
  buildCreateOrderRequestBody,
  resolvePartnerUserRef,
  extractOrderResult,
  type CreateOrderInput,
} from '../lib/coinbase/headlessOrder'

const SKIP_EXIT = 2

async function main() {
  // --- credential guard (skip cleanly in CI without secrets) ---------------
  let credentials
  try {
    credentials = validateCDPCredentials()
  } catch {
    console.log(
      '\n⚠️  SKIPPED: CB_API_KEY / CB_API_SECRET not set in ui/.env.local.\n' +
        '   Add your CDP sandbox credentials to run the live check.\n'
    )
    process.exit(SKIP_EXIT)
  }

  // --- build a sandbox order via the real production helpers ---------------
  const nowIso = new Date().toISOString()
  const input: CreateOrderInput = {
    paymentAmount: 10,
    destinationAddress: '0x742d35Cc6634C0532925a3b844Bc454e4438f44e',
    destinationNetwork: 'base',
    email: 'sandbox-test@moondao.com',
    phoneNumber: '+12025550123', // any valid US format works in sandbox
    phoneNumberVerifiedAt: nowIso,
    partnerUserRef: 'moondao-sandbox-check',
    purchaseCurrency: 'USDC',
    paymentCurrency: 'USD',
    paymentMethod: 'GUEST_CHECKOUT_APPLE_PAY',
    agreementAcceptedAt: nowIso,
    // domain is only required for real (non-sandbox) iframe Apple Pay.
  }

  // Sandbox: force the sandbox- prefix regardless of NEXT_PUBLIC_MOCK_ONRAMP.
  const effectivePartnerUserRef = resolvePartnerUserRef(
    input.partnerUserRef as string,
    true
  )

  const requestBody = buildCreateOrderRequestBody(input, {
    effectivePartnerUserRef,
    // Omit clientIp: Coinbase rejects private/loopback IPs, and in sandbox we
    // don't have a real public IP. Production derives a real public IP from
    // request headers.
  })

  console.log('→ POST https://%s/platform/v2/onramp/orders', CDP_HOST_V2)
  console.log('  partnerUserRef:', effectivePartnerUserRef)
  console.log('  paymentMethod :', requestBody.paymentMethod)
  console.log('  destNetwork   :', requestBody.destinationNetwork)

  // --- make the REAL signed request ----------------------------------------
  let response: Response
  try {
    response = await makeCDPRequest(
      '/platform/v2/onramp/orders',
      'POST',
      requestBody,
      credentials,
      CDP_HOST_V2
    )
  } catch (err: any) {
    fail(`Network/JWT error before reaching Coinbase: ${err?.message || err}`)
    return
  }

  const text = await response.text()
  let data: any = {}
  try {
    data = text ? JSON.parse(text) : {}
  } catch {
    /* leave as raw text */
  }

  console.log('\n← HTTP', response.status)

  // --- interpret ------------------------------------------------------------
  if (response.status === 404) {
    fail(
      'HTTP 404 — the host/path is wrong. Expected ' +
        `https://${CDP_HOST_V2}/platform/v2/onramp/orders.\n` +
        '   Raw: ' +
        truncate(text)
    )
    return
  }
  if (response.status === 401 || response.status === 403) {
    fail(
      `HTTP ${response.status} — auth rejected. Check CB_API_KEY/CB_API_SECRET ` +
        'and that the JWT uri host matches the request host.\n   Raw: ' +
        truncate(text)
    )
    return
  }
  if (!response.ok) {
    fail(
      `HTTP ${response.status} — Coinbase rejected the request body. This ` +
        'usually means a field name/enum/value is wrong.\n   Raw: ' +
        truncate(text)
    )
    return
  }

  // 200/201 — verify the response shape our code relies on.
  const { paymentLinkUrl, orderId } = extractOrderResult(data)
  if (!paymentLinkUrl || !orderId) {
    fail(
      'Got a success status but extractOrderResult could not find ' +
        `paymentLink.url (${paymentLinkUrl}) or order.orderId (${orderId}). ` +
        'The response shape differs from what the app parses.\n   Raw: ' +
        truncate(text)
    )
    return
  }

  console.log('\n✅ SUCCESS — the headless create-order flow works end to end.')
  console.log('   orderId        :', orderId)
  console.log('   paymentLink.url:', paymentLinkUrl)
  console.log(
    '\nThis confirms: correct host/path, JWT auth accepted, request body ' +
      'accepted, and the response shape matches extractOrderResult.\n'
  )
  process.exit(0)
}

function truncate(s: string, n = 800): string {
  return s.length > n ? s.slice(0, n) + '…' : s
}

function fail(msg: string): void {
  console.error('\n❌ FAIL —', msg, '\n')
  process.exit(1)
}

main().catch((err) => fail(err?.stack || String(err)))
