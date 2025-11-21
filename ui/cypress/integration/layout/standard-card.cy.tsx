import React from 'react'
import Card from '../../../components/layout/Card'

describe('<Card />', () => {
  it('renders with basic props', () => {
    cy.mountNextRouter('/')
    cy.mount(
      <Card
        variant="gradient"
        id="card-container"
        icon="/assets/test-icon.svg"
        header="Test Header"
        paragraph="Test paragraph"
        hovertext="Test hovertext"
      />
    )

    cy.get('#card-container').should('exist')
    cy.get('#featured-icon').should('be.visible')
    cy.get('#main-header').should('contain', 'Test Header')
  })

  it('renders organization image when provided', () => {
    cy.mountNextRouter('/')
    cy.mount(
      <Card variant="gradient"
        id="card-container"
        orgimage="/test-org-image.jpg"
        header="Org Card"
      />
    )

    cy.get('#featured-image').should('be.visible')
    cy.get('#featured-image')
      .should('have.attr', 'src')
      .and('include', 'url=%2Ftest-org-image.jpg')
  })

  it('renders header link when provided', () => {
    cy.mountNextRouter('/')
    cy.mount(
      <Card variant="gradient"
        id="card-container"
        header="Link Test"
        headerLink="/test-link"
        headerLinkLabel="Click Here"
      />
    )

    cy.get('button').contains('Click Here').should('exist')
  })

  it('shows hovertext on desktop', () => {
    cy.mountNextRouter('/')
    cy.viewport('macbook-15')
    cy.mount(
      <Card variant="gradient"
        id="card-container"
        header="Hover Test"
        hovertext="Test hovertext"
      />
    )

    cy.get('#hovertext')
      .should('have.class', 'hidden')
      .and('have.class', 'md:block')
    cy.get('#card-container').trigger('mouseover')
    cy.get('#hovertext').should('be.visible').and('contain', 'Test hovertext')
  })

  it('shows mobile button instead of hovertext on mobile', () => {
    cy.mountNextRouter('/')
    cy.viewport('iphone-x')
    cy.mount(
      <Card variant="gradient"
        id="card-container"
        header="Mobile Test"
        hovertext="Test hovertext"
      />
    )

    cy.get('#mobile-button-container').should('be.visible')
    cy.get('#hovertext').should('have.class', 'hidden')
  })

  it('renders link when provided', () => {
    cy.mountNextRouter('/')
    cy.mount(
      <Card variant="gradient" id="card-container" header="Link Test" link="/test-link" />
    )

    cy.get('#card-link').should('have.attr', 'href', '/test-link')
  })

  it('handles onClick when provided', () => {
    const onClickSpy = cy.spy().as('onClickSpy')
    cy.mountNextRouter('/')
    cy.mount(
      <Card variant="gradient"
        id="card-container"
        header="Click Test"
        onClick={onClickSpy}
      />
    )

    cy.get('button').click()
    cy.get('@onClickSpy').should('have.been.called')
  })
})
