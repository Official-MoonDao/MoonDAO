import { PrivyProvider } from '@privy-io/react-auth'
import { Sepolia } from '@thirdweb-dev/chains'
import { PrivyThirdwebSDKProvider } from '@/lib/privy/PrivyThirdwebSDKProvider'
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
      <PrivyProvider appId={process.env.NEXT_PUBLIC_PRIVY_APP_ID as string}>
        <PrivyThirdwebSDKProvider selectedChain={Sepolia}>
          <OpenVotes
            proposals={[
              proposal,
              { ...proposal, uuid: 'f5db001241b14465873f06c4841d3b51' },
            ]}
            packet={proposalPacket}
            votingInfoMap={undefined}
          />
        </PrivyThirdwebSDKProvider>
      </PrivyProvider>
    )
  })

  it('Renders the component and proposals', () => {
    cy.get('.header').contains('Open Votes')
    cy.get('#proposal-list-item').should('exist')
  })
})
