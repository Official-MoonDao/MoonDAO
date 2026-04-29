import MissionProfileHeader from '../../../components/mission/MissionProfileHeader'
import TestnetProviders from '../../mock/TestnetProviders'

/**
 * Component-level tests for the MissionProfileHeader's "Overview Flight"
 * (mission id 4) variant — the wrapped-up raise has its progress bar /
 * milestones / Goal tile replaced with success metrics (Contributions,
 * Unique Backers, Median Contribution) and a 30-day Seat Procurement
 * Period panel anchored to the mission deadline.
 */

const baseTeamNFT = {
  metadata: {
    name: 'Overview Crew',
    image: '/Original.png',
    attributes: [],
  },
}

const baseRuleset = [
  {
    start: Math.floor(Date.now() / 1000) - 86400 * 60,
    weight: BigInt('1000000000000000000000000'),
  },
  { reservedPercent: BigInt('0') },
]

const baseToken = {
  tokenAddress: '0x1234567890123456789012345678901234567890',
  tokenSymbol: 'OVERVIEW',
  tokenName: 'Overview Token',
  tokenSupply: BigInt('1000000000000000000000'),
}

const overviewStats = {
  totalContributions: 250,
  uniqueBackers: 173,
  // 0.05 ETH median; at $3000/ETH → $150
  medianAmountWei: '50000000000000000',
  meanAmountWei: '100000000000000000',
  largestAmountWei: '5000000000000000000',
  totalAmountWei: '25000000000000000000',
}

function buildOverviewProps(overrides: Partial<any> = {}) {
  // Deadline 5 days ago by default — well within the 30-day seat
  // procurement window so the countdown should render.
  const deadline = Date.now() - 5 * 86400000
  return {
    mission: {
      id: 4,
      projectId: 224,
      teamId: 1,
      metadata: {
        name: 'Go to Space with Frank White',
        tagline: 'Wrapped-up Overview Flight raise',
        logoUri: '/Original.png',
      },
    },
    teamNFT: baseTeamNFT,
    ruleset: baseRuleset as any,
    fundingGoal: 1e18,
    paymentsCount: overviewStats.totalContributions,
    deadline,
    duration: 'closed',
    deadlinePassed: true,
    refundPeriodPassed: false,
    refundPeriod: deadline + 60 * 60 * 1000,
    stage: 2,
    token: baseToken,
    poolDeployerAddress: undefined,
    isManager: false,
    availableTokens: 0,
    availablePayouts: 0,
    sendReservedTokens: () => {},
    sendPayouts: () => {},
    deployLiquidityPool: () => {},
    totalFunding: BigInt('5000000000000000000'),
    isLoadingTotalFunding: false,
    setMissionMetadataModalEnabled: undefined,
    setDeployTokenModalEnabled: undefined,
    contributeButton: <button id="mock-contribute-btn">Contribute</button>,
    overviewStats,
    ...overrides,
  }
}

const setupMocks = () => {
  // Cypress matches intercepts in last-registered-first order, so the
  // specific ETH-price intercept must be registered AFTER the catch-all
  // `**/api/**` one to actually win over it.
  cy.intercept('GET', '**/api/**', { fixture: 'empty.json' }).as('apiCalls')
  cy.intercept('POST', '**/api/**', { fixture: 'empty.json' }).as('apiPosts')
  cy.intercept('GET', '**/api/etherscan/eth-price**', {
    statusCode: 200,
    body: { result: { ethusd: '3000' } },
  }).as('ethPrice')
}

describe('MissionProfileHeader — Overview Flight (mission 4) wrapped-up layout', () => {
  beforeEach(() => {
    cy.mountNextRouter('/')
    setupMocks()
  })

  it('does not render the funding progress bar', () => {
    cy.mount(
      <TestnetProviders>
        <MissionProfileHeader {...buildOverviewProps()} />
      </TestnetProviders>
    )
    // The progress bar wrapper carries a distinctive gradient class on its
    // fill element. None should appear inside the funding card.
    cy.get('[data-testid="overview-stats-row"]').should('exist')
    cy.get('.from-blue-500.via-purple-600.to-blue-500').should('not.exist')
  })

  it('does not render the milestones list or "Goal" tile', () => {
    cy.mount(
      <TestnetProviders>
        <MissionProfileHeader {...buildOverviewProps()} />
      </TestnetProviders>
    )
    cy.contains('Goal').should('not.exist')
    cy.contains('Stratospheric balloon seat #1').should('not.exist')
  })

  it('renders the success metrics (Contributions, Unique Backers, Median Contribution)', () => {
    cy.mount(
      <TestnetProviders>
        <MissionProfileHeader {...buildOverviewProps()} />
      </TestnetProviders>
    )
    cy.contains('Contributions').should('be.visible')
    cy.contains('250').should('be.visible')
    cy.get('[data-testid="overview-unique-backers"]').within(() => {
      cy.contains('Unique Backers').should('be.visible')
      cy.contains('173').should('be.visible')
    })
    cy.get('[data-testid="overview-median-contribution"]').within(() => {
      cy.contains('Median Contribution').should('be.visible')
      // 0.05 ETH * $3000 = $150
      cy.contains('$150').should('be.visible')
    })
  })

  it('renders the "contributions are now closed" banner directly above the Seat Procurement panel', () => {
    cy.mount(
      <TestnetProviders>
        <MissionProfileHeader {...buildOverviewProps()} />
      </TestnetProviders>
    )
    cy.get('[data-testid="overview-contributions-closed-banner"]').should(
      'be.visible'
    )
    cy.contains('Contributions are now closed').should('be.visible')
    cy.contains(/Overview Flight raise has wrapped up/).should('be.visible')
    // The banner must precede the Seat Procurement panel in the DOM order
    // so the user reads "closed" before "30-day refund window".
    cy.get(
      '[data-testid="overview-contributions-closed-banner"] ~ [data-testid="overview-seat-procurement-panel"]'
    ).should('exist')
  })

  it('renders the 30-day Seat Procurement Period panel with a live countdown', () => {
    const deadline = Date.now() - 5 * 86400000 // 5 days ago
    cy.mount(
      <TestnetProviders>
        <MissionProfileHeader {...buildOverviewProps({ deadline })} />
      </TestnetProviders>
    )
    cy.get('[data-testid="overview-seat-procurement-panel"]').should('exist')
    cy.contains('Seat Procurement Period').should('be.visible')
    // Expected end date label: deadline + 30 days
    const endLabel = new Date(deadline + 30 * 86400000).toLocaleDateString(
      'en-US',
      { month: 'long', day: 'numeric', year: 'numeric' }
    )
    cy.contains(endLabel).should('be.visible')
    cy.get('[data-testid="overview-seat-procurement-countdown"]').should(
      ($el) => {
        // ~25 days remain (30 - 5). Countdown format starts with "<n>d ".
        expect($el.text()).to.match(/^\d+d\s+\d+h$/)
      }
    )
    cy.contains(/Frank's team has 30 days from the close of the raise/).should(
      'be.visible'
    )
  })

  it('flips to the "period closed" copy after the 30-day window has elapsed', () => {
    // Deadline 45 days ago → past the 30-day procurement window
    const deadline = Date.now() - 45 * 86400000
    cy.mount(
      <TestnetProviders>
        <MissionProfileHeader {...buildOverviewProps({ deadline })} />
      </TestnetProviders>
    )
    cy.get('[data-testid="overview-seat-procurement-panel"]').should('exist')
    cy.contains('Period Closed').should('be.visible')
    cy.contains(/contributors are eligible for a refund/).should('be.visible')
    cy.get('[data-testid="overview-seat-procurement-countdown"]').should(
      'not.exist'
    )
  })

  it('still renders the headline raised amount and contribute button slot', () => {
    cy.mount(
      <TestnetProviders>
        <MissionProfileHeader {...buildOverviewProps()} />
      </TestnetProviders>
    )
    cy.contains('raised').should('be.visible')
    cy.get('#mock-contribute-btn').should('exist')
  })
})

describe('MissionProfileHeader — non-Overview missions are unaffected', () => {
  const baseMission = {
    id: 5,
    projectId: 999,
    teamId: 1,
    metadata: {
      name: 'Other Mission',
      tagline: 'Still uses progress bar / Goal',
      logoUri: '/Original.png',
    },
  }

  const defaultDeadline = Date.now() + 86400000
  const defaultProps = {
    mission: baseMission,
    teamNFT: baseTeamNFT,
    ruleset: baseRuleset as any,
    fundingGoal: 1e18,
    paymentsCount: 5,
    deadline: defaultDeadline,
    duration: '23h 59m',
    deadlinePassed: false,
    refundPeriodPassed: false,
    refundPeriod: defaultDeadline + 60 * 60 * 1000,
    stage: 1,
    token: baseToken,
    poolDeployerAddress: undefined,
    isManager: false,
    availableTokens: 0,
    availablePayouts: 0,
    sendReservedTokens: () => {},
    sendPayouts: () => {},
    deployLiquidityPool: () => {},
    totalFunding: BigInt('500000000000000000'),
    isLoadingTotalFunding: false,
    setMissionMetadataModalEnabled: undefined,
    setDeployTokenModalEnabled: undefined,
    contributeButton: <button id="mock-contribute-btn-other">Contribute</button>,
  }

  beforeEach(() => {
    cy.mountNextRouter('/')
    setupMocks()
  })

  it('still renders the Goal tile and Deadline tile for non-overview missions', () => {
    cy.mount(
      <TestnetProviders>
        <MissionProfileHeader {...defaultProps} />
      </TestnetProviders>
    )
    cy.contains('Goal').should('be.visible')
    cy.contains('Deadline').should('be.visible')
    cy.contains('Contributions').should('be.visible')
    cy.get('[data-testid="overview-seat-procurement-panel"]').should(
      'not.exist'
    )
    cy.get('[data-testid="overview-stats-row"]').should('not.exist')
  })
})
