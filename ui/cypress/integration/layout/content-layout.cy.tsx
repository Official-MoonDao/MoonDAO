import ContentLayout from '@/components/layout/ContentLayout'

describe('ContentLayout', () => {
  it('Renders basic structure correctly', () => {
    cy.mount(
      <ContentLayout header="Test Header">
        <div data-testid="child">Test Content</div>
      </ContentLayout>
    )

    cy.get('#title-section').should('exist')
    cy.get('#main-section-container').should('exist')
    cy.get('[data-testid="child"]').should('contain', 'Test Content')
  })

  it('Renders header correctly', () => {
    cy.mount(<ContentLayout header="Test Header" />)

    cy.get('#header-element').should('contain', 'Test Header')
  })

  it('Renders subHeader when provided', () => {
    cy.mount(<ContentLayout header="Test Header" subHeader="Test SubHeader" />)

    cy.get('#sub-header').should('contain', 'Test SubHeader')
  })

  it('Renders description when provided', () => {
    cy.mount(<ContentLayout header="Test Header" description="Test Description" />)

    cy.contains('Test Description').should('be.visible')
  })

  it('Renders preFooter when provided', () => {
    cy.mount(
      <ContentLayout header="Test Header" preFooter={<div data-testid="prefooter">PreFooter</div>}>
        <div>Content</div>
      </ContentLayout>
    )

    cy.get('[data-testid="prefooter"]').should('contain', 'PreFooter')
  })

  it('Applies correct classes for popOverEffect', () => {
    cy.mount(<ContentLayout header="Test Header" popOverEffect={true} />)

    cy.get('#popout-bg-element').should('not.exist')
  })

  it('Does not force a 350px min-width spacer in compact unbranded mode', () => {
    cy.viewport('iphone-x')
    cy.mount(
      <ContentLayout
        header="Compact Profile"
        mode="compact"
        branded={false}
        isProfile
        description="Profile description"
      >
        <div data-testid="child">Body</div>
      </ContentLayout>
    )

    cy.get('#image').should('not.have.class', 'min-w-[350px]')
    cy.get('#title-wrapper').should('have.class', 'min-w-0')
    cy.get('#content-container').should('have.class', 'min-w-0')
  })
})
