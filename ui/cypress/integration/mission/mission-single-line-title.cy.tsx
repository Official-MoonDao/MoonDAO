import MissionSingleLineTitle from '@/components/mission/MissionSingleLineTitle'
import TestnetProviders from '../../mock/TestnetProviders'

const FRANK_TITLE = 'Go to Space with Frank White'

describe('<MissionSingleLineTitle />', () => {
  it('Mission 4 title does not overflow horizontally at featured-scale width (wraps if narrow)', () => {
    cy.mount(
      <div className="w-[480px] border border-white/20 p-4">
        <TestnetProviders>
          <MissionSingleLineTitle
            text={FRANK_TITLE}
            minPx={24}
            maxPx={60}
            data-testid="fit-title"
          />
        </TestnetProviders>
      </div>
    )

    cy.get('[data-testid="fit-title"]').should(($h) => {
      const el = $h[0] as HTMLElement
      expect(el.scrollWidth, 'no horizontal overflow').to.be.at.most(el.clientWidth + 2)
    })
  })

  it('Mission 4 title does not overflow horizontally at profile column width (wraps if narrow)', () => {
    cy.mount(
      <div className="w-[380px] border border-white/20 p-4">
        <TestnetProviders>
          <MissionSingleLineTitle
            text={FRANK_TITLE}
            minPx={22}
            maxPx={42}
            data-testid="fit-title-profile"
          />
        </TestnetProviders>
      </div>
    )

    cy.get('[data-testid="fit-title-profile"]').should(($h) => {
      const el = $h[0] as HTMLElement
      expect(el.scrollWidth, 'no horizontal overflow').to.be.at.most(el.clientWidth + 2)
    })
  })
})
