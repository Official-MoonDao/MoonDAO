import CardGrid from '@/components/layout/CardGrid'

describe('CardGrid', () => {
  const mockCards = [
    {
      icon: 'icon1.svg',
      iconAlt: 'Icon 1',
      header: 'Card 1',
      paragraph: 'Paragraph 1',
      link: 'https://example.com/1',
      hovertext: 'Hover 1',
    },
    {
      icon: 'icon2.svg',
      iconAlt: 'Icon 2',
      header: 'Card 2',
      paragraph: 'Paragraph 2',
      link: 'https://example.com/2',
      hovertext: 'Hover 2',
    },
  ]

  it('Renders the correct number of cards', () => {
    cy.mountNextRouter('/')
    cy.mount(<CardGrid cards={mockCards} />)
    cy.get('#grid-container > div').should('have.length', 2)
  })
})
