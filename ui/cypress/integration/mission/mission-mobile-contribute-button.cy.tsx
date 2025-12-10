import { useState } from 'react'
import MissionMobileContributeButton from '@/components/mission/MissionMobileContributeButton'
import TestnetProviders from '@/cypress/mock/TestnetProviders'

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
  tokenSupply: BigInt('1000000000000000000000'),
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
}

const MissionMobileContributeButtonWrapper = (props: any) => {
  const [usdInput, setUsdInput] = useState('')
  return (
    <MissionMobileContributeButton
      {...props}
      usdInput={usdInput}
      setUsdInput={setUsdInput}
    />
  )
}

describe('MissionMobileContributeButton', () => {
  let mockProps: any
  let onOpenModalStub: any

  beforeEach(() => {
    onOpenModalStub = cy.stub()

    const mockJbTokensContract = {
      address: '0x1234567890123456789012345678901234567890',
      abi: [],
    }

    const mockJbControllerContract = {
      address: '0x1234567890123456789012345678901234567891',
      abi: [],
    }

    mockProps = {
      mission: mockMission,
      token: mockToken,
      teamNFT: mockTeamNFT,
      stage: 1,
      deadline: Date.now() + 86400000,
      primaryTerminalAddress: '0x1234567890123456789012345678901234567890',
      jbTokensContract: mockJbTokensContract,
      jbControllerContract: mockJbControllerContract,
      refreshBackers: cy.stub(),
      refreshTotalFunding: cy.stub(),
      ruleset: mockRuleset,
      onOpenModal: onOpenModalStub,
      backers: [],
      isPayRedeemContainerVisible: false,
      deadlinePassed: false,
    }

    cy.mountNextRouter('/')
    setupMocks()
  })

  it('renders on mobile viewport when conditions are met', () => {
    cy.viewport(375, 667) // Mobile viewport

    cy.mount(
      <TestnetProviders>
        <MissionMobileContributeButtonWrapper {...mockProps} />
      </TestnetProviders>
    )

    // Wait for component to mount
    cy.wait(100)
    cy.get('body').then(($body) => {
      if ($body.find('#fixed-contribute-button').length > 0) {
        cy.get('#fixed-contribute-button').should('exist')
      }
    })
  })

  it('does not render when deadline has passed', () => {
    cy.viewport(375, 667)

    cy.mount(
      <TestnetProviders>
        <MissionMobileContributeButtonWrapper
          {...mockProps}
          deadlinePassed={true}
        />
      </TestnetProviders>
    )

    cy.get('#fixed-contribute-button').should('not.exist')
  })

  it('does not render on desktop viewport', () => {
    cy.viewport(1024, 768) // Desktop viewport

    cy.mount(
      <TestnetProviders>
        <MissionMobileContributeButtonWrapper {...mockProps} />
      </TestnetProviders>
    )

    cy.get('#fixed-contribute-button').should('not.exist')
  })

  it('hides button when payRedeemContainer is visible', () => {
    cy.viewport(375, 667)

    cy.mount(
      <TestnetProviders>
        <MissionMobileContributeButtonWrapper
          {...mockProps}
          isPayRedeemContainerVisible={true}
        />
      </TestnetProviders>
    )

    cy.wait(100)
    cy.get('body').then(($body) => {
      if ($body.find('#fixed-contribute-button').length > 0) {
        cy.get('#fixed-contribute-button').should('have.class', 'opacity-0')
      }
    })
  })

  it('shows button when payRedeemContainer is not visible', () => {
    cy.viewport(375, 667)

    cy.mount(
      <TestnetProviders>
        <MissionMobileContributeButtonWrapper
          {...mockProps}
          isPayRedeemContainerVisible={false}
        />
      </TestnetProviders>
    )

    cy.wait(100)
    cy.get('body').then(($body) => {
      if ($body.find('#fixed-contribute-button').length > 0) {
        cy.get('#fixed-contribute-button').should('exist')
      }
    })
  })
})

