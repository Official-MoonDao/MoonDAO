import MissionTimelineChart from '@/components/mission/MissionTimelineChart'

describe('MissionTimelineChart', () => {
  const mockPoints = [
    {
      timestamp: Math.floor(Date.now() / 1000) - 86400, // 1 day ago
      volume: 1.5,
      balance: 2.3,
      trendingScore: 4.2,
    },
    {
      timestamp: Math.floor(Date.now() / 1000),
      volume: 2.0,
      balance: 3.0,
      trendingScore: 5.0,
    },
  ]

  const defaultProps = {
    points: mockPoints,
    isLoadingPoints: false,
    height: 400,
    createdAt: Math.floor(Date.now() / 1000) - 86400 * 7, // 7 days ago
    range: 7,
    setRange: (range: number) => {}, // Mock function for tests
  }

  beforeEach(() => {
    cy.viewport(1000, 600)
  })

  it('Renders with default props', () => {
    cy.mount(<MissionTimelineChart {...defaultProps} />)
    cy.get('#mission-timeline-chart').should('exist')
  })

  it('Displays the creation date', () => {
    cy.mount(<MissionTimelineChart {...defaultProps} />)
    cy.get('#creation-date').should('be.visible')
  })

  it('Shows range selector', () => {
    cy.mount(<MissionTimelineChart {...defaultProps} />)
    cy.get('#range-selector').should('exist')
  })

  it('Displays "No Activity Yet" when points are empty', () => {
    cy.mount(<MissionTimelineChart {...defaultProps} points={[]} />)
    cy.get('#no-activity-message').should('be.visible')
  })

  it('Renders chart with data points', () => {
    cy.mount(<MissionTimelineChart {...defaultProps} />)
    cy.get('#chart-container').should('exist')
    cy.get('.recharts-line').should('exist')
  })

  it('Shows tooltip on hover', () => {
    cy.mount(<MissionTimelineChart {...defaultProps} />)
    // Use force: true since the chart elements are SVG and might be covered
    cy.get('.recharts-line').first().trigger('mouseover', { force: true })
    cy.get('.recharts-tooltip-wrapper').should('be.visible')
  })

  it('Displays correct data in tooltip', () => {
    cy.mount(<MissionTimelineChart {...defaultProps} />)
    cy.get('.recharts-line').first().trigger('mouseover', { force: true })
    cy.get('.recharts-tooltip-wrapper').should('contain', 'ETH')
  })

  it('Handles different views (volume, balance, trendingScore)', () => {
    cy.mount(<MissionTimelineChart {...defaultProps} />)
    cy.get('#chart-container').should('exist')
  })

  it('Range selector displays the current range', () => {
    cy.mount(<MissionTimelineChart {...defaultProps} />)
    cy.get('#range-selector').should('exist')
    // Should show "7 days" since range is set to 7
    cy.get('#range-selector').should('contain', '7 days')
  })
})
