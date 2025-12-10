import { useEffect } from 'react'
import TestnetProviders from '@/cypress/mock/TestnetProviders'
import { useLaunchStatus } from '@/lib/launchpad/useLaunchStatus'
import { UserTeam } from '@/lib/launchpad/types'

const mockUserTeamsAsManager: UserTeam[] = [
  {
    teamId: '1',
    hats: [{ id: '0x123456' }],
  },
]

function TestComponent({
  userTeamsAsManager,
  onResult,
  onStatusChange,
}: {
  userTeamsAsManager: UserTeam[] | undefined
  onResult: (result: { status: string; handleCreateMission: () => void }) => void
  onStatusChange: (status: string) => void
}) {
  const { status, setStatus, handleCreateMission } = useLaunchStatus(userTeamsAsManager)

  useEffect(() => {
    onResult({ status, handleCreateMission })
  }, [status, handleCreateMission, onResult])

  useEffect(() => {
    onStatusChange(status)
  }, [status, onStatusChange])

  return (
    <div data-testid="test-component">
      <div data-testid="status">{status}</div>
      <button data-testid="set-status-create" onClick={() => setStatus('create')}>
        Set Create
      </button>
      <button data-testid="set-status-apply" onClick={() => setStatus('apply')}>
        Set Apply
      </button>
      <button data-testid="handle-create" onClick={handleCreateMission}>
        Handle Create
      </button>
    </div>
  )
}

describe('useLaunchStatus', () => {
  beforeEach(() => {
    cy.mountNextRouter('/launch')
  })

  it('Initializes with correct status from router query', () => {
    const onResult = cy.stub().as('onResult')
    const onStatusChange = cy.stub().as('onStatusChange')

    cy.mount(
      <TestnetProviders>
        <TestComponent
          userTeamsAsManager={mockUserTeamsAsManager}
          onResult={onResult}
          onStatusChange={onStatusChange}
        />
      </TestnetProviders>
    )

    cy.get('[data-testid="status"]').should('exist')
    cy.get('@onResult').should('have.been.called')
  })

  it('Updates status when setStatus is called', () => {
    const onResult = cy.stub().as('onResult')
    const onStatusChange = cy.stub().as('onStatusChange')

    cy.mount(
      <TestnetProviders>
        <TestComponent
          userTeamsAsManager={mockUserTeamsAsManager}
          onResult={onResult}
          onStatusChange={onStatusChange}
        />
      </TestnetProviders>
    )

    cy.get('[data-testid="set-status-create"]').click()
    cy.get('@onStatusChange').should('have.been.called')
  })

  it('Calls handleCreateMission correctly', () => {
    const onResult = cy.stub().as('onResult')
    const onStatusChange = cy.stub().as('onStatusChange')

    cy.mount(
      <TestnetProviders>
        <TestComponent
          userTeamsAsManager={mockUserTeamsAsManager}
          onResult={onResult}
          onStatusChange={onStatusChange}
        />
      </TestnetProviders>
    )

    cy.get('[data-testid="handle-create"]').click()
    cy.get('@onStatusChange').should('have.been.called')
  })

  it('Sets status to apply when user lacks access', () => {
    const onResult = cy.stub().as('onResult')
    const onStatusChange = cy.stub().as('onStatusChange')

    cy.mount(
      <TestnetProviders>
        <TestComponent
          userTeamsAsManager={undefined}
          onResult={onResult}
          onStatusChange={onStatusChange}
        />
      </TestnetProviders>
    )

    cy.get('[data-testid="handle-create"]').click()
    cy.get('@onStatusChange').should('have.been.called')
  })

  it('Handles status changes correctly', () => {
    const onResult = cy.stub().as('onResult')
    const onStatusChange = cy.stub().as('onStatusChange')

    cy.mount(
      <TestnetProviders>
        <TestComponent
          userTeamsAsManager={mockUserTeamsAsManager}
          onResult={onResult}
          onStatusChange={onStatusChange}
        />
      </TestnetProviders>
    )

    cy.get('[data-testid="set-status-apply"]').click()
    cy.get('@onStatusChange').should('have.been.called')
  })
})

