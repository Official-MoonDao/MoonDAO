import Skeleton from '@/components/layout/Skeleton'

describe('<Skeleton />', () => {
  describe('Variants', () => {
    it('Renders card variant (default)', () => {
      cy.mount(<Skeleton variant="card" />)
      cy.get('.animate-pulse').should('exist')
      cy.get('#link-frame').should('exist')
    })

    it('Renders mission variant', () => {
      cy.mount(<Skeleton variant="mission" />)
      cy.get('.animate-pulse').should('exist')
      cy.get('section').should('exist')
    })

    it('Renders section variant', () => {
      cy.mount(<Skeleton variant="section" />)
      cy.get('.animate-pulse').should('exist')
      cy.get('.min-h-\\[400px\\]').should('exist')
    })

    it('Renders asset variant', () => {
      cy.mount(<Skeleton variant="asset" />)
      cy.get('.animate-pulse').should('exist')
      cy.get('.bg-white\\/5').should('exist')
    })

    it('Renders proposal variant', () => {
      cy.mount(<Skeleton variant="proposal" />)
      cy.get('.animate-pulse').should('exist')
      cy.get('.rounded-xl').should('exist')
    })

    it('Renders custom variant with children', () => {
      cy.mount(
        <Skeleton variant="custom">
          <div data-cy="custom-content">Custom skeleton content</div>
        </Skeleton>
      )
      cy.get('[data-cy="custom-content"]').should('be.visible')
    })
  })

  describe('Layouts', () => {
    it('Renders single layout (default)', () => {
      cy.mount(<Skeleton variant="card" layout="single" />)
      cy.get('.animate-pulse').should('have.length', 1)
    })

    it('Renders grid layout with multiple skeletons', () => {
      cy.mount(<Skeleton variant="card" layout="grid" count={3} />)
      cy.get('.grid').should('exist')
      cy.get('.grid > div').should('have.length', 3)
    })

    it('Renders list layout with multiple skeletons', () => {
      cy.mount(<Skeleton variant="card" layout="list" count={5} />)
      cy.get('.space-y-4').should('exist')
      cy.get('.space-y-4 > div').should('have.length', 5)
    })
  })

  describe('Props', () => {
    it('Applies custom minHeight', () => {
      cy.mount(<Skeleton variant="card" minHeight="min-h-[600px]" />)
      cy.get('.min-h-\\[600px\\]').should('exist')
    })

    it('Applies custom className', () => {
      cy.mount(<Skeleton variant="card" className="custom-skeleton-class" />)
      cy.get('.custom-skeleton-class').should('exist')
    })

    it('Respects count prop', () => {
      cy.mount(<Skeleton variant="network" layout="list" count={4} />)
      cy.get('.space-y-4 > div').should('have.length', 4)
    })
  })

  describe('Section Variant with Grid Layout', () => {
    it('Renders section skeleton with grid layout', () => {
      cy.mount(<Skeleton variant="section" layout="grid" />)
      cy.get('.grid').should('exist')
      cy.get('.h-48').should('have.length', 3)
    })
  })

  describe('Animation', () => {
    it('Has animate-pulse class', () => {
      cy.mount(<Skeleton variant="card" />)
      cy.get('.animate-pulse').should('exist')
    })

    it('All variants have pulse animation', () => {
      const variants = ['card', 'network', 'mission', 'section', 'asset', 'proposal']
      variants.forEach((variant) => {
        cy.mount(<Skeleton variant={variant as any} />)
        cy.get('.animate-pulse').should('exist')
      })
    })
  })

  describe('Responsive Behavior', () => {
    it('Renders correctly on mobile', () => {
      cy.viewport('iphone-x')
      cy.mount(<Skeleton variant="network" />)
      cy.get('.animate-pulse').should('exist')
    })

    it('Renders correctly on tablet', () => {
      cy.viewport('ipad-2')
      cy.mount(<Skeleton variant="mission" />)
      cy.get('.animate-pulse').should('exist')
    })

    it('Renders correctly on desktop', () => {
      cy.viewport('macbook-15')
      cy.mount(<Skeleton variant="card" />)
      cy.get('.animate-pulse').should('exist')
    })
  })

  describe('Grid Layout Responsiveness', () => {
    it('Grid layout renders correctly on mobile', () => {
      cy.viewport('iphone-x')
      cy.mount(<Skeleton variant="card" layout="grid" count={3} />)
      cy.get('.grid').should('exist')
      cy.get('.grid-cols-1').should('exist')
    })

    it('Grid layout renders correctly on desktop', () => {
      cy.viewport('macbook-15')
      cy.mount(<Skeleton variant="card" layout="grid" count={3} />)
      cy.get('.grid').should('exist')
      cy.get('.lg\\:grid-cols-3').should('exist')
    })
  })
})
