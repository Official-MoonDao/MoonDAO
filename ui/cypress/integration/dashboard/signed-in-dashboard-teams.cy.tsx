import TestnetProviders from '@/cypress/mock/TestnetProviders'
import * as useTeamWearerModule from '@/lib/hats/useTeamWearer'
import { shouldShowTeamsSection } from '@/lib/dashboard/shouldShowTeamsSection'
import SignedInDashboard from '@/components/home/SignedInDashboard'

const minimalDashboardProps = {
  newestCitizens: [],
  newestListings: [],
  newestJobs: [],
  citizenSubgraphData: { transfers: [], createdAt: Date.now() },
  aumData: null,
  filteredTeams: [],
  projects: [],
  missions: [],
  featuredMissionData: null,
  citizensLocationData: [],
}

describe('shouldShowTeamsSection', () => {
  it('returns false when user has no teams', () => {
    expect(shouldShowTeamsSection([], false)).to.be.false
  })

  it('returns false when userTeams is undefined and not loading', () => {
    expect(shouldShowTeamsSection(undefined, false)).to.be.false
  })

  it('returns true when user has at least one team', () => {
    expect(
      shouldShowTeamsSection([{ teamId: '1', hats: [] }], false)
    ).to.be.true
  })

  it('returns true while teams are loading', () => {
    expect(shouldShowTeamsSection(undefined, true)).to.be.true
  })
})

describe('SignedInDashboard - Your Teams section visibility', () => {
  let useTeamWearerReturn: { userTeams: any; isLoading: boolean } = {
    userTeams: [],
    isLoading: false,
  }

  before(() => {
    cy.stub(useTeamWearerModule, 'useTeamWearer').callsFake(() => useTeamWearerReturn)
  })

  beforeEach(() => {
    cy.mountNextRouter('/dashboard')
  })

  it('hides the Your Teams section when user has no teams', () => {
    useTeamWearerReturn = { userTeams: [], isLoading: false }

    cy.mount(
      <TestnetProviders citizen>
        <SignedInDashboard {...minimalDashboardProps} />
      </TestnetProviders>
    )

    cy.get('[data-testid="dashboard-your-teams-section"]').should('not.exist')
    cy.contains('Your Teams').should('not.exist')
  })

  it('hides the Your Teams section when userTeams is undefined and not loading', () => {
    useTeamWearerReturn = { userTeams: undefined, isLoading: false }

    cy.mount(
      <TestnetProviders citizen>
        <SignedInDashboard {...minimalDashboardProps} />
      </TestnetProviders>
    )

    cy.get('[data-testid="dashboard-your-teams-section"]').should('not.exist')
    cy.contains('Your Teams').should('not.exist')
  })
})
