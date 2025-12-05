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
    cy.intercept('POST', '**/rpc/**', (req) => {
      if (req.body && req.body.method === 'eth_call') {
        // Return stage 1 as a bigint-encoded hex value
        // Stage 1 = 0x1, padded to 32 bytes (64 hex chars)
        req.reply({ result: '0x' + '1'.padStart(64, '0') })
      } else if (req.body && req.body.method === 'eth_getBalance') {
        req.reply({ result: '0x0' })
      }
    }).as('rpcCalls')

    cy.intercept('POST', '**/thirdweb.com/**', (req) => {
      if (req.body && req.body.method === 'eth_call') {
        // Return stage 1
        req.reply({ result: '0x' + '1'.padStart(64, '0') })
      } else if (req.body && req.body.method === 'eth_getBalance') {
        req.reply({ result: '0x0' })
      }
    }).as('thirdwebRpc')

    cy.mount(
      <TestnetProviders>
        <MissionFundingStageWrapper missionId={1} />
      </TestnetProviders>
    )

    cy.get('[data-testid="stage"]', { timeout: 10000 }).should('not.contain', 'undefined')
    cy.get('[data-testid="stage"]').should('contain', '1')
  })
})
