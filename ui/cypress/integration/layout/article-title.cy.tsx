import ArticleTitle from '@/components/layout/ArticleTitle'

describe('ArticleTitle', () => {
  it('Renders the title text', () => {
    cy.mount(<ArticleTitle text="Test Title" link="#" />)
    cy.get('h3').should('contain.text', 'Test Title')
  })
})
