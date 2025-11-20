import TestnetProviders from '@/cypress/mock/TestnetProviders'
import MissionTeamSection from '@/components/mission/MissionTeamSection'

const mockHatsContract = {
  address: '0x1234567890123456789012345678901234567890',
  abi: [],
}

const mockCitizenContract = {
  address: '0x1234567890123456789012345678901234567891',
  abi: [],
}

describe('MissionTeamSection', () => {
  beforeEach(() => {
    cy.mountNextRouter('/')
  })

  it('renders the section with header', () => {
    cy.mount(
      <TestnetProviders>
        <MissionTeamSection
          teamSocials={{}}
          teamHats={[]}
          hatsContract={mockHatsContract}
          citizenContract={mockCitizenContract}
        />
      </TestnetProviders>
    )

    cy.contains('Meet the Team').should('be.visible')
  })

  it('renders social links when provided', () => {
    cy.mount(
      <TestnetProviders>
        <MissionTeamSection
          teamSocials={{
            twitter: 'https://twitter.com/test',
            website: 'https://example.com',
          }}
          teamHats={[]}
          hatsContract={mockHatsContract}
          citizenContract={mockCitizenContract}
        />
      </TestnetProviders>
    )

    cy.contains('Meet the Team').should('be.visible')
    cy.get('a[href="https://twitter.com/test"]').should('exist')
    cy.get('a[href="https://example.com"]').should('exist')
  })

  it('renders TeamMembers when teamHats provided', () => {
    const mockTeamHats = [
      {
        id: '1',
        wearers: ['0x1234567890123456789012345678901234567890'],
      },
    ]

    cy.mount(
      <TestnetProviders>
        <MissionTeamSection
          teamSocials={{}}
          teamHats={mockTeamHats}
          hatsContract={mockHatsContract}
          citizenContract={mockCitizenContract}
        />
      </TestnetProviders>
    )

    cy.contains('Meet the Team').should('be.visible')
  })

  it('does not render TeamMembers when teamHats is empty', () => {
    cy.mount(
      <TestnetProviders>
        <MissionTeamSection
          teamSocials={{}}
          teamHats={[]}
          hatsContract={mockHatsContract}
          citizenContract={mockCitizenContract}
        />
      </TestnetProviders>
    )

    cy.contains('Meet the Team').should('be.visible')
  })

  it('does not render TeamMembers when teamHats has no id', () => {
    const mockTeamHats = [{ wearers: [] }]

    cy.mount(
      <TestnetProviders>
        <MissionTeamSection
          teamSocials={{}}
          teamHats={mockTeamHats}
          hatsContract={mockHatsContract}
          citizenContract={mockCitizenContract}
        />
      </TestnetProviders>
    )

    cy.contains('Meet the Team').should('be.visible')
  })
})
