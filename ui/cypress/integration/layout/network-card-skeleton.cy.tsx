import NetworkCardSkeleton from '@/components/layout/NetworkCardSkeleton'

describe('<NetworkCardSkeleton />', () => {
  it('Renders skeleton with animation', () => {
    cy.mount(<NetworkCardSkeleton />)
    cy.get('.animate-pulse').should('exist')
  })

  it('Uses the Skeleton primitive with network variant', () => {
    cy.mount(<NetworkCardSkeleton />)
    cy.get('.animate-pulse').should('exist')
    cy.get('.bg-white\\/5').should('exist')
  })

  it('Renders correctly on mobile', () => {
    cy.viewport('iphone-x')
    cy.mount(<NetworkCardSkeleton />)
    cy.get('.animate-pulse').should('exist')
  })

  it('Renders correctly on tablet', () => {
    cy.viewport('ipad-2')
    cy.mount(<NetworkCardSkeleton />)
    cy.get('.animate-pulse').should('exist')
  })

  it('Renders correctly on desktop', () => {
    cy.viewport('macbook-15')
    cy.mount(<NetworkCardSkeleton />)
    cy.get('.animate-pulse').should('exist')
  })
})

