import TestnetProviders from '@/cypress/mock/TestnetProviders'
import { interceptRpc } from '@/cypress/mock/rpc'
import useMissionFundingStage from '@/lib/mission/useMissionFundingStage'

const MissionFundingStageWrapper = ({
  missionId,
}: {
  missionId: number | undefined
}) => {
  const currentStage = useMissionFundingStage(missionId)

  return (
    <div>
      <div data-testid="stage">
        {currentStage !== undefined ? currentStage.toString() : 'undefined'}
      </div>
    </div>
  )
}

describe('useMissionFundingStage', () => {
  beforeEach(() => {
    cy.mountNextRouter('/')

    // Answer /api/rpc at the network layer (module stubs don't intercept the
    // hook's webpack ESM binding of readContract). The default eth_call
    // result decodes as uint 1, so MissionCreator.stage() reads back stage 1
    // and missionIdToPayHook returns a non-zero (but inactive) address,
    // keeping the hook on its fallback stage path.
    interceptRpc()
  })

  it('returns undefined when missionId is undefined', () => {
    cy.mount(
      <TestnetProviders>
        <MissionFundingStageWrapper missionId={undefined} />
      </TestnetProviders>
    )

    cy.get('[data-testid="stage"]').should('contain', 'undefined')
  })

  it('returns stage from contract when missionId is provided', () => {
    cy.mount(
      <TestnetProviders>
        <MissionFundingStageWrapper missionId={1} />
      </TestnetProviders>
    )

    cy.get('[data-testid="stage"]', { timeout: 10000 }).should(
      'not.contain',
      'undefined'
    )
    cy.get('[data-testid="stage"]').should('contain', '1')
  })

  it('returns undefined for the non-numeric dummy mission id', () => {
    cy.mount(
      <TestnetProviders>
        <MissionFundingStageWrapper missionId={'dummy' as any} />
      </TestnetProviders>
    )

    cy.get('[data-testid="stage"]').should('contain', 'undefined')
  })
})
