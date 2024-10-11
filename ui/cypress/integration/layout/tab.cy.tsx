import Tab from '@/components/layout/Tab'

describe('<Tab />', () => {
  let props: any

  beforeEach(() => {
    props = {
      tab: 'test',
      currentTab: 'test',
      setTab: cy.stub(),
      children: 'Test',
      icon: '/Original.png',
    }
    cy.mount(<Tab {...props} />)
  })

  it('Renders correctly with icon', () => {
    cy.get('button').should('exist')
    cy.get('#icon-container').should('exist')
    cy.get('#text-container').contains('Test')
  })

  it('Calls setTab on click', () => {
    cy.get('button').click()
    cy.wrap(props.setTab).should('have.been.calledWith', 'test')
  })
})
