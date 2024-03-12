import { ArrowRightIcon } from '@heroicons/react/24/outline'
import React from 'react'
import { PageCards } from '../../../components/layout/PageCards'

describe('<PageCards />', () => {
  it('Renders Page Cards', () => {
    const sections = [
      {
        sectionName: 'Test Section 1',
        pages: [
          {
            name: 'Page 1',
            description: 'Page 1 Description',
            icon: ArrowRightIcon,
          },
          {
            name: 'Page 2',
            description: 'Page 2 Description',
            icon: ArrowRightIcon,
          },
        ],
      },
      {
        sectionName: 'Test Section 2',
        pages: [
          {
            name: 'Page 3',
            description: 'Page 3 Description',
            icon: ArrowRightIcon,
          },
          {
            name: 'Page 4',
            description: 'Page 4 Description',
            icon: ArrowRightIcon,
          },
        ],
      },
    ]

    cy.mountNextRouter('/')

    cy.mount(
      <PageCards
        id="test-cards"
        sections={sections}
        title="Test Cards"
        description={'Test Cards Description'}
      />
    )

    cy.get('h1').contains('Test Cards')
    cy.get('div').contains('Test Cards Description')

    cy.get('#test-cards').children().should('have.length', 2)

    cy.get('#test-cards').children().first().contains(sections[0].sectionName)

    cy.get('#test-cards')
      .get('#test-cards-pages')
      .children()
      .should('have.length', 2)
  })
})
