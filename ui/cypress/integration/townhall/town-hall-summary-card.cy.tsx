import React from 'react'
import TownHallSummaryCard from '../../../components/townhall/TownHallSummaryCard'

const mockSummary = {
  id: '1',
  title: 'Test Town Hall Summary',
  content: '<h2>Topics Discussed</h2><p>This is the content of the summary.</p>',
  publishedAt: '2024-01-15T00:00:00Z',
  createdAt: '2024-01-15T00:00:00Z',
}

const mockSummaryWithVideo = {
  ...mockSummary,
  videoId: 'dQw4w9WgXcQ',
}

describe('<TownHallSummaryCard />', () => {
  it('renders with required props', () => {
    cy.mount(<TownHallSummaryCard summary={mockSummary} />)

    cy.contains(mockSummary.title).should('exist')
    cy.contains('Published:').should('exist')
  })

  it('starts in collapsed state', () => {
    cy.mount(<TownHallSummaryCard summary={mockSummary} />)

    cy.get('.line-clamp-3').should('exist')
    cy.get('.prose').should('not.exist')
  })

  it('expands when clicked', () => {
    cy.mount(<TownHallSummaryCard summary={mockSummary} />)

    cy.contains(mockSummary.title).closest('.cursor-pointer').click()

    cy.get('.prose').should('exist')
    cy.get('.line-clamp-3').should('not.exist')
  })

  it('collapses when clicked again', () => {
    cy.mount(<TownHallSummaryCard summary={mockSummary} />)

    cy.contains(mockSummary.title).closest('.cursor-pointer').click()
    cy.get('.prose').should('exist')

    cy.contains(mockSummary.title).closest('.cursor-pointer').click()
    cy.get('.line-clamp-3').should('exist')
  })

  it('shows YouTube embed when videoId is provided and expanded', () => {
    cy.mount(<TownHallSummaryCard summary={mockSummaryWithVideo} />)

    cy.get('iframe[title="YouTube video player"]').should('not.exist')

    cy.contains(mockSummaryWithVideo.title).closest('.cursor-pointer').click()

    cy.get('iframe[title="YouTube video player"]').should('exist')
    cy.get('iframe[src*="youtube.com/embed"]').should('exist')
  })

  it('does not show YouTube embed when videoId is not provided', () => {
    cy.mount(<TownHallSummaryCard summary={mockSummary} />)

    cy.contains(mockSummary.title).closest('.cursor-pointer').click()

    cy.get('iframe[title="YouTube video player"]').should('not.exist')
  })
})
