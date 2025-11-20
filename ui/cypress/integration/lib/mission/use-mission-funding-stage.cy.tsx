import TestnetProviders from '@/cypress/mock/TestnetProviders'
import * as thirdweb from 'thirdweb'
import useMissionFundingStage from '@/lib/mission/useMissionFundingStage'

const MissionFundingStageWrapper = ({ missionId }: { missionId: number | undefined }) => {
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
    cy.stub(thirdweb, 'readContract').callsFake(async (options: any) => {
      if (options.method === 'stage') {
        return BigInt(1) // Stage 1
      }
      return null
    })

    cy.mount(
      <TestnetProviders>
        <MissionFundingStageWrapper missionId={1} />
      </TestnetProviders>
    )

    cy.get('[data-testid="stage"]', { timeout: 10000 }).should('not.contain', 'undefined')
    cy.get('[data-testid="stage"]').should('contain', '1')
  })
})
