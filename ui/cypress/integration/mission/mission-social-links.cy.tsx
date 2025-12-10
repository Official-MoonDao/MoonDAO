import TestnetProviders from '@/cypress/mock/TestnetProviders'
import MissionSocialLinks from '@/components/mission/MissionSocialLinks'

describe('MissionSocialLinks', () => {
  beforeEach(() => {
    cy.mountNextRouter('/')
  })

  it('renders nothing when no social links provided', () => {
    cy.mount(
      <TestnetProviders>
        <MissionSocialLinks socials={{}} />
      </TestnetProviders>
    )

    cy.get('body').should('not.contain', 'a[href]')
  })

  it('renders communications link when provided', () => {
    cy.mount(
      <TestnetProviders>
        <MissionSocialLinks socials={{ communications: 'https://discord.gg/test' }} />
      </TestnetProviders>
    )

    cy.get('a[href="https://discord.gg/test"]').should('exist')
    cy.get('a[href="https://discord.gg/test"]').should('have.attr', 'target', '_blank')
  })

  it('renders twitter link when provided', () => {
    cy.mount(
      <TestnetProviders>
        <MissionSocialLinks socials={{ twitter: 'https://twitter.com/test' }} />
      </TestnetProviders>
    )

    cy.get('a[href="https://twitter.com/test"]').should('exist')
    cy.get('a[href="https://twitter.com/test"]').should('have.attr', 'target', '_blank')
  })

  it('renders website link when provided', () => {
    cy.mount(
      <TestnetProviders>
        <MissionSocialLinks socials={{ website: 'https://example.com' }} />
      </TestnetProviders>
    )

    cy.get('a[href="https://example.com"]').should('exist')
    cy.get('a[href="https://example.com"]').should('have.attr', 'target', '_blank')
  })

  it('renders socialLink when provided', () => {
    cy.mount(
      <TestnetProviders>
        <MissionSocialLinks socials={{ socialLink: 'https://chat.example.com' }} />
      </TestnetProviders>
    )

    cy.get('a[href="https://chat.example.com"]').should('exist')
  })

  it('renders infoUri when provided', () => {
    cy.mount(
      <TestnetProviders>
        <MissionSocialLinks socials={{ infoUri: 'https://info.example.com' }} />
      </TestnetProviders>
    )

    cy.get('a[href="https://info.example.com"]').should('exist')
  })

  it('renders multiple links when provided', () => {
    cy.mount(
      <TestnetProviders>
        <MissionSocialLinks
          socials={{
            twitter: 'https://twitter.com/test',
            website: 'https://example.com',
            communications: 'https://discord.gg/test',
          }}
        />
      </TestnetProviders>
    )

    cy.get('a[href="https://twitter.com/test"]').should('exist')
    cy.get('a[href="https://example.com"]').should('exist')
    cy.get('a[href="https://discord.gg/test"]').should('exist')
  })

  it('applies custom className', () => {
    cy.mount(
      <TestnetProviders>
        <MissionSocialLinks
          socials={{ twitter: 'https://twitter.com/test' }}
          className="custom-class"
        />
      </TestnetProviders>
    )

    cy.get('div').should('have.class', 'custom-class')
  })
})
