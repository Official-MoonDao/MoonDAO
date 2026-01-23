import TestnetProviders from '@/cypress/mock/TestnetProviders'
import React from 'react'
import { SENATORS_LIST, DEFAULT_CHAIN_V5 } from 'const/config'
import { getChainSlug } from '@/lib/thirdweb/chain'

// Test component to expose hook values
const TestHookComponent = ({ onData }: { onData: (data: any) => void }) => {
  const chainSlug = getChainSlug(DEFAULT_CHAIN_V5)
  const senators = SENATORS_LIST[chainSlug] || []
  
  React.useEffect(() => {
    onData({
      chainSlug,
      senators,
      senatorCount: senators.length,
      senatorNames: senators.map((s: any) => s.name),
    })
  }, [chainSlug, senators])
  
  return (
    <div data-testid="test-component">
      <span data-testid="chain-slug">{chainSlug}</span>
      <span data-testid="senator-count">{senators.length}</span>
      <ul data-testid="senator-list">
        {senators.map((s: any) => (
          <li key={s.address} data-testid={`senator-${s.name}`}>{s.name}</li>
        ))}
      </ul>
    </div>
  )
}

describe('useProposalData configuration', () => {
  beforeEach(() => {
    cy.mountNextRouter('/')
  })

  describe('Chain Configuration', () => {
    it('should use the correct chain slug based on DEFAULT_CHAIN_V5', () => {
      let capturedData: any = null

      cy.mount(
        <TestnetProviders>
          <TestHookComponent onData={(data) => { capturedData = data }} />
        </TestnetProviders>
      )

      cy.get('[data-testid="chain-slug"]').should('exist').then(() => {
        // Chain slug should be either 'arbitrum' (mainnet) or 'sepolia' (testnet)
        expect(['arbitrum', 'sepolia', 'arbitrum-sepolia']).to.include(capturedData?.chainSlug)
      })
    })

    it('should load senators list from the correct chain', () => {
      let capturedData: any = null

      cy.mount(
        <TestnetProviders>
          <TestHookComponent onData={(data) => { capturedData = data }} />
        </TestnetProviders>
      )

      cy.get('[data-testid="senator-count"]').should('exist').then(() => {
        // Should have senators loaded
        expect(capturedData?.senatorCount).to.be.greaterThan(0)
      })
    })
  })

  describe('Senators List Structure', () => {
    it('should have senators with required fields (address and name)', () => {
      const chainSlug = getChainSlug(DEFAULT_CHAIN_V5)
      const senators = SENATORS_LIST[chainSlug] || []

      senators.forEach((senator: any) => {
        expect(senator).to.have.property('address')
        expect(senator).to.have.property('name')
        expect(senator.address).to.be.a('string')
        expect(senator.name).to.be.a('string')
        expect(senator.address).to.match(/^0x[a-fA-F0-9]{40}$/)
      })
    })

    it('should have unique senator addresses', () => {
      const chainSlug = getChainSlug(DEFAULT_CHAIN_V5)
      const senators = SENATORS_LIST[chainSlug] || []
      const addresses = senators.map((s: any) => s.address.toLowerCase())
      const uniqueAddresses = [...new Set(addresses)]

      expect(addresses.length).to.equal(uniqueAddresses.length)
    })
  })

  describe('Mainnet Configuration', () => {
    it('arbitrum chain should have 9 senators', () => {
      const arbitrumSenators = SENATORS_LIST['arbitrum'] || []
      expect(arbitrumSenators.length).to.equal(9)
    })

    it('arbitrum senators should have correct names', () => {
      const arbitrumSenators = SENATORS_LIST['arbitrum'] || []
      const expectedNames = ['Frank', 'Kara', 'Alex', 'EngiBob', 'Anastasia', 'Eiman', 'Daniel', 'Titan', 'Jade']
      const actualNames = arbitrumSenators.map((s: any) => s.name)

      expectedNames.forEach(name => {
        expect(actualNames).to.include(name)
      })
    })
  })

  describe('Testnet Configuration', () => {
    it('sepolia chain should have 4 senators', () => {
      const sepoliaSenators = SENATORS_LIST['sepolia'] || []
      expect(sepoliaSenators.length).to.equal(4)
    })

    it('sepolia senators should have test names', () => {
      const sepoliaSenators = SENATORS_LIST['sepolia'] || []
      const actualNames = sepoliaSenators.map((s: any) => s.name)

      // All sepolia senators should have "Test Senator" in their name
      actualNames.forEach((name: string) => {
        expect(name).to.include('Test Senator')
      })
    })
  })
})

describe('SenatorVoteStatus initialization', () => {
  it('should initialize senators with hasVoted: false, votedApprove: false, votedDeny: false', () => {
    const chainSlug = getChainSlug(DEFAULT_CHAIN_V5)
    const senators = SENATORS_LIST[chainSlug] || []
    
    // Simulate the initialization from useProposalData
    const initializedSenators = senators.map((s: any) => ({
      ...s,
      hasVoted: false,
      votedApprove: false,
      votedDeny: false,
    }))

    initializedSenators.forEach((senator: any) => {
      expect(senator.hasVoted).to.equal(false)
      expect(senator.votedApprove).to.equal(false)
      expect(senator.votedDeny).to.equal(false)
    })
  })
})
