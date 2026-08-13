import React from 'react'
import ExpandableText from '../../../components/layout/ExpandableText'

const LONG_TEXT =
  'Join Loretta Hidalgo Whitesides on an 8-week Hero\'s Journey to help you take on the next level of your life. Level up your leadership, communication, and presence with weekly training, coaching, and community. This program is designed to meet you where you are and take you further than you thought possible.'

describe('<ExpandableText />', () => {
  it('Does not show a Read more control for short text', () => {
    cy.mount(
      <div className="w-[360px]">
        <ExpandableText className="text-sm">Short description</ExpandableText>
      </div>
    )

    cy.get('[data-testid="expandable-text"]').should('contain', 'Short description')
    cy.get('[data-testid="expandable-text-toggle"]').should('not.exist')
  })

  it('Reveals the full text when it overflows the clamp', () => {
    cy.viewport(375, 667)
    cy.mount(
      <div className="w-[280px]">
        <ExpandableText className="text-sm leading-relaxed" lines={2}>
          {LONG_TEXT}
        </ExpandableText>
      </div>
    )

    cy.get('[data-testid="expandable-text"]').should('have.class', 'line-clamp-2')
    cy.get('[data-testid="expandable-text-toggle"]')
      .should('be.visible')
      .and('have.text', 'Read more')
      .click()

    cy.get('[data-testid="expandable-text"]').should('have.attr', 'data-expanded', 'true')
    cy.get('[data-testid="expandable-text"]').should('not.have.class', 'line-clamp-2')
    cy.get('[data-testid="expandable-text-toggle"]')
      .should('have.text', 'Show less')
      .click()

    cy.get('[data-testid="expandable-text"]').should('have.attr', 'data-expanded', 'false')
    cy.get('[data-testid="expandable-text"]').should('have.class', 'line-clamp-2')
  })

  it('Does not bubble the toggle click to a parent handler', () => {
    const onParentClick = cy.stub().as('parentClick')

    cy.viewport(375, 667)
    cy.mount(
      <div className="w-[280px]" onClick={onParentClick} role="button" tabIndex={0}>
        <ExpandableText className="text-sm leading-relaxed" lines={2}>
          {LONG_TEXT}
        </ExpandableText>
      </div>
    )

    cy.get('[data-testid="expandable-text-toggle"]').click()
    cy.get('@parentClick').should('not.have.been.called')
  })
})
