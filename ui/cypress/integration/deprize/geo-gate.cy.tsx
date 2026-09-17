import DePrizeTeamCard from '@/components/deprize/DePrizeTeamCard'
import {
  DePrizeRestrictedProvider,
  useDePrizeRestricted,
} from '@/lib/deprize/deprizeRestrictedContext'

function Probe() {
  const restricted = useDePrizeRestricted()
  return <span data-testid="deprize-restricted">{String(restricted)}</span>
}

const outcome = {
  index: 0,
  probability: 0.5,
  price: 0.5,
  balance: 0,
  balanceWei: 0n,
  positionId: 0n,
}

describe('PR-0 DePrize geo gate (component)', () => {
  it('carries the SSR value and never fetches /api/geo/country', () => {
    cy.intercept('GET', '/api/geo/country', { body: { country: 'US', restricted: false } }).as(
      'geoCountry'
    )
    cy.mount(
      <DePrizeRestrictedProvider restricted={true}>
        <Probe />
      </DePrizeRestrictedProvider>
    )
    cy.get('[data-testid="deprize-restricted"]').should('have.text', 'true')
    cy.get('@geoCountry.all').should('have.length', 0)
  })

  it('throws outside a provider', () => {
    cy.on('uncaught:exception', (err) => {
      if (err.message.includes('useDePrizeRestricted must be used inside DePrizeRestrictedProvider')) {
        return false
      }
    })
    cy.mount(<Probe />)
    cy.contains('useDePrizeRestricted must be used inside DePrizeRestrictedProvider')
  })

  it('hides Back this team when bettingOpen is false and shows it when true', () => {
    cy.mount(
      <DePrizeTeamCard
        outcome={outcome as any}
        teamId={1n}
        teamContract={undefined}
        color="#fff"
        loading={false}
        resolved={false}
        isRefundVector={false}
        isWinningSlot={false}
        bettingOpen={false}
        tradingHalted={false}
        busy={false}
        userConnected
        onBet={() => undefined}
        isField={false}
      />
    )
    cy.contains(/Back (this team|the field)/).should('not.exist')

    cy.mount(
      <DePrizeTeamCard
        outcome={outcome as any}
        teamId={1n}
        teamContract={undefined}
        color="#fff"
        loading={false}
        resolved={false}
        isRefundVector={false}
        isWinningSlot={false}
        bettingOpen={true}
        tradingHalted={false}
        busy={false}
        userConnected
        onBet={() => undefined}
        isField={false}
      />
    )
    cy.contains('Back this team').should('exist')
  })
})
