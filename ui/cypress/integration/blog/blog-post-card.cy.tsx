import type { BlogPostMeta } from '@/lib/blog/types'
import BlogPostCard from '@/components/blog/BlogPostCard'

const post: BlogPostMeta = {
  slug: 'the-master-plan',
  filePath: '2023-09-12-the-master-plan.md',
  title: 'The Master Plan',
  description: 'Why MoonDAO exists.',
  date: '2023-09-12',
  author: 'Pablo Moncada-Larrotiz',
  authorRole: 'Founder',
  tags: ['ideas'],
  featured: true,
  draft: false,
  readingMinutes: 20,
}

describe('<BlogPostCard />', () => {
  beforeEach(() => {
    cy.mountNextRouter('/')
  })

  it('renders title, dek, and a link to the post', () => {
    cy.mount(<BlogPostCard post={post} />)
    cy.contains('The Master Plan').should('be.visible')
    cy.contains('Why MoonDAO exists.').should('be.visible')
    cy.contains('Pablo Moncada-Larrotiz').should('be.visible')
    cy.get('a').should('have.attr', 'href', '/blog/the-master-plan')
  })
})
