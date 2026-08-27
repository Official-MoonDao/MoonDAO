/**
 * Access gate (headless, mocha + chai).
 *
 * The gate is the only thing keeping /moonbase and /deprize off the public site
 * once this merges, so the parts that decide "is this route gated" and "is this
 * cookie good" are worth pinning down properly.
 */
import { expect } from 'chai'
import { readFileSync } from 'fs'
import { join } from 'path'
import {
  GATED_PREFIXES,
  GATE_COOKIE,
  GATE_PATH,
  MIN_TOKEN_LENGTH,
  constantTimeEquals,
  isGatedPath,
  isPasswordCorrect,
  isSessionValid,
  isTokenConfigured,
  safeNextPath,
} from '../../../lib/gate/access'

// A token of realistic shape: `openssl rand -hex 32`.
const TOKEN = 'a'.repeat(64)

describe('access gate', () => {
  describe('which routes are gated', () => {
    it('gates the moonbase and DePrize, including their subroutes', () => {
      for (const p of [
        '/moonbase',
        '/moonbase/nasa-artemis-base-camp',
        '/deprize',
        '/deprize/1',
        '/deprize-play',
      ]) {
        expect(isGatedPath(p), p).to.equal(true)
      }
    })

    it('leaves the rest of the site alone', () => {
      for (const p of [
        '/',
        '/projects',
        '/roadmap',
        GATE_PATH,
        // Must not be caught by a naive "starts with /moonbase" on a route that
        // merely shares a prefix.
        '/moonbases-elsewhere',
        '/deprize-terms',
      ]) {
        expect(isGatedPath(p), p).to.equal(false)
      }
    })

    // Next needs the middleware matcher to be a static literal, so the list
    // exists twice. If they drift, the middleware silently stops guarding a
    // route while everything else still believes it is gated.
    it('keeps the middleware matcher in step with the prefix list', () => {
      const source = readFileSync(join(process.cwd(), 'middleware.ts'), 'utf8')
      const matcher = source.match(/matcher:\s*\[([^\]]*)\]/)
      expect(matcher, 'no matcher found in middleware.ts').to.not.equal(null)
      const routes = Array.from((matcher as RegExpMatchArray)[1].matchAll(/'([^']+)'/g)).map(
        (m) => m[1]
      )

      const base = (route: string) => route.replace(/\/:path\*$/, '')
      expect(routes.map(base).sort()).to.deep.equal([...GATED_PREFIXES].sort())
    })
  })

  describe('the session cookie', () => {
    it('opens the gate when it carries the configured token', () => {
      expect(isSessionValid(TOKEN, TOKEN)).to.equal(true)
    })

    it('rejects a wrong, forged, or missing cookie', () => {
      expect(isSessionValid('b'.repeat(64), TOKEN)).to.equal(false)
      expect(isSessionValid(TOKEN.slice(0, -1), TOKEN)).to.equal(false)
      // The shapes someone would actually try by hand.
      expect(isSessionValid('1', TOKEN)).to.equal(false)
      expect(isSessionValid('true', TOKEN)).to.equal(false)
      expect(isSessionValid('granted', TOKEN)).to.equal(false)
      expect(isSessionValid(undefined, TOKEN)).to.equal(false)
      expect(isSessionValid('', TOKEN)).to.equal(false)
    })

    // A deploy that forgets the variables must lock the routes, not publish
    // them. This is the case that would quietly make the whole gate a no-op.
    it('fails closed when the token is missing or too weak to hold', () => {
      expect(isSessionValid(TOKEN, undefined)).to.equal(false)
      expect(isSessionValid('', undefined)).to.equal(false)
      expect(isSessionValid('', '')).to.equal(false)
      const weak = 'x'.repeat(MIN_TOKEN_LENGTH - 1)
      expect(isTokenConfigured(weak)).to.equal(false)
      expect(isSessionValid(weak, weak)).to.equal(false)
      expect(isTokenConfigured(TOKEN)).to.equal(true)
    })

    it('names the cookie something that will not collide', () => {
      expect(GATE_COOKIE).to.match(/^[a-z_]+$/)
    })
  })

  describe('checking the password', () => {
    it('accepts the configured password and nothing else', () => {
      expect(isPasswordCorrect('open sesame', 'open sesame')).to.equal(true)
      expect(isPasswordCorrect('Open sesame', 'open sesame')).to.equal(false)
      expect(isPasswordCorrect('open sesame ', 'open sesame')).to.equal(false)
      expect(isPasswordCorrect('open', 'open sesame')).to.equal(false)
    })

    it('fails closed on a missing password or a missing submission', () => {
      expect(isPasswordCorrect('anything', undefined)).to.equal(false)
      expect(isPasswordCorrect('anything', '')).to.equal(false)
      expect(isPasswordCorrect(undefined, 'open sesame')).to.equal(false)
      expect(isPasswordCorrect('', 'open sesame')).to.equal(false)
      expect(isPasswordCorrect('', '')).to.equal(false)
    })

    // Comparing with === or with an early length check tells an attacker how
    // long the secret is from how quickly they were turned away.
    it('compares without short-circuiting, including on length', () => {
      expect(constantTimeEquals('abc', 'abc')).to.equal(true)
      expect(constantTimeEquals('abc', 'abd')).to.equal(false)
      expect(constantTimeEquals('abc', 'ab')).to.equal(false)
      expect(constantTimeEquals('ab', 'abc')).to.equal(false)
      expect(constantTimeEquals('', '')).to.equal(true)
      expect(constantTimeEquals('a', '')).to.equal(false)
    })
  })

  describe('where the gate sends you afterwards', () => {
    it('returns you to the route you asked for', () => {
      expect(safeNextPath('/moonbase')).to.equal('/moonbase')
      expect(safeNextPath('/deprize/1?tab=odds')).to.equal('/deprize/1?tab=odds')
    })

    // Otherwise a link to our own domain can land on someone else's login form.
    it('refuses to forward off-site', () => {
      for (const evil of [
        '//evil.example',
        'https://evil.example',
        'http://evil.example',
        '/\\evil.example',
        'javascript:alert(1)',
        '',
        null,
        undefined,
      ]) {
        expect(safeNextPath(evil), String(evil)).to.equal('/')
      }
    })
  })
})
