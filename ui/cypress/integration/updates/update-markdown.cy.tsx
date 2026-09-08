import UpdateMarkdown from '@/components/updates/UpdateMarkdown'

describe('<UpdateMarkdown />', () => {
  beforeEach(() => {
    cy.mountNextRouter('/')
  })

  it('renders headings, paragraphs, and internal links', () => {
    cy.mount(
      <UpdateMarkdown
        body={`# Hello

A paragraph with a [docs link](/docs/About/The-Master-Plan) and a [updates link](/updates).
`}
      />
    )
    cy.get('h1').should('contain', 'Hello')
    cy.contains('A paragraph with a').should('be.visible')
    cy.get('a').contains('docs link').should('have.attr', 'href', '/docs/About/The-Master-Plan')
    cy.get('a').contains('updates link').should('have.attr', 'href', '/updates')
  })
})
