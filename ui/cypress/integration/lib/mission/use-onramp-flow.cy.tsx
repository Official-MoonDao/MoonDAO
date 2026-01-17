import TestnetProviders from '@/cypress/mock/TestnetProviders'
import type { NextRouter } from 'next/router'
import { useOnrampFlow } from '@/lib/mission/useOnrampFlow'

const OnrampFlowWrapper = ({
  mission,
  router,
  chainSlugs,
}: {
  mission: any
  router: NextRouter
  chainSlugs: string[]
}) => {
  const {
    usdInput,
    setUsdInput,
    contributeModalEnabled,
    setContributeModalEnabled,
  } = useOnrampFlow(mission, router, chainSlugs)

  return (
    <div>
      <div data-testid="usd-input">{usdInput}</div>
      <div data-testid="modal-enabled">{contributeModalEnabled ? 'true' : 'false'}</div>
      <input
        data-testid="usd-input-field"
        value={usdInput}
        onChange={(e) => setUsdInput(e.target.value)}
      />
      <button
        data-testid="toggle-modal-btn"
        onClick={() => setContributeModalEnabled(!contributeModalEnabled)}
      >
        Toggle Modal
      </button>
    </div>
  )
}

describe('useOnrampFlow', () => {
  const mockMission = {
    id: 1,
  }

  let mockRouter: any

  beforeEach(() => {
    cy.mountNextRouter('/')
    mockRouter = {
      isReady: true,
      query: {},
      pathname: '/mission/1',
      replace: cy.stub(),
    }
  })

  it('initializes with empty usdInput', () => {
    cy.mount(
      <TestnetProviders>
        <OnrampFlowWrapper
          mission={mockMission}
          router={mockRouter}
          chainSlugs={['arbitrum', 'base']}
        />
      </TestnetProviders>
    )

    cy.get('[data-testid="usd-input"]').should('be.empty')
  })

  it('updates usdInput when setUsdInput is called', () => {
    cy.mount(
      <TestnetProviders>
        <OnrampFlowWrapper
          mission={mockMission}
          router={mockRouter}
          chainSlugs={['arbitrum', 'base']}
        />
      </TestnetProviders>
    )

    cy.get('[data-testid="usd-input-field"]').type('100')
    cy.get('[data-testid="usd-input"]').should('contain', '100')
  })

  it('toggles contributeModalEnabled state', () => {
    cy.mount(
      <TestnetProviders>
        <OnrampFlowWrapper
          mission={mockMission}
          router={mockRouter}
          chainSlugs={['arbitrum', 'base']}
        />
      </TestnetProviders>
    )

    cy.get('[data-testid="modal-enabled"]').should('contain', 'false')
    cy.get('[data-testid="toggle-modal-btn"]').click()
    cy.get('[data-testid="modal-enabled"]').should('contain', 'true')
  })
})
