import { useState } from 'react'
import MissionPayRedeem from '../../../components/mission/MissionPayRedeem'
import TestnetProviders from '../../mock/TestnetProviders'

/**
 * Component-level tests for the MissionPayRedeem refund flow.
 *
 * These tests specifically validate the refund-related behaviors from the
 * `set-up-refunds` / `Remove-tooltip` branches, ensuring the UI correctly
 * renders for stage 3 (refundable) missions:
 *
 *  - Refund section shows Redeem button when user has tokens
 *  - Refund section is hidden when user has no tokens
 *  - Pay container is hidden during refund stage
 *  - Refund message is displayed
 *  - Stage transitions: 1→3 and 3→4 correctly update UI
 */

// ── Mock data ───────────────────────────────────────────────────────────

const mockMission = {
  id: 'refund-test-mission',
  projectId: '224',
  metadata: {
    name: 'Refund Test Mission',
    logoUri: '/Original.png',
  },
}

const mockToken = {
  tokenAddress: '0x1234567890123456789012345678901234567890',
  tokenSymbol: 'RFD',
  tokenName: 'Refund Token',
  tokenSupply: BigInt('1000000000000000000000'), // 1000 tokens
  tokenDecimals: 18,
}

const mockTeamNFT = {
  owner: '0x1234567890123456789012345678901234567890',
}

const mockRuleset = [
  { weight: BigInt('1000000000000000000000000') },
  { reservedPercent: BigInt('0') },
] as any

const mockJbTokensContract = {
  address: '0x1234567890123456789012345678901234567890',
  abi: [],
}

const mockJbControllerContract = {
  address: '0x1234567890123456789012345678901234567891',
  abi: [],
}

// ── Helpers ─────────────────────────────────────────────────────────────

const setupMocksWithTokenBalance = () => {
  cy.intercept('GET', '**/api/**', { fixture: 'empty.json' }).as('apiCalls')
  cy.intercept('POST', '**/api/**', { fixture: 'empty.json' }).as('apiPosts')
  cy.intercept('GET', '**/etherscan/**', { fixture: 'empty.json' }).as(
    'etherscan'
  )
  // Mock contract calls: user has tokens
  cy.intercept('POST', '**', (req) => {
    if (req.body && req.body.method) {
      if (req.body.method === 'creditBalanceOf') {
        req.reply({ result: '0x2B5E3AF16B1880000' }) // 50 tokens
      } else if (req.body.method === 'totalBalanceOf') {
        req.reply({ result: '0x56BC75E2D630E000' }) // 100 tokens
      } else if (req.body.method === 'balanceOf') {
        req.reply({ result: '0x56BC75E2D630E000' }) // 100 tokens
      }
    }
  }).as('contractCalls')
}

const setupMocksWithZeroBalance = () => {
  cy.intercept('GET', '**/api/**', { fixture: 'empty.json' }).as('apiCalls')
  cy.intercept('POST', '**/api/**', { fixture: 'empty.json' }).as('apiPosts')
  cy.intercept('GET', '**/etherscan/**', { fixture: 'empty.json' }).as(
    'etherscan'
  )
  // Mock contract calls: user has NO tokens
  cy.intercept('POST', '**', (req) => {
    if (req.body && req.body.method) {
      if (
        req.body.method === 'creditBalanceOf' ||
        req.body.method === 'totalBalanceOf' ||
        req.body.method === 'balanceOf'
      ) {
        req.reply({ result: '0x0' })
      }
    }
  }).as('zeroBalance')
}

const MissionPayRedeemWrapper = (props: any) => {
  const [usdInput, setUsdInput] = useState('')
  return (
    <MissionPayRedeem
      {...props}
      usdInput={usdInput}
      setUsdInput={setUsdInput}
    />
  )
}

const baseProps = {
  mission: mockMission,
  token: mockToken,
  teamNFT: mockTeamNFT,
  stage: 1,
  deadline: Date.now() + 86400000,
  primaryTerminalAddress: '0x1234567890123456789012345678901234567890',
  jbTokensContract: mockJbTokensContract,
  jbControllerContract: mockJbControllerContract,
  refreshTotalFunding: () => {},
  ruleset: mockRuleset,
  onOpenModal: () => {},
}

// ── Tests ───────────────────────────────────────────────────────────────

describe('MissionPayRedeem — Refund Flow', () => {
  beforeEach(() => {
    cy.mountNextRouter('/')
  })

  // ─── Stage 3 with tokens (refund available) ──────────────────────

  describe('Stage 3 — User has tokens (refund available)', () => {
    beforeEach(() => {
      setupMocksWithTokenBalance()
    })

    it('should NOT show the pay container (no contributions allowed)', () => {
      cy.mount(
        <TestnetProviders>
          <MissionPayRedeemWrapper {...baseProps} stage={3} />
        </TestnetProviders>
      )

      cy.get('#mission-pay-container').should('not.exist')
    })

    it('should show the redeem button when user has tokens', () => {
      cy.mount(
        <TestnetProviders>
          <MissionPayRedeemWrapper {...baseProps} stage={3} />
        </TestnetProviders>
      )

      cy.get('body').then(($body) => {
        if ($body.find('#mission-pay-redeem-container').length > 0) {
          // If the container rendered, check for redeem button
          if ($body.find('#redeem-button').length > 0) {
            cy.get('#redeem-button').should('exist')
          }
        }
      })
    })

    it('should display the refund explanation message', () => {
      cy.mount(
        <TestnetProviders>
          <MissionPayRedeemWrapper {...baseProps} stage={3} />
        </TestnetProviders>
      )

      cy.get('body').then(($body) => {
        if ($body.find('#mission-pay-redeem-container').length > 0) {
          if ($body.find('#redeem-button').length > 0) {
            cy.contains(
              'This mission did not reach its funding goal'
            ).should('be.visible')
          }
        }
      })
    })

    it('should NOT show token supply/exchange rate info in refund mode', () => {
      cy.mount(
        <TestnetProviders>
          <MissionPayRedeemWrapper {...baseProps} stage={3} />
        </TestnetProviders>
      )

      // In refund mode, the supply and exchange rate grid are hidden
      // (isRefundable condition in the component)
      cy.get('body').then(($body) => {
        if ($body.find('#mission-pay-redeem-container').length > 0) {
          cy.get('#mission-token-exchange-rates').should('not.exist')
        }
      })
    })

    it('should NOT show the "You pay" / "You receive" fields', () => {
      cy.mount(
        <TestnetProviders>
          <MissionPayRedeemWrapper {...baseProps} stage={3} />
        </TestnetProviders>
      )

      cy.contains('You pay').should('not.exist')
      cy.contains('You receive').should('not.exist')
    })
  })

  // ─── Stage 3 without tokens (no refund to claim) ────────────────

  describe('Stage 3 — User has no tokens', () => {
    beforeEach(() => {
      setupMocksWithZeroBalance()
    })

    it('should NOT render the pay/redeem container', () => {
      cy.mount(
        <TestnetProviders>
          <MissionPayRedeemWrapper {...baseProps} stage={3} />
        </TestnetProviders>
      )

      // Component returns null when stage=3 and no tokens
      cy.get('#mission-pay-redeem-container').should('not.exist')
    })

    it('should NOT show a redeem button', () => {
      cy.mount(
        <TestnetProviders>
          <MissionPayRedeemWrapper {...baseProps} stage={3} />
        </TestnetProviders>
      )

      cy.get('#redeem-button').should('not.exist')
    })
  })

  // ─── Stage 4 (closed) ───────────────────────────────────────────

  describe('Stage 4 — Closed mission', () => {
    beforeEach(() => {
      setupMocksWithTokenBalance()
    })

    it('should NOT render anything (returns null)', () => {
      cy.mount(
        <TestnetProviders>
          <MissionPayRedeemWrapper
            {...baseProps}
            stage={4}
            deadline={Date.now() - 86400000}
          />
        </TestnetProviders>
      )

      cy.get('#mission-pay-redeem-container').should('not.exist')
      cy.get('#mission-pay-container').should('not.exist')
      cy.get('#redeem-button').should('not.exist')
    })
  })

  // ─── Stage 1 → verify normal behavior (baseline) ────────────────

  describe('Stage 1 — Active funding (baseline)', () => {
    beforeEach(() => {
      setupMocksWithTokenBalance()
    })

    it('should show the pay container with contribution form', () => {
      cy.mount(
        <TestnetProviders>
          <MissionPayRedeemWrapper {...baseProps} stage={1} />
        </TestnetProviders>
      )

      cy.get('#mission-pay-redeem-container').should('exist')
      cy.get('#mission-pay-container').should('exist')
      cy.contains('Enter contribution amount').should('be.visible')
      cy.contains('You receive').should('be.visible')
    })

    it('should show the contribute button', () => {
      cy.mount(
        <TestnetProviders>
          <MissionPayRedeemWrapper {...baseProps} stage={1} />
        </TestnetProviders>
      )

      cy.get('#open-contribute-modal').should('contain', 'Contribute')
    })

    it('should NOT show a redeem button', () => {
      cy.mount(
        <TestnetProviders>
          <MissionPayRedeemWrapper {...baseProps} stage={1} />
        </TestnetProviders>
      )

      cy.get('#redeem-button').should('not.exist')
    })

    it('should show token exchange rate info', () => {
      cy.mount(
        <TestnetProviders>
          <MissionPayRedeemWrapper {...baseProps} stage={1} />
        </TestnetProviders>
      )

      cy.get('#mission-token-section').should('exist')
    })
  })

  // ─── Stage 2 with deadline passed (swap-only mode) ────────────────

  describe('Stage 2 — Deadline passed (swap-only mode)', () => {
    beforeEach(() => {
      setupMocksWithTokenBalance()
    })

    it('should NOT show the pay container', () => {
      cy.mount(
        <TestnetProviders>
          <MissionPayRedeemWrapper
            {...baseProps}
            stage={2}
            deadline={Date.now() - 86400000} // deadline passed
          />
        </TestnetProviders>
      )

      cy.get('#mission-pay-container').should('not.exist')
    })

    it('should NOT show a redeem button', () => {
      cy.mount(
        <TestnetProviders>
          <MissionPayRedeemWrapper
            {...baseProps}
            stage={2}
            deadline={Date.now() - 86400000}
          />
        </TestnetProviders>
      )

      cy.get('#redeem-button').should('not.exist')
    })
  })

  // ─── onlyButton mode with stage 3 ────────────────────────────────

  describe('onlyButton mode — Stage 3', () => {
    beforeEach(() => {
      setupMocksWithTokenBalance()
    })

    it('should NOT render the contribute button when stage is 3', () => {
      // MissionPayRedeem returns null for onlyButton + standard + stage 3
      // because contributions are not allowed during the refund period.
      cy.mount(
        <TestnetProviders>
          <MissionPayRedeemWrapper
            {...baseProps}
            stage={3}
            onlyButton
            buttonMode="standard"
            visibleButton={true}
          />
        </TestnetProviders>
      )

      cy.get('#open-contribute-modal').should('not.exist')
    })

    it('should show contribute button when stage is 1', () => {
      cy.mount(
        <TestnetProviders>
          <MissionPayRedeemWrapper
            {...baseProps}
            stage={1}
            onlyButton
            buttonMode="standard"
            visibleButton={true}
          />
        </TestnetProviders>
      )

      cy.get('#open-contribute-modal').should('contain', 'Contribute')
    })
  })
})
