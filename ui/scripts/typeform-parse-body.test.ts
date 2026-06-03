import { parseTypeformApiRequestBody } from '../lib/typeform/parseApiRequestBody'

function expectEqual<T>(actual: T, expected: T, label: string) {
  if (actual !== expected) {
    throw new Error(`${label}: expected ${expected}, got ${actual}`)
  }
}

function expectTruthy(value: unknown, label: string) {
  if (!value) throw new Error(`${label}: expected truthy, got ${value}`)
}

describe('parseTypeformApiRequestBody', () => {
  it('parses a JSON string body', () => {
    const parsed = parseTypeformApiRequestBody(
      JSON.stringify({ formId: 'abc', responseId: 'tok', onboarding: true }),
    )
    expectTruthy(parsed, 'parsed')
    expectEqual(parsed!.formId, 'abc', 'formId')
    expectEqual(parsed!.onboarding, true, 'onboarding')
  })

  it('accepts an already-parsed object (application/json)', () => {
    const parsed = parseTypeformApiRequestBody({
      accessToken: 'privy-token',
      formId: 'pJj0vUae',
      responseId: 'resp123',
      onboarding: true,
    })
    expectTruthy(parsed, 'parsed')
    expectEqual(parsed!.responseId, 'resp123', 'responseId')
  })

  it('returns empty object for null/undefined', () => {
    expectEqual(Object.keys(parseTypeformApiRequestBody(null) || {}).length, 0, 'null')
    expectEqual(
      Object.keys(parseTypeformApiRequestBody(undefined) || {}).length,
      0,
      'undefined',
    )
  })

  it('returns null for invalid JSON strings', () => {
    expectEqual(parseTypeformApiRequestBody('{not json'), null, 'invalid json')
  })
})
