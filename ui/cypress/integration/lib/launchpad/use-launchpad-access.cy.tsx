import { useEffect } from 'react'
import TestnetProviders from '@/cypress/mock/TestnetProviders'
import { useLaunchpadAccess } from '@/lib/launchpad/useLaunchpadAccess'
import { UserTeam } from '@/lib/launchpad/types'

const mockUserTeamsAsManager: UserTeam[] = [
  {
    teamId: '1',
    hats: [{ id: '0x123456' }],
  },
]

function TestComponent({
  userTeamsAsManager,
  userTeamsAsManagerLoading,
  onResult,
}: {
  userTeamsAsManager: UserTeam[] | undefined
  userTeamsAsManagerLoading: boolean
  onResult: (result: { hasAccess: boolean; isLoading: boolean; requiresLogin: boolean }) => void
}) {
  const result = useLaunchpadAccess(userTeamsAsManager, userTeamsAsManagerLoading)

  useEffect(() => {
    onResult(result)
  }, [result, onResult])

  return <div data-testid="test-component">Test</div>
}

describe('useLaunchpadAccess', () => {
  it('Returns correct access based on userTeamsAsManager', () => {
    const onResult = cy.stub().as('onResult')

    cy.mount(
      <TestnetProviders citizen={{ id: 1 }}>
        <TestComponent
          userTeamsAsManager={mockUserTeamsAsManager}
          userTeamsAsManagerLoading={false}
          onResult={onResult}
        />
      </TestnetProviders>
    )

    cy.get('@onResult').should('have.been.called')
    cy.get('@onResult').then((stub: any) => {
      const lastCall = stub.getCall(stub.callCount - 1)
      const result = lastCall.args[0]
      expect(result.hasAccess).to.be.true
    })
  })

  it('Returns correct access when no userTeamsAsManager', () => {
    const onResult = cy.stub().as('onResult')

    cy.mount(
      <TestnetProviders citizen={{ id: 1 }}>
        <TestComponent
          userTeamsAsManager={undefined}
          userTeamsAsManagerLoading={false}
          onResult={onResult}
        />
      </TestnetProviders>
    )

    cy.get('@onResult').should('have.been.called')
  })

  it('Returns correct access based on citizen whitelist (testnet)', () => {
    const onResult = cy.stub().as('onResult')
    const originalEnv = process.env.NEXT_PUBLIC_CHAIN
    process.env.NEXT_PUBLIC_CHAIN = 'testnet'

    cy.mount(
      <TestnetProviders citizen={{ id: 999 }}>
        <TestComponent
          userTeamsAsManager={undefined}
          userTeamsAsManagerLoading={false}
          onResult={onResult}
        />
      </TestnetProviders>
    )

    cy.get('@onResult').should('have.been.called')
    cy.get('@onResult').then((stub: any) => {
      const lastCall = stub.getCall(stub.callCount - 1)
      const result = lastCall.args[0]
      expect(result.hasAccess).to.be.true
    })

    if (originalEnv) {
      process.env.NEXT_PUBLIC_CHAIN = originalEnv
    }
  })

  it('Sets requiresLogin correctly', () => {
    const onResult = cy.stub().as('onResult')

    cy.mount(
      <TestnetProviders citizen={false}>
        <TestComponent
          userTeamsAsManager={undefined}
          userTeamsAsManagerLoading={false}
          onResult={onResult}
        />
      </TestnetProviders>
    )

    cy.get('@onResult').should('have.been.called')
  })

  it('Handles loading states', () => {
    const onResult = cy.stub().as('onResult')

    cy.mount(
      <TestnetProviders citizen={{ id: 1 }}>
        <TestComponent
          userTeamsAsManager={undefined}
          userTeamsAsManagerLoading={true}
          onResult={onResult}
        />
      </TestnetProviders>
    )

    cy.get('@onResult').should('have.been.called')
    cy.get('@onResult').then((stub: any) => {
      const lastCall = stub.getCall(stub.callCount - 1)
      const result = lastCall.args[0]
      expect(result.isLoading).to.be.true
    })
  })
})

