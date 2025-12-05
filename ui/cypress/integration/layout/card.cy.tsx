import TestnetProviders from '@/cypress/mock/TestnetProviders'
import React from 'react'
import Card from '../../../components/layout/Card'

describe('<Card />', () => {
  describe('Basic Functionality', () => {
    beforeEach(() => {
      cy.mountNextRouter('/')
    })

    it('Renders Card with basic props', () => {
      cy.mount(
        <Card
          icon="/assets/icon-passport.svg"
          header="Test Header"
          paragraph="Test paragraph"
          hovertext="Test hovertext"
        />
      )

      cy.get('#card-container').should('exist')
      cy.get('#featured-icon').should('be.visible')
    })

    it('Renders organization image when provided', () => {
      cy.mount(<Card orgimage="/test-org-image.jpg" header="Org Card" />)

      cy.get('#featured-image').should('be.visible')
      cy.get('#featured-image')
        .should('have.attr', 'src')
        .and('include', 'url=%2Ftest-org-image.jpg')
    })

    it('Displays citizen discord when available', () => {
      cy.mount(
        <TestnetProviders>
          <Card type="citizen" header="Test Citizen" />
        </TestnetProviders>
      )

      cy.get('#card-container').should('exist')
    })

    it('Shows hovertext on desktop', () => {
      cy.viewport('macbook-15')
      cy.mount(<Card header="Hover Test" hovertext="Test hovertext" />)

      cy.get('#hovertext').should('have.class', 'hidden').and('have.class', 'md:block')
      cy.get('#card-container').trigger('mouseover')
      cy.get('#hovertext').should('be.visible').and('contain', 'Test hovertext')
    })

    it('Shows mobile button instead of hovertext on mobile', () => {
      cy.viewport('iphone-x')
      cy.mount(
        <TestnetProviders>
          <Card header="Mobile Test" hovertext="Test hovertext" />
        </TestnetProviders>
      )

      cy.get('#mobile-button-container').should('be.visible')
      cy.get('#hovertext').should('have.class', 'hidden')
    })

    it('Renders link when provided', () => {
      cy.mountNextRouter('/')
      cy.mount(<Card header="Link Test" link="/test-link" />)

      cy.get('#card-link').should('have.attr', 'href', '/test-link')
    })

    it('Handles onClick callback', () => {
      const onClickSpy = cy.spy().as('onClickSpy')
      cy.mount(<Card header="Click Test" onClick={onClickSpy} />)

      cy.get('button').click()
      cy.get('@onClickSpy').should('have.been.called')
    })
  })

  describe('Variants', () => {
    beforeEach(() => {
      cy.mountNextRouter('/')
    })

    it('Renders gradient variant (default)', () => {
      cy.mount(<Card variant="gradient" header="Gradient Card" />)
      cy.get('#card-container').should('exist')
    })

    it('Renders slate variant', () => {
      cy.mount(<Card variant="slate" header="Slate Card" paragraph="Slate description" />)
      cy.contains('Slate Card').should('be.visible')
    })

    it('Renders slateBorder variant', () => {
      cy.mount(
        <Card variant="slateBorder" header="Slate Border Card" paragraph="Border description" />
      )
      cy.contains('Slate Border Card').should('be.visible')
    })

    it('Renders launchpad variant with gradients', () => {
      cy.mount(
        <Card
          variant="launchpad"
          layout="launchpad"
          header="Launchpad Card"
          paragraph="Launchpad description"
          icon="/test-icon.svg"
          gradientFrom="from-purple-500/20"
          gradientTo="to-blue-500/20"
        />
      )
      cy.contains('Launchpad Card').should('be.visible')
    })
  })

  describe('Layouts', () => {
    beforeEach(() => {
      cy.mountNextRouter('/')
    })

    it('Renders stats layout with value and trend', () => {
      cy.mount(
        <Card
          variant="stats"
          layout="stats"
          header="Active Users"
          stats={{
            value: 1234,
            subtitle: 'Monthly',
            trend: { value: '+12%', isPositive: true },
          }}
          icon={<div>📊</div>}
        />
      )

      cy.contains('Active Users').should('be.visible')
      cy.contains('1,234').should('be.visible')
      cy.contains('+12%').should('be.visible')
      cy.contains('Monthly').should('be.visible')
    })

    it('Renders launchpad layout with stats', () => {
      cy.mount(
        <Card
          variant="launchpad"
          layout="launchpad"
          header="Achievement"
          paragraph="Description here"
          icon="/test-icon.svg"
          stats={{ value: '8M', subtitle: 'Raised' }}
          gradientFrom="from-purple-500/20"
          gradientTo="to-blue-500/20"
        />
      )

      cy.contains('8M').should('be.visible')
      cy.contains('Achievement').should('be.visible')
    })

    it('Renders feature layout with badges', () => {
      cy.mount(
        <Card
          variant="gradient"
          layout="feature"
          header="Multi-Chain"
          paragraph="Available on multiple chains"
          icon={<div>🌐</div>}
          badges={['ETH', 'ARB', 'MATIC', 'BASE']}
        />
      )

      cy.contains('Multi-Chain').should('be.visible')
      cy.contains('ETH').should('be.visible')
      cy.contains('ARB').should('be.visible')
      cy.contains('MATIC').should('be.visible')
      cy.contains('BASE').should('be.visible')
    })

    it('Renders wide layout with profile content', () => {
      cy.mount(
        <Card
          layout="wide"
          header="Team Name"
          paragraph="Team description goes here"
          image="/test-image.jpg"
          actions={<button>Action Button</button>}
        />
      )

      cy.contains('Team Name').should('be.visible')
      cy.contains('Action Button').should('be.visible')
    })
  })

  describe('Props Combinations', () => {
    beforeEach(() => {
      cy.mountNextRouter('/')
    })

    it('Renders with icon as string', () => {
      cy.mount(<Card header="Icon Test" icon="/test-icon.svg" paragraph="Description" />)
      cy.get('img[alt=""]').should('exist')
    })

    it('Renders with icon as ReactNode', () => {
      cy.mount(
        <Card
          header="Icon Test"
          icon={<div data-cy="custom-icon">🚀</div>}
          paragraph="Description"
        />
      )
      cy.get('[data-cy="custom-icon"]').should('be.visible')
    })

    it('Renders with actions and footer', () => {
      cy.mount(
        <Card
          header="Action Card"
          paragraph="Description"
          actions={<button data-cy="action-btn">Action</button>}
          footer={<div data-cy="footer">Footer content</div>}
        />
      )

      cy.get('[data-cy="action-btn"]').should('be.visible')
      cy.get('[data-cy="footer"]').should('be.visible')
    })

    it('Applies custom className', () => {
      cy.mount(<Card header="Custom Class" className="custom-test-class" />)
      cy.get('.custom-test-class').should('exist')
    })

    it('Respects padding prop', () => {
      cy.mount(<Card header="Padding Test" padding="sm" />)
      cy.get('#content-container').should('exist')
    })
  })

  describe('Loading State', () => {
    beforeEach(() => {
      cy.mountNextRouter('/')
    })

    it('Shows loading spinner when loading prop is true', () => {
      cy.mount(<Card loading={true} />)
      cy.get('button.btn-disabled', { timeout: 5000 }).should('exist')
    })
  })

  describe('Responsive Behavior', () => {
    beforeEach(() => {
      cy.mountNextRouter('/')
    })

    it('Renders correctly on mobile', () => {
      cy.viewport('iphone-x')
      cy.mount(
        <Card
          header="Mobile Test"
          paragraph="This should render well on mobile"
          icon="/test-icon.svg"
        />
      )
      cy.contains('Mobile Test').should('be.visible')
    })

    it('Renders correctly on tablet', () => {
      cy.viewport('ipad-2')
      cy.mount(
        <Card
          header="Tablet Test"
          paragraph="This should render well on tablet"
          icon="/test-icon.svg"
        />
      )
      cy.contains('Tablet Test').should('be.visible')
    })

    it('Renders correctly on desktop', () => {
      cy.viewport('macbook-15')
      cy.mount(
        <Card
          header="Desktop Test"
          paragraph="This should render well on desktop"
          icon="/test-icon.svg"
        />
      )
      cy.contains('Desktop Test').should('be.visible')
    })
  })
})
