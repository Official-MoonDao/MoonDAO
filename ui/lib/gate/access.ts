// Shared password gate for the routes that are in the repo but not ready to be
// public: the moonbase and DePrize.
//
// The one hard requirement is that the password never lands in the repository or
// in the browser bundle, which rules out the obvious shapes:
//
//   - A NEXT_PUBLIC_ variable compared in the browser ships the password to
//     every visitor in plain text — it is in the JS, so the gate is decoration.
//   - A constant in this file is worse: it is in git history forever.
//
// So two server-side variables (no NEXT_PUBLIC_ prefix, so Next will not inline
// them into client code), set in the deployment environment and in each
// developer's untracked .env.local:
//
//   MOONBASE_GATE_PASSWORD — what a person types into the form. Read in exactly
//     one place, the API route that accepts a login, and never sent to a
//     browser.
//   MOONBASE_GATE_TOKEN — a long random string, unrelated to the password, that
//     becomes the value of the session cookie. Read by the middleware to check
//     the cookie it was given.
//
// The two are separate on purpose. The cookie has to be something a visitor
// cannot guess but the server can recognise, and it must not be the password:
// a cookie is stored on disk by the browser and travels in every request
// header, so putting the password in one spreads it around. Keeping them apart
// also means either can be rotated alone — change the token to sign everybody
// out, change the password to alter what gets you back in.
//
// This module deliberately does no hashing. It has to run in two runtimes with
// different crypto: the Edge runtime of the middleware (Web Crypto, no
// node:crypto) and the Node runtime of the API route (node:crypto, and no
// global Web Crypto before Node 20). Anything derived would need either a
// runtime branch or a hand-rolled digest, and a random token compared for
// equality needs neither.

// Everything under these prefixes is gated. Prefix-matched, so a route added
// under one of them later is covered without anyone remembering to come back
// here. Kept in step with the matcher in middleware.ts, which cannot import
// this list (Next requires the matcher be a static literal) — a unit test
// fails if GATED_PREFIXES and GATED_MIDDLEWARE_MATCHERS drift apart. When you
// change either, update middleware.ts `config.matcher` to the same strings.
export const GATED_PREFIXES = ['/moonbase', '/deprize', '/deprize-play']

// Exact strings that must appear in middleware.ts `config.matcher`. Kept here
// so the Cypress unit suite can assert the pairing without reading the file
// (the browser bundle has no Node `fs`).
// Next's `:path*` matcher does not reliably fire on the bare prefix
// (`/deprize` vs `/deprize/1`). List both so a typed URL is gated the same
// way as a deep link.
export const GATED_MIDDLEWARE_MATCHERS = [
  '/moonbase',
  '/moonbase/:path*',
  '/deprize',
  '/deprize/:path*',
  '/deprize-play',
]

// Where the gate form lives, and the query parameter holding the route the
// visitor was trying to reach.
export const GATE_PATH = '/gate'
export const GATE_NEXT_PARAM = 'next'

// Name of the cookie carrying the session token.
export const GATE_COOKIE = 'moondao_gate'

// A month. Long enough that the people who have been let in are not re-typing
// the password every day, short enough that a borrowed laptop stops working.
export const GATE_MAX_AGE_S = 60 * 60 * 24 * 30

// Refuse a token short enough to be guessable. This is the value that actually
// holds the gate shut, so a deployment that sets it to "letmein" should be
// treated as unconfigured rather than quietly protected by nothing.
export const MIN_TOKEN_LENGTH = 24

export function isGatedPath(pathname: string): boolean {
  return GATED_PREFIXES.some((prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`))
}

// Compares two strings without revealing where, or whether, they first differ.
// Walks the full length of both every time — no early return on a length
// mismatch, which would otherwise time out the length of the secret — and folds
// every character into the same accumulator.
export function constantTimeEquals(a: string, b: string): boolean {
  const len = Math.max(a.length, b.length)
  let diff = a.length ^ b.length
  for (let i = 0; i < len; i++) {
    diff |= (a.charCodeAt(i) || 0) ^ (b.charCodeAt(i) || 0)
  }
  return diff === 0
}

// Is the configured token usable? Everything below fails closed if it is not.
export function isTokenConfigured(token: string | undefined): boolean {
  return typeof token === 'string' && token.length >= MIN_TOKEN_LENGTH
}

// Does this cookie carry the configured session token?
//
// Fails closed. An unset or too-short token means the gate is misconfigured,
// and the safe reading of that is "nobody gets in" rather than "everybody
// does" — a deploy that forgets the variable should lock the routes, not
// publish them.
export function isSessionValid(
  cookieValue: string | undefined,
  token: string | undefined
): boolean {
  if (!isTokenConfigured(token) || !cookieValue) return false
  return constantTimeEquals(cookieValue, token as string)
}

// Is this the password? Same fail-closed rule: no configured password means no
// way in, rather than a way in for anyone who submits an empty form.
export function isPasswordCorrect(
  submitted: string | undefined,
  password: string | undefined
): boolean {
  if (!password || !submitted) return false
  return constantTimeEquals(submitted, password)
}

// Only ever send a visitor back to a path on this site. Without this check the
// gate would forward to whatever `?next=` said, which is an open redirect: a
// link to our own domain that lands on someone else's login form.
export function safeNextPath(next: string | null | undefined): string {
  if (!next) return '/'
  // Must be a site-relative path. Reject protocol-relative ("//evil.com") and
  // anything carrying a scheme, plus backslashes, which some clients normalise
  // to forward slashes after a check like this would have passed.
  if (!next.startsWith('/')) return '/'
  if (next.startsWith('//') || next.includes('\\')) return '/'
  return next
}
