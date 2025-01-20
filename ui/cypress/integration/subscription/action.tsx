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
    cy.get('p.font-bold').should('contain', props.title)
    cy.get('p.pb-5').should('contain', props.description)
    cy.get('span').should('contain', 'Icon')
  })

  it('Calls onClick when button is clicked', () => {
    cy.get('button').click()
    cy.wrap(props.onClick).should('have.been.calledOnce')
  })
})
