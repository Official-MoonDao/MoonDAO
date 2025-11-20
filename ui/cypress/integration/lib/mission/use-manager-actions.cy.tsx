import TestnetProviders from '@/cypress/mock/TestnetProviders'
import { CYPRESS_CHAIN_V5 } from '@/cypress/mock/config'
import { useState } from 'react'
import { useManagerActions } from '@/lib/mission/useManagerActions'

const ManagerActionsWrapper = ({
  mission,
  poolDeployerAddress,
}: {
  mission: any
  poolDeployerAddress?: string
}) => {
  const {
    availableTokens,
    availablePayouts,
    sendReservedTokens,
    sendPayouts,
    deployLiquidityPool,
  } = useManagerActions(mission, CYPRESS_CHAIN_V5, poolDeployerAddress)

  return (
    <div>
      <div data-testid="available-tokens">{availableTokens}</div>
      <div data-testid="available-payouts">{availablePayouts}</div>
      <button data-testid="send-tokens-btn" onClick={() => sendReservedTokens()}>
        Send Tokens
      </button>
      <button data-testid="send-payouts-btn" onClick={() => sendPayouts()}>
        Send Payouts
      </button>
      <button data-testid="deploy-pool-btn" onClick={() => deployLiquidityPool()}>
        Deploy Pool
      </button>
    </div>
  )
}

describe('useManagerActions', () => {
  const mockMission = {
    projectId: 1,
  }

  beforeEach(() => {
    cy.mountNextRouter('/')
    cy.intercept('POST', '**', (req) => {
      if (req.body && req.body.method === 'STORE') {
        req.reply({ result: '0x1234567890123456789012345678901234567890' })
      } else if (req.body && req.body.method === 'balanceOf') {
        req.reply({ result: '0x0' })
      } else if (req.body && req.body.method === 'pendingReservedTokenBalanceOf') {
        req.reply({ result: '0x0' })
      }
    }).as('contractCalls')
  })

  it('provides availableTokens and availablePayouts', () => {
    cy.mount(
      <TestnetProviders>
        <ManagerActionsWrapper mission={mockMission} />
      </TestnetProviders>
    )

    cy.get('[data-testid="available-tokens"]').should('exist')
    cy.get('[data-testid="available-payouts"]').should('exist')
  })

  it('provides sendReservedTokens function', () => {
    cy.mount(
      <TestnetProviders>
        <ManagerActionsWrapper mission={mockMission} />
      </TestnetProviders>
    )

    cy.get('[data-testid="send-tokens-btn"]').should('exist').click()
  })

  it('provides sendPayouts function', () => {
    cy.mount(
      <TestnetProviders>
        <ManagerActionsWrapper mission={mockMission} />
      </TestnetProviders>
    )

    cy.get('[data-testid="send-payouts-btn"]').should('exist').click()
  })

  it('provides deployLiquidityPool function when poolDeployerAddress is provided', () => {
    cy.mount(
      <TestnetProviders>
        <ManagerActionsWrapper
          mission={mockMission}
          poolDeployerAddress="0x1234567890123456789012345678901234567890"
        />
      </TestnetProviders>
    )

    cy.get('[data-testid="deploy-pool-btn"]').should('exist').click()
  })
})
