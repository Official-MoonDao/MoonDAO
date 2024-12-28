import ConditionCheckbox from '@/components/layout/ConditionCheckbox'

describe('<ConditionCheckbox />', () => {
  let props: any

  beforeEach(() => {
    props = {
      label: 'Test Condition',
      agreedToCondition: false,
      setAgreedToCondition: cy.spy().as('setAgreedToCondition'),
    }

    cy.mount(<ConditionCheckbox {...props} />)
  })

  it('Renders with label and responds to clicks', () => {
    cy.contains('Test Condition').should('be.visible')
    cy.get('input[type="checkbox"]').should('not.be.checked')
    cy.get('input[type="checkbox"]').click()
    cy.get('@setAgreedToCondition').should('have.been.calledWith', true)
  })

  it('Renders correctly when initially checked', () => {
    cy.mount(<ConditionCheckbox {...props} agreedToCondition={true} />)
    cy.get('input[type="checkbox"]').should('be.checked')
  })
})
