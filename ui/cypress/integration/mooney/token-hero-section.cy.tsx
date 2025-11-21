import TokenHeroSection from '@/components/mooney/TokenHeroSection'

describe('<TokenHeroSection />', () => {
  it('renders with required props', () => {
    cy.mount(
      <TokenHeroSection
        title="MOONEY TOKEN"
        description="Test description"
        imageSrc="/coins/MOONEY.png"
        imageAlt="MOONEY Token"
      />
    )

    cy.contains('MOONEY TOKEN').should('exist')
    cy.contains('Test description').should('exist')
  })

  it('displays CTA buttons when provided', () => {
    cy.mount(
      <TokenHeroSection
        title="MOONEY TOKEN"
        description="Test description"
        imageSrc="/coins/MOONEY.png"
        imageAlt="MOONEY Token"
        ctaButtons={<button>Buy MOONEY</button>}
      />
    )

    cy.contains('Buy MOONEY').should('exist')
  })

  it('applies custom background image', () => {
    cy.mount(
      <TokenHeroSection
        title="MOONEY TOKEN"
        description="Test description"
        imageSrc="/coins/MOONEY.png"
        imageAlt="MOONEY Token"
        backgroundImage="/custom-bg.webp"
      />
    )

    cy.get('[style*="custom-bg.webp"]').should('exist')
  })
})
