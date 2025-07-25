import LaunchpadBenefit from '@/components/launchpad/LaunchpadBenefit'

describe('<LaunchpadBenefit />', () => {
  const defaultProps = {
    title: 'Test Benefit',
    description: 'Test Description',
    icon: '/test-icon.svg',
    align: 'left' as const,
  }

  it('Should render with left alignment and string icon', () => {
    cy.mount(<LaunchpadBenefit {...defaultProps} />)

    cy.get('#benefit-title').should('contain', 'Test Benefit')
    cy.get('#benefit-description').should('contain', 'Test Description')
    cy.get('#benefit-icon-image')
      .should('have.attr', 'src')
      .and('include', 'test-icon.svg')
  })

  it('Should render with right alignment', () => {
    cy.mount(<LaunchpadBenefit {...defaultProps} align="right" />)

    cy.get('#benefit-container').within(() => {
      cy.get('#benefit-content').should('exist')
      cy.get('#benefit-icon-container').should('exist')
      cy.get('#benefit-text').should('exist')
    })
  })

  it('Should render with React node icon', () => {
    const customIcon = <div id="custom-test-icon">Custom Icon</div>
    cy.mount(<LaunchpadBenefit {...defaultProps} icon={customIcon} />)

    cy.get('#benefit-icon-image').should('not.exist')
    cy.get('#benefit-icon-custom').should('exist')
    cy.get('#custom-test-icon').should('contain', 'Custom Icon')
  })

  it('Should handle long content', () => {
    const longProps = {
      ...defaultProps,
      title: 'This is a very long title that might wrap to multiple lines',
      description:
        'This is a very long description that should test how the component handles lengthy content and whether it maintains its layout and styling properly while ensuring the text remains readable and well-formatted.',
    }

    cy.mount(<LaunchpadBenefit {...longProps} />)

    cy.get('#benefit-title').should('contain', longProps.title)
    cy.get('#benefit-description').should('contain', longProps.description)
  })
})
