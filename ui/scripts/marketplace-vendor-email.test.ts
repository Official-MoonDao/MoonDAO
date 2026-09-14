import fs from 'fs'
import path from 'path'
import {
  extractEmailFromTypeformAnswers,
  lookupVendorEmail,
  normalizeTeamId,
  resolveVendorTeamId,
  safeTransactionApiUrl,
  VendorEmailLookupDeps,
} from '../lib/marketplace/vendorEmail'

function expectEqual<T>(actual: T, expected: T, label: string) {
  if (actual !== expected) {
    throw new Error(`${label}: expected ${String(expected)}, got ${String(actual)}`)
  }
}

describe('normalizeTeamId', () => {
  it('accepts integer strings and numbers, including team 0 (EB)', () => {
    expectEqual(normalizeTeamId(0), '0', 'zero')
    expectEqual(normalizeTeamId('22'), '22', 'string 22')
    expectEqual(normalizeTeamId(22), '22', 'number 22')
  })

  it('rejects non-integers and injection strings', () => {
    expectEqual(normalizeTeamId(undefined), null, 'undefined')
    expectEqual(normalizeTeamId(''), null, 'empty')
    expectEqual(normalizeTeamId('22; DROP TABLE'), null, 'injection')
    expectEqual(normalizeTeamId('22.5'), null, 'float')
    expectEqual(normalizeTeamId(-1), null, 'negative')
  })
})

describe('resolveVendorTeamId', () => {
  // Production: listing #32 ("A Heart for Space" book) is USDC. The purchase
  // tx `to` is the token/router, which owns no Team NFT, so the on-chain
  // owner lookup is empty. The listing row is the trusted source of teamId.
  it('prefers the listing teamId when the on-chain recipient has no Team NFT', () => {
    expectEqual(
      resolveVendorTeamId({
        listingTeamId: 22,
        onchainTeamTokenId: undefined,
        clientTeamId: 22,
      }),
      '22',
      'listing wins'
    )
  })

  it('falls back to the on-chain team token when the listing row is missing', () => {
    expectEqual(
      resolveVendorTeamId({
        listingTeamId: undefined,
        onchainTeamTokenId: '7',
        clientTeamId: 22,
      }),
      '7',
      'on-chain wins over client'
    )
  })

  it('uses the client-sent teamId only as a last resort', () => {
    expectEqual(
      resolveVendorTeamId({
        listingTeamId: undefined,
        onchainTeamTokenId: undefined,
        clientTeamId: '22',
      }),
      '22',
      'client last resort'
    )
  })

  it('returns null when nothing resolves to a team id', () => {
    expectEqual(
      resolveVendorTeamId({
        listingTeamId: undefined,
        onchainTeamTokenId: undefined,
        clientTeamId: undefined,
      }),
      null,
      'empty'
    )
  })
})

describe('extractEmailFromTypeformAnswers', () => {
  it('reads a standard Typeform email answer', () => {
    expectEqual(
      extractEmailFromTypeformAnswers([
        { type: 'text', text: 'A Heart for Space', field: { type: 'short_text' } },
        {
          type: 'email',
          email: 'vendor@example.com',
          field: { type: 'email' },
        },
      ]),
      'vendor@example.com',
      'email field'
    )
  })

  it('returns null for the team onboarding form, which has no email field', () => {
    // Mirrors formatTeamFormData: name / description / urls / boolean only.
    expectEqual(
      extractEmailFromTypeformAnswers([
        { type: 'text', text: 'A Heart for Space', field: { id: 'ODbjYccwMg1E' } },
        { type: 'text', text: 'Work to inspire others', field: { id: 'Cg2Wv2FOW3wN' } },
        { type: 'url', url: 'https://aheartforspace.com/', field: { id: 'ypWYK8jHAPXf' } },
        { type: 'boolean', boolean: true, field: { id: 'MfYME9ERpJR6' } },
      ]),
      null,
      'team form'
    )
  })

  it('accepts a short_text answer that is an email', () => {
    expectEqual(
      extractEmailFromTypeformAnswers([
        { type: 'text', text: 'vendor@example.com', field: { type: 'short_text' } },
      ]),
      'vendor@example.com',
      'short_text email'
    )
  })
})

describe('safeTransactionApiUrl', () => {
  it('maps chain slugs used by this app', () => {
    expectEqual(
      safeTransactionApiUrl('arbitrum'),
      'https://safe-transaction-arbitrum.safe.global',
      'arbitrum'
    )
    expectEqual(
      safeTransactionApiUrl('sepolia'),
      'https://safe-transaction-sepolia.safe.global',
      'sepolia'
    )
    expectEqual(safeTransactionApiUrl('unknown'), null, 'unknown')
  })
})

describe('lookupVendorEmail', () => {
  const TEAM_22 = '22'
  const TEAM_FORM_ID = 'm9o7j1unu06iwuam6gdd2jm9o7j1zz1u'
  const CITIZEN_FORM_ID = 'xwfxtmk0miof6x3qegtqymxwfxtmkx6z'
  const SAFE = '0xF4665312169F6B0ED5A1948C2dF8A85ce63D9ba4'
  const EIMAN = '0xe2d3aC725E6FFE2b28a9ED83bedAaf6672f2C801'
  const VENDOR_EMAIL = 'vendor@example.com'

  function deps(overrides: Partial<VendorEmailLookupDeps> = {}): VendorEmailLookupDeps {
    return {
      teamFormIds: ['team-form', 'team-email-form'],
      citizenFormIds: ['citizen-form', 'citizen-email-form'],
      getTeamFormId: async (teamId) => (teamId === TEAM_22 ? TEAM_FORM_ID : null),
      fetchTypeformEmail: async (formIds, responseId) => {
        if (formIds.includes('team-form') && responseId === TEAM_FORM_ID) {
          return null
        }
        if (formIds.includes('citizen-form') && responseId === CITIZEN_FORM_ID) {
          return VENDOR_EMAIL
        }
        return null
      },
      getTeamOwner: async (teamId) => (teamId === TEAM_22 ? SAFE : null),
      getSafeOwners: async (address) =>
        address.toLowerCase() === SAFE.toLowerCase() ? [EIMAN] : [],
      getCitizenFormId: async (wallet) =>
        wallet.toLowerCase() === EIMAN.toLowerCase() ? CITIZEN_FORM_ID : null,
      ...overrides,
    }
  }

  it('uses the team Typeform email when present', async () => {
    const email = await lookupVendorEmail(
      TEAM_22,
      deps({
        fetchTypeformEmail: async (formIds) =>
          formIds.includes('team-form') ? 'team@example.com' : null,
      })
    )
    expectEqual(email, 'team@example.com', 'team typeform')
  })

  // This is the remaining production bug after PR #1532: team #22 resolves
  // correctly from listing #32, but the team Typeform response has no email.
  // The team NFT is held by a Safe whose sole owner is a citizen with email.
  it('falls back to the Safe owner citizen email when the team form has no email', async () => {
    const email = await lookupVendorEmail(TEAM_22, deps())
    expectEqual(email, VENDOR_EMAIL, 'citizen fallback')
  })

  it('returns null when neither team nor citizen Typeform has an email', async () => {
    const email = await lookupVendorEmail(
      TEAM_22,
      deps({
        fetchTypeformEmail: async () => null,
      })
    )
    expectEqual(email, null, 'nothing found')
  })

  it('rejects an unsanitized team id', async () => {
    const email = await lookupVendorEmail('22; DROP TABLE', deps())
    expectEqual(email, null, 'rejected')
  })
})

describe('marketplace purchase API wiring', () => {
  const source = fs.readFileSync(
    path.join(__dirname, '../pages/api/marketplace/marketplace-purchase.ts'),
    'utf8'
  )

  it('resolves the vendor via listing teamId, then citizen-owner fallback', () => {
    if (!source.includes('lookupVendorEmail')) {
      throw new Error('purchase API must call lookupVendorEmail')
    }
    if (!source.includes('resolveVendorTeamId')) {
      throw new Error('purchase API must call resolveVendorTeamId')
    }
    if (!source.includes('getCitizenFormId')) {
      throw new Error('purchase API must look up the team owner citizen form')
    }
  })
})
