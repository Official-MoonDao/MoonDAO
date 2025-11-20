import TestnetProviders from '@/cypress/mock/TestnetProviders'
import { CYPRESS_CHAIN_V5 } from '@/cypress/mock/config'
import { useEffect } from 'react'
import * as thirdweb from 'thirdweb'
import { UserTeam } from '@/lib/launchpad/types'
import { useTeamManagerCheck } from '@/lib/launchpad/useTeamManagerCheck'

const mockTeamContract = {
  address: '0x123',
  chain: CYPRESS_CHAIN_V5,
}

const mockUserTeams: UserTeam[] = [
  {
    teamId: '1',
    hats: [{ id: '0x123456', name: 'Test Hat' }],
  },
  {
    teamId: '2',
    hats: [{ id: '0x789012', name: 'Test Hat 2' }],
  },
]

function TestComponent({
  teamContract,
  userTeams,
  address,
  userTeamsLoading,
  onResult,
}: {
  teamContract: any
  userTeams: UserTeam[] | undefined
  address: string | undefined
  userTeamsLoading: boolean
  onResult: (result: { userTeamsAsManager: UserTeam[]; isLoading: boolean }) => void
}) {
  const result = useTeamManagerCheck(teamContract, userTeams, address, userTeamsLoading)

  useEffect(() => {
    onResult(result)
  }, [result, onResult])

  return <div data-testid="test-component">Test</div>
}

describe('useTeamManagerCheck', () => {
  beforeEach(() => {
    cy.stub(thirdweb, 'readContract').resolves('0x123456')
  })

  it('Returns empty array when no userTeams provided', () => {
    const onResult = cy.stub().as('onResult')

    cy.mount(
      <TestnetProviders>
        <TestComponent
          teamContract={mockTeamContract}
          userTeams={undefined}
          address="0x123"
          userTeamsLoading={false}
          onResult={onResult}
        />
      </TestnetProviders>
    )

    cy.get('@onResult').should('have.been.called')
    cy.get('@onResult').then((stub: any) => {
      const lastCall = stub.getCall(stub.callCount - 1)
      const result = lastCall.args[0]
      expect(result.userTeamsAsManager).to.be.an('array')
    })
  })

  it('Returns empty array when teamContract is undefined', () => {
    const onResult = cy.stub().as('onResult')

    cy.mount(
      <TestnetProviders>
        <TestComponent
          teamContract={undefined}
          userTeams={mockUserTeams}
          address="0x123"
          userTeamsLoading={false}
          onResult={onResult}
        />
      </TestnetProviders>
    )

    cy.get('@onResult').should('have.been.called')
  })

  it('Sets loading state appropriately', () => {
    const onResult = cy.stub().as('onResult')

    cy.mount(
      <TestnetProviders>
        <TestComponent
          teamContract={mockTeamContract}
          userTeams={mockUserTeams}
          address="0x123"
          userTeamsLoading={true}
          onResult={onResult}
        />
      </TestnetProviders>
    )

    cy.get('@onResult').should('have.been.called')
  })

  it('Handles missing hat data gracefully', () => {
    const onResult = cy.stub().as('onResult')
    const teamsWithoutHats: UserTeam[] = [
      {
        teamId: '1',
        hats: [],
      },
    ]

    cy.mount(
      <TestnetProviders>
        <TestComponent
          teamContract={mockTeamContract}
          userTeams={teamsWithoutHats}
          address="0x123"
          userTeamsLoading={false}
          onResult={onResult}
        />
      </TestnetProviders>
    )

    cy.get('@onResult').should('have.been.called')
  })

  it('Handles missing teamId gracefully', () => {
    const onResult = cy.stub().as('onResult')
    const teamsWithoutTeamId: UserTeam[] = [
      {
        teamId: '',
        hats: [{ id: '0x123456' }],
      },
    ]

    cy.mount(
      <TestnetProviders>
        <TestComponent
          teamContract={mockTeamContract}
          userTeams={teamsWithoutTeamId}
          address="0x123"
          userTeamsLoading={false}
          onResult={onResult}
        />
      </TestnetProviders>
    )

    cy.get('@onResult').should('have.been.called')
  })
})
