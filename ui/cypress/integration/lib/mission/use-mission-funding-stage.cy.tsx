import TestnetProviders from '@/cypress/mock/TestnetProviders'
import useMissionFundingStage from '@/lib/mission/useMissionFundingStage'
import * as useReadModule from '@/lib/thirdweb/hooks/useRead'

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

    // Stub useRead (not thirdweb.readContract) so webpack/ESM binding of the
    // hook module cannot bypass the mock and hit /api/rpc in CT.
    cy.stub(useReadModule, 'default').callsFake(
      ({ method, params }: { method: string; params: any[] }) => {
        const paramsReady =
          Array.isArray(params) &&
          params.every((p) => p !== undefined && p !== null)

        if (!paramsReady) {
          return { data: undefined, isLoading: false }
        }

        if (method === 'stage') {
          return { data: BigInt(1), isLoading: false }
        }
        if (method === 'missionIdToPayHook') {
          return {
            data: '0x0000000000000000000000000000000000000000',
            isLoading: false,
          }
        }
        return { data: undefined, isLoading: false }
      }
    )
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
})
