import Action from '@/components/subscription/Action'

describe('<Action />', () => {
  let props: any

  beforeEach(() => {
    props = {
      title: 'Test Title',
      description: 'Test Description',
      icon: <span>Icon</span>,
      onClick: cy.stub(),
    }

    cy.mount(<Action {...props} />)
  })

  it('Renders with title, description, and icon', () => {
    cy.get('h3.font-semibold').should('contain', props.title)
    cy.get('p.text-xs').should('contain', props.description)
    cy.get('span').should('contain', 'Icon')
  })

  it('Calls onClick when clicked', () => {
    cy.get('[data-testid="action-container"]').click()
    cy.wrap(props.onClick).should('have.been.calledOnce')
  })

  it('Renders as disabled when disabled prop is true', () => {
    const disabledProps = { ...props, disabled: true }
    cy.mount(<Action {...disabledProps} />)

    cy.get('[data-testid="action-container"]')
      .should('have.class', 'opacity-50')
      .and('have.class', 'cursor-not-allowed')
  })

  it('Does not call onClick when disabled', () => {
    const disabledProps = { ...props, disabled: true }
    cy.mount(<Action {...disabledProps} />)

    cy.get('[data-testid="action-container"]').click()
    cy.wrap(props.onClick).should('not.have.been.called')
  })

  it('Has hover effects when not disabled', () => {
    cy.get('[data-testid="action-container"]')
      .should('have.class', 'hover:bg-slate-600/30')
      .and('have.class', 'cursor-pointer')
  })
})
