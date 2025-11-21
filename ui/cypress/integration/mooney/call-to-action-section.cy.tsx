import CallToActionSection from '@/components/mooney/CallToActionSection'

describe('<CallToActionSection />', () => {
  it('renders with default props', () => {
    cy.mount(<CallToActionSection />)

    cy.contains('Ready to Join the Mission?').should('exist')
    cy.contains('Get MOONEY').should('exist')
  })

  it('displays custom title and description', () => {
    cy.mount(
      <CallToActionSection
        title="Custom Title"
        description="Custom description"
      />
    )

    cy.contains('Custom Title').should('exist')
    cy.contains('Custom description').should('exist')
  })

  it('renders custom buttons', () => {
    const customButtons = [
      {
        label: 'Custom Button',
        href: '/custom',
        gradientFrom: 'from-blue-500',
        gradientTo: 'to-purple-600',
      },
    ]

    cy.mount(<CallToActionSection buttons={customButtons} />)

    cy.contains('Custom Button').should('exist')
  })

  it('handles external links', () => {
    const externalButtons = [
      {
        label: 'External Link',
        href: 'https://example.com',
        gradientFrom: 'from-blue-500',
        gradientTo: 'to-purple-600',
        isExternal: true,
      },
    ]

    cy.mount(<CallToActionSection buttons={externalButtons} />)

    cy.contains('External Link').should('exist')
    cy.get('a').should('have.attr', 'href', 'https://example.com')
  })
})

