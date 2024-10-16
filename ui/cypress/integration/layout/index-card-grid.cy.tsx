import IndexCardGrid from '@/components/layout/IndexCardGrid'

describe('<IndexCardGrid />', () => {
  let cards: any[]
  beforeEach(() => {
    cards = [
      {
        icon: '/Original.png',
        iconAlt: 'Icon 1',
        header: 'Header 1',
        paragraph: 'This is a paragraph for card 1',
        link: 'https://example.com/1',
        onClick: () => console.log('Card 1 clicked'),
        hovertext: 'Hover over card 1',
      },
      {
        icon: '/Original.png',
        iconAlt: 'Icon 2',
        header: 'Header 2',
        paragraph: 'This is a paragraph for card 2',
        link: 'https://example.com/2',
        onClick: () => console.log('Card 2 clicked'),
        hovertext: 'Hover over card 2',
      },
    ]
    cy.mountNextRouter('/')
  })

  it('Renders correctly with default props', () => {
    cy.mount(<IndexCardGrid cards={cards} />)
    cy.get('#index-grid-container').should('exist')
    cy.get('#index-grid-container')
      .children()
      .should('have.length', cards.length)
  })

  it('Renders in single column layout', () => {
    cy.mount(<IndexCardGrid cards={cards} singleCol />)
    cy.get('#index-grid-container').should('have.class', 'grid-cols-1')
  })

  it('Renders in three column layout', () => {
    cy.mount(<IndexCardGrid cards={cards} threeCol />)
    cy.get('#index-grid-container').should('have.class', 'lg:grid-cols-3')
  })
})
