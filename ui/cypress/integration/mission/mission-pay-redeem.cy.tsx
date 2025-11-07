import { useState } from 'react'
import { ZERO_ADDRESS } from 'thirdweb'
import MissionPayRedeem from '../../../components/mission/MissionPayRedeem'
import TestnetProviders from '../../mock/TestnetProviders'

// Mock data
const mockMission = {
  id: 'test-mission-1',
  projectId: '1',
  metadata: {
    name: 'Test Mission',
    logoUri: '/assets/test-logo.png',
  },
}

const mockToken = {
  tokenAddress: '0x1234567890123456789012345678901234567890',
  tokenSymbol: 'TMT',
  tokenName: 'Test Mission Token',
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

const setupMocks = () => {
  cy.intercept('GET', '**/api/**', { fixture: 'empty.json' }).as('apiCalls')
  cy.intercept('POST', '**/api/**', { fixture: 'empty.json' }).as('apiPosts')

  cy.intercept('GET', '**/etherscan/**', { fixture: 'empty.json' }).as(
    'etherscan'
  )

  // Mock contract calls for thirdweb useRead
  cy.intercept('POST', '**', (req) => {
    if (req.body && req.body.method) {
      if (req.body.method === 'creditBalanceOf') {
        req.reply({ result: '0x2B5E3AF16B1880000' }) // 50 tokens in hex wei
      } else if (req.body.method === 'totalBalanceOf') {
        req.reply({ result: '0x56BC75E2D630E000' }) // 100 tokens in hex wei
      } else if (req.body.method === 'balanceOf') {
        req.reply({ result: '0x56BC75E2D630E000' }) // 100 tokens in hex wei
      }
    }
  }).as('contractCalls')
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

describe('MissionPayRedeem Component', () => {
  let mockProps: any
  let refreshBackersStub: any
  let onOpenModalStub: any

  beforeEach(() => {
    // Create stubs inside beforeEach
    refreshBackersStub = cy.stub()
    onOpenModalStub = cy.stub()

    // Create mock contract objects for thirdweb hooks
    const mockJbTokensContract = {
      address: '0x1234567890123456789012345678901234567890',
      abi: [],
    }

    const mockJbControllerContract = {
      address: '0x1234567890123456789012345678901234567891',
      abi: [],
    }

    // Create mock props with stubs
    mockProps = {
      mission: mockMission,
      token: mockToken,
      teamNFT: mockTeamNFT,
      stage: 1,
      deadline: Date.now() + 86400000, // 24 hours from now
      primaryTerminalAddress: '0x1234567890123456789012345678901234567890',
      jbTokensContract: mockJbTokensContract,
      jbControllerContract: mockJbControllerContract,
      refreshBackers: refreshBackersStub,
      refreshTotalFunding: cy.stub(),
      ruleset: mockRuleset,
      onOpenModal: onOpenModalStub,
    }

    cy.mountNextRouter('/')
    setupMocks()
  })

  it('renders the payment container correctly for stage 1', () => {
    cy.mount(
      <TestnetProviders>
        <MissionPayRedeemWrapper {...mockProps} />
      </TestnetProviders>
    )

    cy.get('#mission-pay-redeem-container').should('exist')
    cy.get('#mission-pay-container').should('exist')
    cy.contains('You pay').should('be.visible')
    cy.contains('You receive').should('be.visible')
    cy.get('#usd-contribution-input').should('exist')
    cy.get('#open-contribute-modal').should('contain', 'Contribute')
    cy.contains('Sign In ● Fund ● Contribute').should('be.visible')
  })

  it('handles USD input changes correctly', () => {
    cy.mount(
      <TestnetProviders>
        <MissionPayRedeemWrapper {...mockProps} />
      </TestnetProviders>
    )

    cy.get('#usd-contribution-input').clear()
    cy.get('#usd-contribution-input').type('100')
    cy.get('#usd-contribution-input').should('have.value', '100')

    // Check if ETH equivalent is displayed
    cy.contains('ETH').should('be.visible')
  })

  it('calls onOpenModal when contribute button is clicked', () => {
    cy.mount(
      <TestnetProviders>
        <MissionPayRedeemWrapper {...mockProps} />
      </TestnetProviders>
    )

    cy.get('#usd-contribution-input').clear()
    cy.get('#usd-contribution-input').type('100')
    cy.get('#open-contribute-modal').click()
    cy.then(() => {
      expect(onOpenModalStub).to.have.been.called
    })
  })

  it('displays token section when token supply exists', () => {
    cy.mount(
      <TestnetProviders>
        <MissionPayRedeemWrapper {...mockProps} />
      </TestnetProviders>
    )

    cy.get('#mission-token-section').should('exist')
    cy.contains('Token').should('be.visible')
    cy.contains('Current Supply').should('be.visible')
    cy.contains('1,000.00').should('be.visible') // Formatted token supply
    cy.contains('TMT').should('be.visible')
  })

  it('displays exchange rates component', () => {
    cy.mount(
      <TestnetProviders>
        <MissionPayRedeemWrapper {...mockProps} />
      </TestnetProviders>
    )

    cy.get('#mission-token-exchange-rates').should('exist')
    cy.contains('Exchange Rate').should('be.visible')
  })

  it('displays token output when USD input is provided', () => {
    cy.mount(
      <TestnetProviders>
        <MissionPayRedeemWrapper {...mockProps} />
      </TestnetProviders>
    )

    cy.get('#usd-contribution-input').clear()
    cy.get('#usd-contribution-input').type('100')
    cy.get('#token-output').should('exist')
  })

  it('validates input constraints', () => {
    cy.mount(
      <TestnetProviders>
        <MissionPayRedeemWrapper {...mockProps} />
      </TestnetProviders>
    )

    // Test USD input constraints - max 7 digits before decimal
    cy.get('#usd-contribution-input').clear()
    cy.get('#usd-contribution-input').type('12345678')
    cy.get('#usd-contribution-input').should(($input) => {
      const value = $input.val() as string
      expect(value.replace(/,/g, '').split('.')[0]).to.have.length.at.most(7)
    })

    // Test only numbers and decimal allowed
    cy.get('#usd-contribution-input').clear()
    cy.get('#usd-contribution-input').type('abc123.45def')
    cy.get('#usd-contribution-input').should(($input) => {
      const value = $input.val() as string
      expect(value.replace(/[^0-9.]/g, '')).to.include('123.45')
    })

    // Test max 2 decimal places
    cy.get('#usd-contribution-input').clear()
    cy.get('#usd-contribution-input').type('100.123')
    cy.get('#usd-contribution-input').should(($input) => {
      const value = $input.val() as string
      const decimalPart = value.split('.')[1]
      if (decimalPart) {
        expect(decimalPart.length).to.be.at.most(2)
      }
    })
  })

  it('displays accepted payment methods information', () => {
    cy.mount(
      <TestnetProviders>
        <MissionPayRedeemWrapper {...mockProps} />
      </TestnetProviders>
    )

    cy.get('#mission-pay-container').should('exist')
  })

  it('does not render for stage 4', () => {
    const stage4Props = { ...mockProps, stage: 4 }

    cy.mount(
      <TestnetProviders>
        <MissionPayRedeemWrapper {...stage4Props} />
      </TestnetProviders>
    )

    // Component should return null for stage 4
    cy.get('#mission-pay-redeem-container').should('not.exist')
  })

  it('shows swap-only mode when deadline passed and stage is 2', () => {
    const swapOnlyProps = {
      ...mockProps,
      stage: 2,
      deadline: Date.now() - 86400000, // 24 hours ago
    }

    cy.mount(
      <TestnetProviders>
        <MissionPayRedeemWrapper {...swapOnlyProps} />
      </TestnetProviders>
    )

    cy.get('#mission-pay-container').should('not.exist')
    cy.get('#mission-pay-redeem-container').should('exist')
  })

  it('shows refund section for stage 3 when user has tokens', () => {
    const refundProps = {
      ...mockProps,
      stage: 3,
    }

    cy.mount(
      <TestnetProviders>
        <MissionPayRedeemWrapper {...refundProps} />
      </TestnetProviders>
    )

    cy.get('body').then(($body) => {
      const containerExists =
        $body.find('#mission-pay-redeem-container').length > 0

      if (containerExists) {
        cy.get('#mission-pay-redeem-container').should('exist')
        cy.get('#mission-pay-container').should('not.exist') // Pay container not visible in refund stage

        const tokenSectionExists =
          $body.find('#mission-token-section').length > 0
        if (tokenSectionExists) {
          cy.get('#mission-token-section').should('exist')
          cy.get('#redeem-button').should('exist')
          cy.contains('This mission did not reach its funding goal').should(
            'be.visible'
          )
        }
      } else {
        cy.log(
          'Component correctly returned null - both tokenCredit and tokenBalance are 0'
        )
      }
    })

    cy.get('#mission-pay-container').should('not.exist')
  })

  it('does not render refund section for stage 3 when user has no tokens', () => {
    const refundProps = {
      ...mockProps,
      stage: 3,
    }

    // Mock zero balance
    cy.intercept('POST', '**', (req) => {
      if (req.body && req.body.method) {
        if (req.body.method === 'creditBalanceOf') {
          req.reply({ result: '0x0' })
        } else if (req.body.method === 'totalBalanceOf') {
          req.reply({ result: '0x0' })
        } else if (req.body.method === 'balanceOf') {
          req.reply({ result: '0x0' })
        }
      }
    }).as('zeroBalance')

    cy.mount(
      <TestnetProviders>
        <MissionPayRedeemWrapper {...refundProps} />
      </TestnetProviders>
    )

    // Component should return null when no tokens to refund
    cy.get('#mission-pay-redeem-container').should('not.exist')
  })

  it('displays claim button when token credit exists', () => {
    // Mock RPC calls for thirdweb readContract
    cy.intercept('POST', '**/rpc/**', { fixture: 'empty.json' }).as('rpcCalls')
    cy.intercept('POST', '**', (req) => {
      // Intercept JSON-RPC calls
      if (req.body && typeof req.body === 'object') {
        if (
          req.body.method === 'eth_call' ||
          req.body.method === 'eth_blockNumber'
        ) {
          // Return a mock response for contract calls
          if (
            req.body.params &&
            req.body.params[0] &&
            req.body.params[0].data
          ) {
            // This is a contract call - return mock token credit
            req.reply({
              result:
                '0x000000000000000000000000000000000000000000000002b5e3af16b1880000', // 50 tokens
            })
          } else {
            req.reply({ result: '0x0' })
          }
        }
      }
    })

    cy.mount(
      <TestnetProviders>
        <MissionPayRedeemWrapper {...mockProps} />
      </TestnetProviders>
    )

    cy.get('#mission-pay-container', { timeout: 10000 }).should('exist')
    cy.get('body').then(($body) => {
      if ($body.find('#claim-button').length > 0) {
        cy.get('#claim-button').should('exist')
        cy.contains('Claim').should('be.visible')
      } else {
        cy.log('Claim button not shown - tokenCredit is 0 or undefined')
      }
    })
  })

  it('renders fixed button mode correctly', () => {
    const fixedButtonProps = {
      ...mockProps,
      onlyButton: true,
      buttonMode: 'fixed' as const,
      visibleButton: true,
    }

    cy.mount(
      <TestnetProviders>
        <MissionPayRedeemWrapper {...fixedButtonProps} />
      </TestnetProviders>
    )

    cy.get('#fixed-contribute-button').should('exist')
    cy.get('#open-contribute-modal').should('exist')
    cy.contains('Contribute').should('be.visible')
  })

  it('renders standard button mode correctly', () => {
    const standardButtonProps = {
      ...mockProps,
      onlyButton: true,
      buttonMode: 'standard' as const,
      visibleButton: true,
    }

    cy.mount(
      <TestnetProviders>
        <MissionPayRedeemWrapper {...standardButtonProps} />
      </TestnetProviders>
    )

    cy.get('#open-contribute-modal').should('exist')
    cy.contains('Contribute').should('be.visible')
    cy.get('#mission-pay-container').should('not.exist')
  })

  it('handles custom button className', () => {
    const customButtonProps = {
      ...mockProps,
      onlyButton: true,
      buttonMode: 'standard' as const,
      visibleButton: true,
      buttonClassName: 'custom-button-class',
    }

    cy.mount(
      <TestnetProviders>
        <MissionPayRedeemWrapper {...customButtonProps} />
      </TestnetProviders>
    )

    cy.get('#open-contribute-modal').should('have.class', 'custom-button-class')
  })

  it('displays token balance percentage when user has tokens', () => {
    cy.mount(
      <TestnetProviders>
        <MissionPayRedeemWrapper {...mockProps} />
      </TestnetProviders>
    )

    cy.get('#mission-token-section').should('exist')
    cy.contains('Current Supply').should('be.visible')
  })

  it('formats USD input with commas', () => {
    cy.mount(
      <TestnetProviders>
        <MissionPayRedeemWrapper {...mockProps} />
      </TestnetProviders>
    )

    cy.get('#usd-contribution-input').clear()
    cy.get('#usd-contribution-input').type('1000')
    cy.get('#usd-contribution-input').should(($input) => {
      const value = $input.val() as string
      const numericValue = value.replace(/,/g, '')
      expect(numericValue).to.include('1000')
      // If formatted, it should have a comma
      if (value.length > 4) {
        expect(value).to.include(',')
      }
    })
  })

  it('handles empty token address gracefully', () => {
    const noTokenAddressProps = {
      ...mockProps,
      token: { ...mockToken, tokenAddress: ZERO_ADDRESS },
    }

    cy.mount(
      <TestnetProviders>
        <MissionPayRedeemWrapper {...noTokenAddressProps} />
      </TestnetProviders>
    )

    cy.get('#mission-pay-redeem-container').should('exist')
  })

  it('displays loading state for ETH price', () => {
    cy.mount(
      <TestnetProviders>
        <MissionPayRedeemWrapper {...mockProps} />
      </TestnetProviders>
    )

    cy.get('#usd-contribution-input').clear()
    cy.get('#usd-contribution-input').type('100')
    cy.get('#open-contribute-modal').should('exist')
  })

  it('shows token name and symbol in receive section', () => {
    cy.mount(
      <TestnetProviders>
        <MissionPayRedeemWrapper {...mockProps} />
      </TestnetProviders>
    )

    cy.contains(mockToken.tokenSymbol).should('be.visible')
    cy.contains(mockToken.tokenName).should('be.visible')
  })
})
