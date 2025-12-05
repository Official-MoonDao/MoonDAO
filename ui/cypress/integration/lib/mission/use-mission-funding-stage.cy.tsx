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
        if (options.params && options.params.length > 0 && options.params[0] === 1) {
          return BigInt(1)
        }
      }

      return BigInt(0)
    })

    cy.mount(
      <TestnetProviders>
        <MissionFundingStageWrapper missionId={1} />
      </TestnetProviders>
    )

    // eslint-disable-next-line cypress/no-unnecessary-waiting
    cy.wait(500)
    cy.get('[data-testid="stage"]', { timeout: 15000 }).should('not.contain', 'undefined')
    cy.get('[data-testid="stage"]', { timeout: 15000 }).should('contain', '1')
  })
})
