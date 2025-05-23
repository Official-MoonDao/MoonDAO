import FeatureIcon from '@/components/launchpad/FeatureIcon'

describe('<FeatureIcon />', () => {
  it('Should render with string icon', () => {
    cy.mount(
      <FeatureIcon
        title="Test Feature"
        description="Test Description"
        icon="/assets/test-icon.svg"
      />
    )

    cy.get('#feature-icon-title').should('contain', 'Test Feature')
    cy.get('#feature-icon-description').should('contain', 'Test Description')
    cy.get('#feature-icon-image')
      .should('have.attr', 'src')
      .and('include', 'test-icon.svg')
    cy.get('#feature-icon-image').should('have.attr', 'alt', 'Test Feature')
  })

  it('Should render with React node icon', () => {
    cy.mount(
      <FeatureIcon
        title="Test Feature"
        description="Test Description"
        icon={<div id="feature-icon-custom">Custom Icon</div>}
      />
    )

    cy.get('#feature-icon-custom').should('exist')
    cy.get('#feature-icon-custom').should('contain', 'Custom Icon')
    cy.get('#feature-icon-image').should('not.exist')
  })

  it('Should handle long text content', () => {
    const longTitle = 'This is a very long title that might wrap'
    const longDescription =
      'This is a very long description that should test how the component handles lengthy content and whether it maintains its layout and styling properly.'

    cy.mount(
      <FeatureIcon
        title={longTitle}
        description={longDescription}
        icon="/assets/test-icon.svg"
      />
    )

    cy.get('#feature-icon-title').should('contain', longTitle)
    cy.get('#feature-icon-description').should('contain', longDescription)
  })
})
