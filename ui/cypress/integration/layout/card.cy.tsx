import TestnetProviders from '@/cypress/mock/TestnetProviders'
import React from 'react'
import Card from '../../../components/layout/Card'

describe('<Card />', () => {
  it('Renders Card with basic props', () => {
    cy.mountNextRouter('/')
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
    cy.get('#main-header').should('contain', 'Test Header')
    cy.get('#description-and-id').should('contain', 'Test paragraph')
  })

  it('Renders organization image when provided', () => {
    cy.mountNextRouter('/')
    cy.mount(<Card orgimage="/test-org-image.jpg" header="Org Card" />)

    cy.get('#featured-image').should('be.visible')
    cy.get('#featured-image')
      .should('have.attr', 'src')
      .and('include', 'url=%2Ftest-org-image.jpg')
  })

  it('Displays citizen discord when available', () => {
    const metadata = {
      attributes: [{ trait_type: 'discord', value: 'testuser' }],
      name: 'Test Citizen',
      id: '1',
    }

    cy.mountNextRouter('/')

    cy.mount(
      <TestnetProviders>
        <Card type="citizen" metadata={metadata} />
      </TestnetProviders>
    )

    cy.get('#handle-container').should('contain', 'Discord: @testuser')
  })

  it('Shows hovertext on desktop', () => {
    cy.mountNextRouter('/')
    cy.viewport('macbook-15')
    cy.mount(<Card header="Hover Test" hovertext="Test hovertext" />)

    cy.get('#hovertext')
      .should('have.class', 'hidden')
      .and('have.class', 'md:block')
    cy.get('#card-container').trigger('mouseover')
    cy.get('#hovertext').should('be.visible').and('contain', 'Test hovertext')
  })

  it('Shows mobile button instead of hovertext on mobile', () => {
    cy.mountNextRouter('/')
    cy.viewport('iphone-x')
    cy.mount(
      <TestnetProviders>
        <Card
          header="Mobile Test"
          hovertext="Test hovertext"
          metadata={{ name: 'Test' }}
        />
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
})
