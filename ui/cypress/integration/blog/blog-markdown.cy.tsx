import BlogMarkdown from '@/components/blog/BlogMarkdown'

describe('<BlogMarkdown />', () => {
  beforeEach(() => {
    cy.mountNextRouter('/')
  })

  it('renders headings, paragraphs, and internal links', () => {
    cy.mount(
      <BlogMarkdown
        body={`# Hello

A paragraph with a [docs link](/docs/About/The-Master-Plan) and a [blog link](/blog).
`}
      />
    )
    cy.get('h1').should('contain', 'Hello')
    cy.contains('A paragraph with a').should('be.visible')
    cy.get('a').contains('docs link').should('have.attr', 'href', '/docs/About/The-Master-Plan')
    cy.get('a').contains('blog link').should('have.attr', 'href', '/blog')
  })
})
