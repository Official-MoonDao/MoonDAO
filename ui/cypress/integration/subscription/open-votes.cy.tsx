import TestnetProviders from '@/cypress/mock/TestnetProviders'
import OpenVotes from '@/components/subscription/OpenVotes'

describe('OpenVotes Component', () => {
  let proposal: any
  let proposalPacket: any

  before(() => {
    cy.fixture('nance/proposal').then((p) => {
      proposal = p
    })
    cy.fixture('nance/proposal-packet').then((p) => {
      proposalPacket = p
    })
  })

  beforeEach(() => {
    cy.mountNextRouter('/')
    cy.mount(
      <TestnetProviders>
        <OpenVotes
          proposals={[
            proposal,
            { ...proposal, uuid: 'f5db001241b14465873f06c4841d3b51' },
          ]}
          packet={proposalPacket}
          votingInfoMap={undefined}
        />
      </TestnetProviders>
    )
  })

  it('Renders the component and proposals', () => {
    cy.get('.header').contains('Open Votes')
    cy.get('#proposal-card').should('exist')
  })
})
