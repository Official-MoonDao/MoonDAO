/**
 * Comprehensive unit tests for the Coinbase Headless Onramp migration.
 *
 * These cover the pure, security- and correctness-critical logic extracted from
 * the components and API route so they can run fast in Node (Mocha + Chai) with
 * no browser, no Next.js server, and no Coinbase calls:
 *
 *   1. create-order input validation (lib/coinbase/headlessOrder)
 *   2. region gating (US-only)
 *   3. sandbox partnerUserRef prefixing
 *   4. CDP request-body construction
 *   5. sandbox payment-link param injection
 *   6. chain -> network-name mapping (quote + onramp)
 *   7. postMessage onramp_api.* event -> UI status reducer
 *   8. phone verification 60-day staleness logic
 *
 * Run with: yarn test:cypress-unit  (after registering this spec in
 * scripts/.mocharc-cypress-unit.json)
 */

import {
  validateCreateOrderInput,
  isRegionAllowed,
  resolvePartnerUserRef,
  buildCreateOrderRequestBody,
  extractOrderResult,
  applySandboxParam,
  sanitizeClientIp,
  PHONE_E164_REGEX,
} from '../../../lib/coinbase/headlessOrder'
import {
  getQuoteNetworkName,
  getOnrampNetworkName,
  parseOnrampMessage,
  isCoinbaseOrigin,
  mapOnrampEvent,
} from '../../../lib/coinbase/headlessEvents'
import {
  computePhoneState,
  normalizePhoneE164,
  PHONE_REVERIFICATION_INTERVAL_MS,
} from '../../../lib/coinbase/usePhoneVerification'
import { shouldUseHeadlessOnramp } from '../../../lib/coinbase/useOnrampRegion'

declare const expect: Chai.ExpectStatic

const VALID_BODY = {
  paymentAmount: 25,
  destinationAddress: '0x1234567890123456789012345678901234567890',
  email: 'user@example.com',
  phoneNumber: '+12025550123',
  phoneNumberVerifiedAt: '2026-05-28T00:00:00.000Z',
  partnerUserRef: 'mission-0xabc',
  agreementAcceptedAt: '2026-05-28T00:00:00.000Z',
}

describe('Coinbase Headless Onramp — create-order validation', () => {
  it('accepts a fully valid body', () => {
    const result = validateCreateOrderInput(VALID_BODY)
    expect(result.ok).to.equal(true)
  })

  it('rejects when paymentAmount is missing', () => {
    const result = validateCreateOrderInput({ ...VALID_BODY, paymentAmount: undefined })
    expect(result.ok).to.equal(false)
    if (!result.ok) {
      expect(result.status).to.equal(400)
      expect(result.error).to.match(/paymentAmount and destinationAddress/)
    }
  })

  it('rejects when paymentAmount is zero (falsy)', () => {
    const result = validateCreateOrderInput({ ...VALID_BODY, paymentAmount: 0 })
    expect(result.ok).to.equal(false)
  })

  it('rejects when destinationAddress is missing', () => {
    const result = validateCreateOrderInput({ ...VALID_BODY, destinationAddress: undefined })
    expect(result.ok).to.equal(false)
  })

  it('rejects when email is missing', () => {
    const result = validateCreateOrderInput({ ...VALID_BODY, email: undefined })
    expect(result.ok).to.equal(false)
    if (!result.ok) expect(result.error).to.match(/email and phoneNumber/)
  })

  it('rejects when phoneNumber is missing', () => {
    const result = validateCreateOrderInput({ ...VALID_BODY, phoneNumber: undefined })
    expect(result.ok).to.equal(false)
  })

  it('rejects when partnerUserRef is missing', () => {
    const result = validateCreateOrderInput({ ...VALID_BODY, partnerUserRef: undefined })
    expect(result.ok).to.equal(false)
    if (!result.ok) expect(result.error).to.match(/partnerUserRef/)
  })

  it('rejects a non-E.164 phone number', () => {
    const result = validateCreateOrderInput({ ...VALID_BODY, phoneNumber: '2025550123' })
    expect(result.ok).to.equal(false)
    if (!result.ok) expect(result.error).to.match(/E\.164/)
  })

  it('rejects a phone number with formatting characters', () => {
    const result = validateCreateOrderInput({ ...VALID_BODY, phoneNumber: '+1 (202) 555-0123' })
    expect(result.ok).to.equal(false)
  })

  it('rejects when phoneNumberVerifiedAt is missing (required <60d)', () => {
    const result = validateCreateOrderInput({ ...VALID_BODY, phoneNumberVerifiedAt: undefined })
    expect(result.ok).to.equal(false)
    if (!result.ok) expect(result.error).to.match(/phoneNumberVerifiedAt/)
  })

  it('rejects when agreementAcceptedAt is missing', () => {
    const result = validateCreateOrderInput({ ...VALID_BODY, agreementAcceptedAt: undefined })
    expect(result.ok).to.equal(false)
    if (!result.ok) expect(result.error).to.match(/agreementAcceptedAt/)
  })

  it('accepts a valid GUEST_CHECKOUT payment method', () => {
    expect(
      validateCreateOrderInput({
        ...VALID_BODY,
        paymentMethod: 'GUEST_CHECKOUT_GOOGLE_PAY',
      }).ok
    ).to.equal(true)
  })

  it('defaults (undefined paymentMethod) are allowed', () => {
    expect(
      validateCreateOrderInput({ ...VALID_BODY, paymentMethod: undefined }).ok
    ).to.equal(true)
  })

  it('rejects an unknown payment method', () => {
    const result = validateCreateOrderInput({
      ...VALID_BODY,
      // deliberately invalid value coming from an untrusted client
      paymentMethod: 'CARD' as any,
    })
    expect(result.ok).to.equal(false)
    if (!result.ok) {
      expect(result.code).to.equal('INVALID_PAYMENT_METHOD')
      expect(result.error).to.match(/paymentMethod must be one of/)
    }
  })
})

describe('Coinbase Headless Onramp — E.164 regex', () => {
  it('accepts valid E.164 numbers', () => {
    expect(PHONE_E164_REGEX.test('+12025550123')).to.equal(true)
    expect(PHONE_E164_REGEX.test('+447911123456')).to.equal(true)
    expect(PHONE_E164_REGEX.test('+5')).to.equal(false) // too short (needs 2-15 digits after +)
  })

  it('rejects numbers starting with +0', () => {
    expect(PHONE_E164_REGEX.test('+02025550123')).to.equal(false)
  })

  it('rejects numbers without a leading +', () => {
    expect(PHONE_E164_REGEX.test('12025550123')).to.equal(false)
  })

  it('rejects numbers longer than 15 digits', () => {
    expect(PHONE_E164_REGEX.test('+1234567890123456')).to.equal(false)
  })
})

describe('Coinbase Headless Onramp — region gating (US only)', () => {
  it('allows US', () => {
    expect(isRegionAllowed('US')).to.equal(true)
  })

  it('blocks non-US countries', () => {
    expect(isRegionAllowed('CA')).to.equal(false)
    expect(isRegionAllowed('GB')).to.equal(false)
    expect(isRegionAllowed('MX')).to.equal(false)
  })

  it('blocks null/undefined country (fail closed)', () => {
    expect(isRegionAllowed(null)).to.equal(false)
    expect(isRegionAllowed(undefined)).to.equal(false)
  })

  it('is case-sensitive (lowercase us is not US)', () => {
    expect(isRegionAllowed('us')).to.equal(false)
  })
})

// Verified against the live API: Coinbase returns HTTP 400 "private IP
// addresses are not allowed" when a loopback/private clientIp is sent.
describe('Coinbase Headless Onramp — clientIp sanitization', () => {
  it('passes through a public IPv4 address', () => {
    expect(sanitizeClientIp('203.0.113.7')).to.equal('203.0.113.7')
  })

  it('drops IPv4 loopback', () => {
    expect(sanitizeClientIp('127.0.0.1')).to.equal(undefined)
  })

  it('drops 10.x / 172.16-31.x / 192.168.x private ranges', () => {
    expect(sanitizeClientIp('10.1.2.3')).to.equal(undefined)
    expect(sanitizeClientIp('172.16.5.5')).to.equal(undefined)
    expect(sanitizeClientIp('172.31.255.255')).to.equal(undefined)
    expect(sanitizeClientIp('192.168.0.1')).to.equal(undefined)
  })

  it('keeps 172.x outside the private 16-31 block', () => {
    expect(sanitizeClientIp('172.32.0.1')).to.equal('172.32.0.1')
    expect(sanitizeClientIp('172.15.0.1')).to.equal('172.15.0.1')
  })

  it('drops link-local and CGNAT ranges', () => {
    expect(sanitizeClientIp('169.254.1.1')).to.equal(undefined)
    expect(sanitizeClientIp('100.64.0.1')).to.equal(undefined)
  })

  it('drops IPv6 loopback and unique/link-local', () => {
    expect(sanitizeClientIp('::1')).to.equal(undefined)
    expect(sanitizeClientIp('fc00::1')).to.equal(undefined)
    expect(sanitizeClientIp('fe80::1')).to.equal(undefined)
  })

  it('keeps a public IPv6 address', () => {
    expect(sanitizeClientIp('2606:4700:4700::1111')).to.equal(
      '2606:4700:4700::1111'
    )
  })

  it('takes the first hop of an x-forwarded-for chain', () => {
    expect(sanitizeClientIp('203.0.113.7, 10.0.0.1, 192.168.1.1')).to.equal(
      '203.0.113.7'
    )
  })

  it('falls through to the next candidate when the first hop is private', () => {
    // x-forwarded-for whose first hop is private should yield undefined so the
    // handler can try x-real-ip / socket next.
    expect(sanitizeClientIp('10.0.0.1, 203.0.113.7')).to.equal(undefined)
  })

  it('strips a trailing :port from IPv4', () => {
    expect(sanitizeClientIp('203.0.113.7:54321')).to.equal('203.0.113.7')
  })

  it('handles IPv4-mapped IPv6 loopback', () => {
    expect(sanitizeClientIp('::ffff:127.0.0.1')).to.equal(undefined)
  })

  it('returns undefined for empty / nullish input', () => {
    expect(sanitizeClientIp('')).to.equal(undefined)
    expect(sanitizeClientIp(null)).to.equal(undefined)
    expect(sanitizeClientIp(undefined)).to.equal(undefined)
  })
})

describe('Coinbase Headless Onramp — sandbox partnerUserRef prefixing', () => {
  it('prefixes with sandbox- when mock is on', () => {
    expect(resolvePartnerUserRef('mission-0xabc', true)).to.equal('sandbox-mission-0xabc')
  })

  it('does not prefix when mock is off', () => {
    expect(resolvePartnerUserRef('mission-0xabc', false)).to.equal('mission-0xabc')
  })

  it('is idempotent — never double-prefixes', () => {
    expect(resolvePartnerUserRef('sandbox-mission-0xabc', true)).to.equal(
      'sandbox-mission-0xabc'
    )
  })
})

describe('Coinbase Headless Onramp — CDP request body', () => {
  it('formats paymentAmount to 2 decimals as a string', () => {
    const body = buildCreateOrderRequestBody(
      { ...VALID_BODY, paymentAmount: 25 },
      { effectivePartnerUserRef: 'ref' }
    )
    expect(body.paymentAmount).to.equal('25.00')
  })

  it('rounds paymentAmount to cents', () => {
    const body = buildCreateOrderRequestBody(
      { ...VALID_BODY, paymentAmount: 25.129 },
      { effectivePartnerUserRef: 'ref' }
    )
    expect(body.paymentAmount).to.equal('25.13')
  })

  it('applies sensible defaults for currency/network/method', () => {
    const body = buildCreateOrderRequestBody(VALID_BODY, {
      effectivePartnerUserRef: 'ref',
    })
    expect(body.purchaseCurrency).to.equal('ETH')
    expect(body.destinationNetwork).to.equal('base')
    expect(body.paymentCurrency).to.equal('USD')
    expect(body.paymentMethod).to.equal('GUEST_CHECKOUT_APPLE_PAY')
  })

  it('uses the supplied destinationNetwork when provided', () => {
    const body = buildCreateOrderRequestBody(
      { ...VALID_BODY, destinationNetwork: 'arbitrum' },
      { effectivePartnerUserRef: 'ref' }
    )
    expect(body.destinationNetwork).to.equal('arbitrum')
  })

  it('passes phoneNumberVerifiedAt + agreementAcceptedAt through', () => {
    const body = buildCreateOrderRequestBody(VALID_BODY, {
      effectivePartnerUserRef: 'ref',
    })
    expect(body.phoneNumberVerifiedAt).to.equal(VALID_BODY.phoneNumberVerifiedAt)
    expect(body.agreementAcceptedAt).to.equal(VALID_BODY.agreementAcceptedAt)
  })

  it('uses the effective (sandbox) partnerUserRef, not the raw one', () => {
    const body = buildCreateOrderRequestBody(VALID_BODY, {
      effectivePartnerUserRef: 'sandbox-mission-0xabc',
    })
    expect(body.partnerUserRef).to.equal('sandbox-mission-0xabc')
  })

  it('omits optional fields (domain, clientIp) when not provided', () => {
    const body = buildCreateOrderRequestBody(VALID_BODY, {
      effectivePartnerUserRef: 'ref',
    })
    expect(body).to.not.have.property('domain')
    expect(body).to.not.have.property('clientIp')
  })

  it('never sends non-API fields (country / subdivision / quoteId)', () => {
    const body = buildCreateOrderRequestBody(VALID_BODY, {
      effectivePartnerUserRef: 'ref',
    })
    expect(body).to.not.have.property('country')
    expect(body).to.not.have.property('subdivision')
    expect(body).to.not.have.property('quoteId')
    expect(body).to.not.have.property('purchaseNetwork')
  })

  it('includes domain + clientIp when provided', () => {
    const body = buildCreateOrderRequestBody(
      { ...VALID_BODY, domain: 'moondao.com' },
      { effectivePartnerUserRef: 'ref', clientIp: '1.2.3.4' }
    )
    expect(body.domain).to.equal('moondao.com')
    expect(body.clientIp).to.equal('1.2.3.4')
  })

  it('passes destinationAddress, email and phoneNumber through unchanged', () => {
    const body = buildCreateOrderRequestBody(VALID_BODY, {
      effectivePartnerUserRef: 'ref',
    })
    expect(body.destinationAddress).to.equal(VALID_BODY.destinationAddress)
    expect(body.email).to.equal(VALID_BODY.email)
    expect(body.phoneNumber).to.equal(VALID_BODY.phoneNumber)
  })
})

describe('Coinbase Headless Onramp — response extraction', () => {
  it('reads the documented nested { order, paymentLink } shape', () => {
    const { paymentLinkUrl, orderId } = extractOrderResult({
      order: { orderId: 'abc-123' },
      paymentLink: { url: 'https://pay.coinbase.com/v2/api-onramp/apple-pay?sessionToken=x' },
    })
    expect(orderId).to.equal('abc-123')
    expect(paymentLinkUrl).to.equal(
      'https://pay.coinbase.com/v2/api-onramp/apple-pay?sessionToken=x'
    )
  })

  it('tolerates flat/legacy fallbacks', () => {
    const a = extractOrderResult({ payment_link_url: 'u1', order_id: 'o1' })
    expect(a.paymentLinkUrl).to.equal('u1')
    expect(a.orderId).to.equal('o1')
    const b = extractOrderResult({ paymentLinkUrl: 'u2', orderId: 'o2' })
    expect(b.paymentLinkUrl).to.equal('u2')
    expect(b.orderId).to.equal('o2')
  })

  it('returns undefined for an empty/unknown response', () => {
    const { paymentLinkUrl, orderId } = extractOrderResult({})
    expect(paymentLinkUrl).to.equal(undefined)
    expect(orderId).to.equal(undefined)
  })
})

describe('Coinbase Headless Onramp — sandbox payment-link param', () => {
  it('appends useApplePaySandbox for Apple Pay when mock on', () => {
    const url = applySandboxParam('https://pay.coinbase.com/x', 'GUEST_CHECKOUT_APPLE_PAY', true)
    expect(url).to.equal('https://pay.coinbase.com/x?useApplePaySandbox=true')
  })

  it('appends useGooglePaySandbox for Google Pay when mock on', () => {
    const url = applySandboxParam('https://pay.coinbase.com/x', 'GUEST_CHECKOUT_GOOGLE_PAY', true)
    expect(url).to.equal('https://pay.coinbase.com/x?useGooglePaySandbox=true')
  })

  it('uses & when the url already has a query string', () => {
    const url = applySandboxParam('https://pay.coinbase.com/x?foo=bar', 'GUEST_CHECKOUT_APPLE_PAY', true)
    expect(url).to.equal('https://pay.coinbase.com/x?foo=bar&useApplePaySandbox=true')
  })

  it('returns the url unchanged when mock is off', () => {
    const url = applySandboxParam('https://pay.coinbase.com/x', 'GUEST_CHECKOUT_APPLE_PAY', false)
    expect(url).to.equal('https://pay.coinbase.com/x')
  })

  it('defaults to apple pay sandbox when method is undefined', () => {
    const url = applySandboxParam('https://pay.coinbase.com/x', undefined, true)
    expect(url).to.equal('https://pay.coinbase.com/x?useApplePaySandbox=true')
  })
})

describe('Coinbase Headless Onramp — quote network mapping', () => {
  it('maps base variants to base', () => {
    expect(getQuoteNetworkName({ name: 'Base' })).to.equal('base')
    expect(getQuoteNetworkName({ name: 'Base Sepolia' })).to.equal('base')
    expect(getQuoteNetworkName({ id: 8453 })).to.equal('base')
    expect(getQuoteNetworkName({ id: 84532 })).to.equal('base')
  })

  it('maps polygon to polygon', () => {
    expect(getQuoteNetworkName({ name: 'Polygon' })).to.equal('polygon')
    expect(getQuoteNetworkName({ id: 137 })).to.equal('polygon')
  })

  it('defaults unknown chains to ethereum', () => {
    expect(getQuoteNetworkName({ name: 'Arbitrum' })).to.equal('ethereum')
    expect(getQuoteNetworkName({})).to.equal('ethereum')
    expect(getQuoteNetworkName(null)).to.equal('ethereum')
  })
})

describe('Coinbase Headless Onramp — onramp network mapping', () => {
  it('maps ethereum/mainnet/sepolia to arbitrum (MoonDAO settles on Arbitrum)', () => {
    expect(getOnrampNetworkName({ name: 'Ethereum' })).to.equal('arbitrum')
    expect(getOnrampNetworkName({ name: 'Mainnet' })).to.equal('arbitrum')
    expect(getOnrampNetworkName({ name: 'Sepolia' })).to.equal('arbitrum')
  })

  it('maps arbitrum variants to arbitrum', () => {
    expect(getOnrampNetworkName({ name: 'Arbitrum' })).to.equal('arbitrum')
    expect(getOnrampNetworkName({ name: 'Arbitrum One' })).to.equal('arbitrum')
    expect(getOnrampNetworkName({ id: 42161 })).to.equal('arbitrum')
    expect(getOnrampNetworkName({ id: 421614 })).to.equal('arbitrum')
  })

  it('maps base/polygon/optimism correctly by name', () => {
    expect(getOnrampNetworkName({ name: 'Base' })).to.equal('base')
    expect(getOnrampNetworkName({ name: 'Polygon' })).to.equal('polygon')
    expect(getOnrampNetworkName({ name: 'Optimism' })).to.equal('optimism')
  })

  it('uses the id-based fallback only when a non-matching name is present', () => {
    // The outer switch runs on chainName; a non-matching name falls through to
    // the id-based inner switch.
    expect(getOnrampNetworkName({ name: 'OP', id: 10 })).to.equal('optimism')
    expect(getOnrampNetworkName({ name: 'OP Sepolia', id: 11155420 })).to.equal('optimism')
    expect(getOnrampNetworkName({ name: 'Base Mainnet x', id: 8453 })).to.equal('base')
  })

  it('id-only objects (no name) short-circuit to arbitrum via the ethereum default', () => {
    // Documented quirk: missing name => chainName defaults to "ethereum" =>
    // maps to "arbitrum" before the id switch is reached. Real chains in this
    // app always carry a name, so this path is not hit in production.
    expect(getOnrampNetworkName({ id: 10 })).to.equal('arbitrum')
    expect(getOnrampNetworkName({ id: 8453 })).to.equal('arbitrum')
  })

  it('falls back to ethereum for an unknown name + unknown id', () => {
    expect(getOnrampNetworkName({ name: 'Linea', id: 59144 })).to.equal('ethereum')
  })
})

describe('Coinbase Headless Onramp — postMessage parsing', () => {
  it('parses a JSON string payload', () => {
    const parsed = parseOnrampMessage(JSON.stringify({ eventName: 'onramp_api.load_success' }))
    expect(parsed?.eventName).to.equal('onramp_api.load_success')
  })

  it('passes through an object payload', () => {
    const parsed = parseOnrampMessage({ eventName: 'onramp_api.cancel' })
    expect(parsed?.eventName).to.equal('onramp_api.cancel')
  })

  it('returns null for malformed JSON', () => {
    expect(parseOnrampMessage('{not json')).to.equal(null)
  })

  it('returns null for non-object primitives', () => {
    expect(parseOnrampMessage(42)).to.equal(null)
    expect(parseOnrampMessage(null)).to.equal(null)
    expect(parseOnrampMessage(undefined)).to.equal(null)
  })

  it('returns null for primitive JSON strings (number/string/bool)', () => {
    expect(parseOnrampMessage('42')).to.equal(null)
    expect(parseOnrampMessage('"x"')).to.equal(null)
    expect(parseOnrampMessage('true')).to.equal(null)
    expect(parseOnrampMessage('null')).to.equal(null)
  })
})

describe('Coinbase Headless Onramp — postMessage origin allowlist', () => {
  it('accepts coinbase.com and subdomains', () => {
    expect(isCoinbaseOrigin('https://coinbase.com')).to.equal(true)
    expect(isCoinbaseOrigin('https://pay.coinbase.com')).to.equal(true)
  })

  it('rejects look-alike and unrelated origins', () => {
    expect(isCoinbaseOrigin('https://coinbase.com.evil.com')).to.equal(false)
    expect(isCoinbaseOrigin('https://notcoinbase.com')).to.equal(false)
    expect(isCoinbaseOrigin('https://evil.com')).to.equal(false)
    // cb-pay.com is intentionally NOT trusted: Coinbase's Headless Onramp
    // (and their reference app) serves the payment link from pay.coinbase.com,
    // and our CSP frame-src is scoped to *.coinbase.com.
    expect(isCoinbaseOrigin('https://cb-pay.com')).to.equal(false)
    expect(isCoinbaseOrigin('https://pay.cb-pay.com')).to.equal(false)
  })

  it('rejects empty / malformed origins', () => {
    expect(isCoinbaseOrigin('')).to.equal(false)
    expect(isCoinbaseOrigin(null)).to.equal(false)
    expect(isCoinbaseOrigin(undefined)).to.equal(false)
    expect(isCoinbaseOrigin('not a url')).to.equal(false)
  })
})

describe('Coinbase Headless Onramp — postMessage event reducer', () => {
  it('ignores non-onramp_api events', () => {
    const r = mapOnrampEvent({ eventName: 'some_other_event' }, 'idle')
    expect(r.ignored).to.equal(true)
    expect(r.status).to.equal(null)
  })

  it('ignores messages with no eventName', () => {
    const r = mapOnrampEvent({}, 'idle')
    expect(r.ignored).to.equal(true)
  })

  it('load_pending -> iframe-loading', () => {
    expect(mapOnrampEvent({ eventName: 'onramp_api.load_pending' }, 'creating').status).to.equal(
      'iframe-loading'
    )
  })

  it('load_success -> ready', () => {
    expect(
      mapOnrampEvent({ eventName: 'onramp_api.load_success' }, 'iframe-loading').status
    ).to.equal('ready')
  })

  it('load_error -> error with default message', () => {
    const r = mapOnrampEvent({ eventName: 'onramp_api.load_error' }, 'iframe-loading')
    expect(r.status).to.equal('error')
    expect(r.error).to.match(/Failed to initialize/)
  })

  it('load_error surfaces a server-provided message and code', () => {
    const r = mapOnrampEvent(
      {
        eventName: 'onramp_api.load_error',
        data: { errorMessage: 'Card declined', errorCode: 'CARD_DECLINED' },
      },
      'iframe-loading'
    )
    expect(r.error).to.equal('Card declined')
    expect(r.errorCode).to.equal('CARD_DECLINED')
  })

  it('commit_success -> polling', () => {
    expect(
      mapOnrampEvent({ eventName: 'onramp_api.commit_success' }, 'ready').status
    ).to.equal('polling')
  })

  it('commit_error -> error', () => {
    const r = mapOnrampEvent({ eventName: 'onramp_api.commit_error' }, 'ready')
    expect(r.status).to.equal('error')
    expect(r.error).to.match(/could not be started/)
  })

  it('cancel from ready -> ready (re-arm)', () => {
    expect(mapOnrampEvent({ eventName: 'onramp_api.cancel' }, 'ready').status).to.equal('ready')
  })

  it('cancel during polling -> no status change (does not clobber settlement)', () => {
    const r = mapOnrampEvent({ eventName: 'onramp_api.cancel' }, 'polling')
    expect(r.status).to.equal(null)
  })

  it('polling_start -> polling', () => {
    expect(
      mapOnrampEvent({ eventName: 'onramp_api.polling_start' }, 'ready').status
    ).to.equal('polling')
  })

  it('polling_success -> success and fires the success callback', () => {
    const r = mapOnrampEvent({ eventName: 'onramp_api.polling_success' }, 'polling')
    expect(r.status).to.equal('success')
    expect(r.fireSuccess).to.equal(true)
  })

  it('polling_error -> error', () => {
    const r = mapOnrampEvent({ eventName: 'onramp_api.polling_error' }, 'polling')
    expect(r.status).to.equal('error')
    expect(r.error).to.match(/could not be completed/)
  })

  it('does not fire success on any non-success event', () => {
    const events = [
      'onramp_api.load_pending',
      'onramp_api.load_success',
      'onramp_api.commit_success',
      'onramp_api.polling_start',
      'onramp_api.cancel',
      'onramp_api.load_error',
    ]
    for (const eventName of events) {
      expect(mapOnrampEvent({ eventName }, 'ready').fireSuccess).to.not.equal(true)
    }
  })
})

describe('Coinbase Headless Onramp — phone verification staleness', () => {
  const NOW = new Date('2026-05-28T00:00:00.000Z').getTime()
  const within = NOW - PHONE_REVERIFICATION_INTERVAL_MS / 2
  const expired = NOW - PHONE_REVERIFICATION_INTERVAL_MS - 1000

  it('no phone account -> not linked, not fresh, not stale', () => {
    const s = computePhoneState(undefined, null, NOW)
    expect(s.isLinked).to.equal(false)
    expect(s.isFresh).to.equal(false)
    expect(s.isStale).to.equal(false)
    expect(s.phoneNumber).to.equal(null)
  })

  it('linked + verified within 60 days -> fresh', () => {
    const s = computePhoneState(
      { type: 'phone', number: '+12025550123', latestVerifiedAt: new Date(within) },
      null,
      NOW
    )
    expect(s.isLinked).to.equal(true)
    expect(s.isFresh).to.equal(true)
    expect(s.isStale).to.equal(false)
  })

  it('linked + verified more than 60 days ago -> stale', () => {
    const s = computePhoneState(
      { type: 'phone', number: '+12025550123', latestVerifiedAt: new Date(expired) },
      null,
      NOW
    )
    expect(s.isLinked).to.equal(true)
    expect(s.isFresh).to.equal(false)
    expect(s.isStale).to.equal(true)
  })

  it('linked but no timestamp -> stale (Coinbase requires a verified-at <60d)', () => {
    const s = computePhoneState({ type: 'phone', number: '+12025550123' }, null, NOW)
    expect(s.isLinked).to.equal(true)
    expect(s.isFresh).to.equal(false)
    expect(s.isStale).to.equal(true)
  })

  it('accepts ISO string timestamps as well as Date objects', () => {
    const s = computePhoneState(
      { type: 'phone', number: '+12025550123', latestVerifiedAt: new Date(within).toISOString() },
      null,
      NOW
    )
    expect(s.isFresh).to.equal(true)
  })

  it('prefers latestVerifiedAt over firstVerifiedAt', () => {
    const s = computePhoneState(
      {
        type: 'phone',
        number: '+12025550123',
        firstVerifiedAt: new Date(expired),
        latestVerifiedAt: new Date(within),
      },
      null,
      NOW
    )
    expect(s.isFresh).to.equal(true)
  })

  it('falls back to the user.phone number when no linked account number', () => {
    const s = computePhoneState(undefined, '+12025550999', NOW)
    // no account => not linked-by-account, but number resolves via fallback
    expect(s.phoneNumber).to.equal('+12025550999')
    expect(s.isLinked).to.equal(true)
  })

  it('ignores an unparseable timestamp (treats as no timestamp -> stale)', () => {
    const s = computePhoneState(
      { type: 'phone', number: '+12025550123', latestVerifiedAt: 'not-a-date' },
      null,
      NOW
    )
    expect(s.isStale).to.equal(true)
    expect(s.isFresh).to.equal(false)
  })

  it('boundary: exactly at 60 days is treated as stale (not < interval)', () => {
    const exactlyAtBoundary = NOW - PHONE_REVERIFICATION_INTERVAL_MS
    const s = computePhoneState(
      { type: 'phone', number: '+12025550123', latestVerifiedAt: new Date(exactlyAtBoundary) },
      null,
      NOW
    )
    expect(s.isStale).to.equal(true)
  })

  it('normalizes a formatted Privy number to E.164', () => {
    const s = computePhoneState(
      { type: 'phone', number: '+1 (202) 555-0123', latestVerifiedAt: new Date(within) },
      null,
      NOW
    )
    expect(s.phoneNumber).to.equal('+12025550123')
  })
})

describe('Coinbase Headless Onramp — phone E.164 normalization', () => {
  it('strips spaces, parens and dashes', () => {
    expect(normalizePhoneE164('+1 (202) 555-0123')).to.equal('+12025550123')
    expect(normalizePhoneE164('+1-202-555-0123')).to.equal('+12025550123')
    expect(normalizePhoneE164('  +12025550123 ')).to.equal('+12025550123')
  })

  it('adds a leading + when missing', () => {
    expect(normalizePhoneE164('12025550123')).to.equal('+12025550123')
  })

  it('returns null for empty / junk input', () => {
    expect(normalizePhoneE164('')).to.equal(null)
    expect(normalizePhoneE164(null)).to.equal(null)
    expect(normalizePhoneE164(undefined)).to.equal(null)
    expect(normalizePhoneE164('abc')).to.equal(null)
  })
})

describe('Coinbase Onramp — variant selection (headless vs legacy)', () => {
  it('US users get the headless flow', () => {
    expect(shouldUseHeadlessOnramp(true, false)).to.equal(true)
  })

  it('non-US users get the legacy redirect flow', () => {
    expect(shouldUseHeadlessOnramp(false, false)).to.equal(false)
  })

  it('force-legacy kill-switch overrides US users', () => {
    expect(shouldUseHeadlessOnramp(true, true)).to.equal(false)
  })

  it('force-legacy also keeps non-US on legacy', () => {
    expect(shouldUseHeadlessOnramp(false, true)).to.equal(false)
  })
})
