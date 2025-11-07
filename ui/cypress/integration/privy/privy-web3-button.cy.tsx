import { PrivyProvider } from '@privy-io/react-auth'
import React from 'react'
import { PrivyWeb3Button } from '../../../components/privy/PrivyWeb3Button'

describe('<PrivyWeb3Button />', () => {
  beforeEach(() => {
    cy.mountNextRouter('/')
  })
  it('Renders Privy Web3 Button', () => {
    cy.mount(
      <PrivyProvider appId={process.env.NEXT_PUBLIC_PRIVY_APP_ID as string}>
        <PrivyWeb3Button label="test" action={() => console.log('test')} />
      </PrivyProvider>
    )

    cy.get('button').should('exist')
  })
})
