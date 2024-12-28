import { ArrowUpRightIcon } from '@heroicons/react/24/outline'
import WalletAction from '@/components/privy/WalletAction'

// Example icon

describe('WalletAction Component', () => {
  let props: any

  beforeEach(() => {
    props = {
      id: 'test-wallet-action',
      label: 'Test Wallet Action',
      icon: <ArrowUpRightIcon />,
      onClick: cy.spy().as('clickHandler'),
    }

    cy.mount(<WalletAction {...props} />)
  })

  it('Renders component', () => {
    // Check if component renders with correct structure
    cy.get('#test-wallet-action').should('exist')
    cy.get('button').should('exist')
    cy.get('p').should('have.text', 'Test Wallet Action')

    // Test click functionality
    cy.get('button').click()
    cy.get('@clickHandler').should('have.been.called')
  })
})
