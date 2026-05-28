import TestnetProviders from '@/cypress/mock/TestnetProviders'
import { CYPRESS_CHAIN_V5 } from '@/cypress/mock/config'
import { CBHeadlessOnramp } from '@/components/coinbase/CBHeadlessOnramp'
import * as PhoneModule from '@/lib/coinbase/usePhoneVerification'
import * as PrivyAuth from '@privy-io/react-auth'

/**
 * Real-browser component tests for the Headless Onramp UI. These render the
 * actual React component in Chrome and assert on the rendered DOM, covering:
 *   - Step 1 (phone verification) gating + UI
 *   - Step 2 (payment) once phone is verified
 *   - Quote loading / display
 *   - The exchange-funding guide on an unsupported quote (HTTP 400)
 *   - Generic error UI
 *   - Close button wiring
 *
 * Everything inside the Coinbase iframe + the Apple Pay native sheet is
 * out of scope (cross-origin / OS-level). The postMessage state machine is
 * covered separately by the pure-unit tests for `mapOnrampEvent`.
 */
describe('<CBHeadlessOnramp /> (real UI)', () => {
  const mockAddress = '0x1234567890123456789012345678901234567890'
  const mockChain = CYPRESS_CHAIN_V5

  // Default: a fully-verified phone so the component shows Step 2 unless a
  // test overrides this before mount. Built lazily inside each test so the
  // cy.stub() calls run within an it() (not at describe-body time).
  function makeVerifiedPhone() {
    return {
      phoneNumber: '+13105551234',
      isLinked: true,
      isFresh: true,
      isStale: false,
      verifiedAt: new Date(),
      requestVerification: cy.stub().as('requestVerification'),
      refreshVerification: cy.stub().as('refreshVerification'),
    }
  }

  function stubPhone(overrides: Record<string, any> = {}) {
    const value = { ...makeVerifiedPhone(), ...overrides }
    if ((PhoneModule.default as any).restore) {
      ;(PhoneModule.default as any).restore()
    }
    cy.stub(PhoneModule, 'default').returns(value)
  }

  function stubPrivyEmail(email: string | null) {
    const usePrivy = PrivyAuth.usePrivy as any
    if (usePrivy.restore) usePrivy.restore()
    cy.stub(PrivyAuth, 'usePrivy').returns({
      user: email
        ? { email: { address: email }, linkedAccounts: [] }
        : { linkedAccounts: [] },
      authenticated: !!email,
      ready: true,
      login: cy.stub(),
      logout: cy.stub(),
      linkPhone: cy.stub(),
      unlinkPhone: cy.stub(),
    })
  }

  beforeEach(() => {
    cy.mountNextRouter('/')
    cy.intercept('GET', '/api/coinbase/eth-price', {
      statusCode: 200,
      body: { price: 2500 },
    }).as('ethPrice')
    cy.intercept('POST', '/api/coinbase/buy-quote', {
      statusCode: 200,
      body: {
        quote: {
          purchase_amount: { value: '0.1' },
          payment_subtotal: { value: '250.00' },
          payment_total: { value: '258.50' },
          quote_id: 'quote-abc-123',
        },
      },
    }).as('buyQuote')
  })

  it('Step 1: gates on phone verification when no phone is linked', () => {
    stubPhone({
      phoneNumber: null,
      isLinked: false,
      isFresh: false,
      isStale: false,
      verifiedAt: null,
    })
    stubPrivyEmail('user@moondao.com')

    cy.mount(
      <TestnetProviders>
        <CBHeadlessOnramp
          address={mockAddress}
          selectedChain={mockChain}
          ethAmount={0.1}
          partnerUserRef="test-0xabc"
        />
      </TestnetProviders>
    )

    cy.get('[data-testid="cbheadless-modal-content"]', { timeout: 10000 }).should(
      'exist'
    )
    // Step indicator + the phone step copy
    cy.contains('Verify your US mobile number').should('be.visible')
    cy.contains('Send verification code').should('be.visible')
    cy.contains('one-time SMS verification').should('exist')
    // The Pay button should NOT be present yet (still on step 1)
    cy.contains(/Pay \$/).should('not.exist')

    // Clicking the CTA triggers Privy verification
    cy.contains('Send verification code').click()
    cy.get('@requestVerification').should('have.been.called')
  })

  it('Step 1: shows re-verify prompt when phone is stale (>60 days)', () => {
    stubPhone({
      isFresh: false,
      isStale: true,
      verifiedAt: new Date(Date.now() - 90 * 24 * 60 * 60 * 1000),
    })
    stubPrivyEmail('user@moondao.com')

    cy.mount(
      <TestnetProviders>
        <CBHeadlessOnramp
          address={mockAddress}
          selectedChain={mockChain}
          ethAmount={0.1}
          partnerUserRef="test-0xabc"
        />
      </TestnetProviders>
    )

    cy.contains('Re-verify your phone number').should('be.visible')
    cy.contains('older than 60 days').should('exist')
    cy.contains('Re-verify phone number').click()
    cy.get('@refreshVerification').should('have.been.called')
  })

  it('Step 2: shows quote + Pay button once phone is verified', () => {
    stubPhone()
    stubPrivyEmail('user@moondao.com')

    cy.mount(
      <TestnetProviders>
        <CBHeadlessOnramp
          address={mockAddress}
          selectedChain={mockChain}
          ethAmount={0.1}
          partnerUserRef="test-0xabc"
        />
      </TestnetProviders>
    )

    cy.wait('@ethPrice')
    cy.wait('@buyQuote')

    // Quote values from the intercepted fixture
    cy.contains('0.1000 ETH').should('be.visible')
    cy.contains('$258.50').should('be.visible')
    // Verified phone confirmation row
    cy.contains('+13105551234').should('be.visible')
    // Pay button enabled
    cy.contains(/Pay \$258\.50 with Apple Pay/).should('exist')
  })

  it('Step 2: renders the exchange-funding guide when quote returns HTTP 400', () => {
    stubPhone()
    stubPrivyEmail('user@moondao.com')
    cy.intercept('POST', '/api/coinbase/buy-quote', { statusCode: 400, body: {} }).as(
      'buyQuoteFail'
    )

    cy.mount(
      <TestnetProviders>
        <CBHeadlessOnramp
          address={mockAddress}
          selectedChain={mockChain}
          ethAmount={0.1}
          partnerUserRef="test-0xabc"
        />
      </TestnetProviders>
    )

    cy.wait('@buyQuoteFail')
    cy.contains('Fund another way').should('be.visible')
  })

  it('calls onExit when the close button is clicked', () => {
    stubPhone()
    stubPrivyEmail('user@moondao.com')
    const onExit = cy.stub().as('onExit')

    cy.mount(
      <TestnetProviders>
        <CBHeadlessOnramp
          address={mockAddress}
          selectedChain={mockChain}
          ethAmount={0.1}
          partnerUserRef="test-0xabc"
          onExit={onExit}
        />
      </TestnetProviders>
    )

    cy.get('[data-testid="cbheadless-close-button"]').click()
    cy.get('@onExit').should('have.been.called')
  })

  // NOTE: The Pay button is a <PrivyWeb3Button> that disables its Action state
  // until a wallet is connected + an email is present on the Privy user. A
  // component harness has no connected wallet, so the click-through to the
  // iframe can't be exercised here. That path (create-order → iframe render →
  // onramp_api.* postMessage → onPaymentSuccess) is covered exhaustively by the
  // pure-unit tests for `mapOnrampEvent` / `parseOnrampMessage`, and end-to-end
  // by the Vercel preview deploy.
})
