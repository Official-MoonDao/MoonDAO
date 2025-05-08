import MissionStat from '@/components/mission/MissionStat'

describe('<MissionStat />', () => {
  it('Should render basic stat with label and value', () => {
    cy.mount(<MissionStat label="VOLUME" value="100" />)

    cy.get('#mission-stat-label').should('contain', 'VOLUME')
    cy.get('#mission-stat-value').should('contain', '100')
  })

  it('Should render with icon when provided', () => {
    cy.mount(
      <MissionStat label="VOLUME" value="100" icon="/assets/icon-volume.svg" />
    )

    cy.get('img').should('have.attr', 'src').and('include', 'icon-volume.svg')
    cy.get('img').should('have.attr', 'alt', 'VOLUME')
  })

  it('Should show loading spinner when value is undefined', () => {
    cy.mount(<MissionStat label="VOLUME" value={undefined} />)

    cy.get('#mission-stat-label').should('contain', 'VOLUME')
    cy.get('#mission-stat-loading').should('exist')
  })

  it('Should show loading spinner when value is empty string', () => {
    cy.mount(<MissionStat label="VOLUME" value="" />)

    cy.get('#mission-stat-label').should('contain', 'VOLUME')
    cy.get('#mission-stat-loading').should('exist')
  })

  it('Should handle numeric values', () => {
    cy.mount(<MissionStat label="VOLUME" value={42} />)

    cy.get('#mission-stat-label').should('contain', 'VOLUME')
    cy.get('#mission-stat-value').should('contain', '42')
  })

  it('Should handle missing label gracefully', () => {
    cy.mount(<MissionStat label="" value="100" />)

    cy.get('#mission-stat-label').should('be.empty')
    cy.get('#mission-stat-value').should('contain', '100')
  })
})
