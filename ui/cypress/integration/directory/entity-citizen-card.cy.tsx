import { PrivyProvider } from '@privy-io/react-auth'
import { Sepolia } from '@thirdweb-dev/chains'
import { NFT } from '@thirdweb-dev/sdk'
import React from 'react'
import { PrivyThirdwebSDKProvider } from '@/lib/privy/PrivyThirdwebSDKProvider'
import EntityCitizenCard from '@/components/directory/EntityCitizenCard'

describe('<EntityCitizenCard />', () => {
  let dummyNft: NFT
  before(() => {
    //load product test data from fixture
    cy.fixture('nft/nft').then((nft) => {
      dummyNft = nft
    })
  })
  it('Renders Entity Citizen Card as Entity', () => {
    cy.mount(
      <PrivyProvider appId={process.env.NEXT_PUBLIC_PRIVY_APP_ID as string}>
        <PrivyThirdwebSDKProvider selectedChain={Sepolia}>
          <EntityCitizenCard
            metadata={dummyNft.metadata}
            owner={dummyNft.owner}
            type="entity"
          />
        </PrivyThirdwebSDKProvider>
      </PrivyProvider>
    )
    cy.get('#entity-citizen-card-name').should(
      'have.text',
      dummyNft.metadata.name
    )
    cy.get('#entity-citizen-card-description').should(
      'have.text',
      dummyNft.metadata.description
    )
    cy.get('#entity-citizen-card-id').should(
      'have.text',
      `ID: ${dummyNft.metadata.id}`
    )
    cy.get('#entity-citizen-card-type').should('have.text', 'Entity')
  })

  it('Renders Entity Citizen Card as Citizen', () => {
    cy.mount(
      <PrivyProvider appId={process.env.NEXT_PUBLIC_PRIVY_APP_ID as string}>
        <PrivyThirdwebSDKProvider selectedChain={Sepolia}>
          <EntityCitizenCard
            metadata={dummyNft.metadata}
            owner={dummyNft.owner}
            type="citizen"
          />
        </PrivyThirdwebSDKProvider>
      </PrivyProvider>
    )

    cy.get('#entity-citizen-card-type').should('have.text', 'Citizen')
  })
})
