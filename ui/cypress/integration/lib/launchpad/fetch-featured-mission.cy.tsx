import { CYPRESS_CHAIN_V5 } from '@/cypress/mock/config'
import * as thirdweb from 'thirdweb'
import { fetchFeaturedMissionData } from '@/lib/launchpad/fetchFeaturedMission'
import { Mission } from '@/lib/launchpad/types'
import * as missionModule from '@/lib/mission'
import { getChainSlug } from '@/lib/thirdweb/chain'

describe('fetchFeaturedMissionData', () => {
  const chain = CYPRESS_CHAIN_V5
  const chainSlug = getChainSlug(chain)
  const jbV5ControllerAddress = '0x0987654321098765432109876543210987654321'
  const jbV5ControllerAbi: any[] = []

  const mockMissions: Mission[] = [
    {
      id: '1',
      teamId: '1',
      projectId: '100',
      fundingGoal: 1000000,
      metadata: {
        name: 'Test Mission',
        description: 'Test Description',
        image: '/test.png',
      },
    },
    {
      id: '2',
      teamId: '2',
      projectId: '200',
      fundingGoal: 2000000,
      metadata: {
        name: 'Test Mission 2',
        description: 'Test Description 2',
        image: '/test2.png',
      },
    },
  ]

  beforeEach(() => {
    cy.stub(thirdweb, 'getContract').returns({} as any)
    cy.stub(thirdweb, 'readContract').resolves('0x123')
    cy.stub(missionModule, 'getBackers').resolves([])
  })

  it('Returns null when no featured mission found', async () => {
    const emptyMissions: Mission[] = []

    const result = await fetchFeaturedMissionData(
      emptyMissions,
      chain,
      chainSlug,
      jbV5ControllerAddress,
      jbV5ControllerAbi
    )

    expect(result).to.be.null
  })

  it('Fetches and returns complete FeaturedMissionData structure with all properties', () => {
    const mockBackers = [
      {
        id: '1',
        backer: '0x123',
        projectId: '100',
        totalAmountContributed: '1000000',
        numberOfPayments: 1,
        firstContributionTimestamp: '1000000',
        lastContributionTimestamp: '1000000',
      },
    ]

    cy.stub(missionModule, 'getBackers').resolves(mockBackers)
    cy.stub(thirdweb, 'readContract')
      .onCall(0)
      .resolves(1)
      .onCall(1)
      .resolves('0xpayhook')
      .onCall(2)
      .resolves('0xtoken')
      .onCall(3)
      .resolves('0xterminal')
      .onCall(4)
      .resolves([{ weight: '1000000' }, { reservedPercent: '10000000' }])
      .onCall(5)
      .resolves(1000)
      .onCall(6)
      .resolves(2000)
      .onCall(7)
      .resolves('Token Name')
      .onCall(8)
      .resolves('TKN')
      .onCall(9)
      .resolves('1000000')

    fetchFeaturedMissionData(
      mockMissions,
      chain,
      chainSlug,
      jbV5ControllerAddress,
      jbV5ControllerAbi
    ).then((result) => {
      expect(result).to.not.be.null
      if (result) {
        expect(result.mission).to.have.property('projectId')
        expect(result.mission.fundingGoal).to.be.greaterThan(0)
        expect(result).to.have.property('mission')
        expect(result).to.have.property('_stage')
        expect(result._stage).to.equal(1)
        expect(result).to.have.property('_deadline')
        expect(result).to.have.property('_refundPeriod')
        expect(result).to.have.property('_primaryTerminalAddress')
        expect(result._primaryTerminalAddress).to.equal('0xterminal')
        expect(result).to.have.property('_token')
        expect(result._token).to.have.property('tokenAddress')
        expect(result._token.tokenAddress).to.equal('0xtoken')
        expect(result._token).to.have.property('tokenName')
        expect(result._token.tokenName).to.equal('Token Name')
        expect(result._token).to.have.property('tokenSymbol')
        expect(result._token.tokenSymbol).to.equal('TKN')
        expect(result._token).to.have.property('tokenSupply')
        expect(result._token.tokenSupply).to.equal('1000000')
        expect(result).to.have.property('_fundingGoal')
        expect(result._fundingGoal).to.equal(1000000)
        expect(result).to.have.property('_ruleset')
        expect(result._ruleset).to.not.be.null
        expect(result).to.have.property('_backers')
        expect(result._backers).to.be.an('array')
        expect(result._backers.length).to.equal(1)
        expect(result).to.have.property('projectMetadata')
        expect(result.projectMetadata).to.have.property('name')
        expect(result.projectMetadata.name).to.equal('Test Mission')
      }
    })
  })

  it('Handles missing payHook gracefully', () => {
    cy.stub(thirdweb, 'readContract')
      .onCall(0)
      .resolves(1)
      .onCall(1)
      .resolves('0x0000000000000000000000000000000000000000')
      .onCall(2)
      .resolves('0xtoken')
      .onCall(3)
      .resolves('0xterminal')
      .onCall(4)
      .resolves([{ weight: '1000000' }, { reservedPercent: '10000000' }])

    fetchFeaturedMissionData(
      mockMissions,
      chain,
      chainSlug,
      jbV5ControllerAddress,
      jbV5ControllerAbi
    ).then((result) => {
      expect(result).to.not.be.null
      if (result) {
        expect(result._deadline).to.be.undefined
        expect(result._refundPeriod).to.be.undefined
      }
    })
  })

  it('Handles errors gracefully', () => {
    cy.stub(thirdweb, 'readContract').rejects(new Error('Test error'))

    fetchFeaturedMissionData(
      mockMissions,
      chain,
      chainSlug,
      jbV5ControllerAddress,
      jbV5ControllerAbi
    ).then((result) => {
      expect(result).to.be.null
    })
  })
})
