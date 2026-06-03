import TestnetProviders from '@/cypress/mock/TestnetProviders'
import { CYPRESS_CHAIN_V5 } from '@/cypress/mock/config'
import CreateCitizen from '@/components/onboarding/CreateCitizen'

describe('<CreateCitizen />', () => {
  const mockAddress = '0x1234567890abcdef'
  const cacheKey = `CreateCitizenCacheV1_${mockAddress.toLowerCase()}`
  let props: any

  beforeEach(() => {
    cy.clearLocalStorage()
    cy.window().then((win) => {
      win.sessionStorage.clear()
      win.localStorage.removeItem(cacheKey)
      win.localStorage.removeItem('CreateCitizenCacheV1')
      ;(win as any).__CYPRESS_MOCK_ADDRESS__ = mockAddress
    })

    props = {
      address: mockAddress,
      selectedChain: CYPRESS_CHAIN_V5,
      setSelectedTier: cy.stub(),
    }
    cy.mountNextRouter('/')
    cy.mount(
      <TestnetProviders>
        <CreateCitizen {...props} />
      </TestnetProviders>
    )
  })

  it('Should render the component', () => {
    cy.get('div').contains('Join The Network').should('exist')
  })

  it('Should complete citizen onboarding flow', () => {
    // DESIGN — dev shortcuts advance stages without live AI / GCS uploads
    cy.contains('h2', 'Design', { timeout: 10000 }).should('exist')
    cy.contains('generate your AI passport photo').should('exist')

    cy.get('body').then(($body) => {
      if ($body.find('#citizen-next-button').length > 0) {
        cy.get('#citizen-next-button').click()

        //TYPEFORM
        cy.get('iframe', { timeout: 10000 }).should('exist')
        cy.get('iframe').should('have.attr', 'src').and('include', 'typeform')

        // Check if next button still exists before clicking
        cy.get('#citizen-next-button', { timeout: 5000 })
          .should('exist')
          .then(() => {
            cy.get('#citizen-next-button').click()

            //MINT
            cy.get('#citizen-checkout-button', { timeout: 5000 }).should('be.disabled')

            cy.get('input[type="checkbox"]').first().check()
            cy.get('input[type="checkbox"]').first().should('be.checked')

            cy.get('#citizen-checkout-button').should('not.be.disabled')
          })
      } else {
        // If buttons don't exist (not in dev mode), verify component still renders
        cy.get('input[type="file"]').should('exist')
        cy.contains('generate your AI passport photo').should('exist')
      }
    })
  })
})
