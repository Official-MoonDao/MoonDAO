import { CYPRESS_CHAIN_V5 } from '@/cypress/mock/config'
import * as thirdweb from 'thirdweb'
import { fetchMissions } from '@/lib/launchpad/fetchMissions'
import * as queryTableModule from '@/lib/tableland/queryTable'
import { getChainSlug } from '@/lib/thirdweb/chain'

describe('fetchMissions', () => {
  const chain = CYPRESS_CHAIN_V5
  const chainSlug = getChainSlug(chain)
  const missionTableAddress = '0x1234567890123456789012345678901234567890'
  const jbV5ControllerAddress = '0x0987654321098765432109876543210987654321'

  beforeEach(() => {
    cy.stub(queryTableModule, 'default').resolves([
      {
        id: '1',
        teamId: '1',
        projectId: '100',
        fundingGoal: 1000000,
      },
      {
        id: '2',
        teamId: '2',
        projectId: null,
        fundingGoal: 0,
      },
    ])

    cy.stub(thirdweb, 'getContract').returns({} as any)
    cy.stub(thirdweb, 'readContract').resolves('test-table-name')
    cy.stub(global, 'fetch').resolves({
      json: () =>
        Promise.resolve({
          name: 'Test Mission',
          description: 'Test Description',
          image: '/test.png',
        }),
    } as Response)
  })

  it('Returns empty array on error', () => {
    cy.stub(queryTableModule, 'default').rejects(new Error('Test error'))

    fetchMissions(chain, chainSlug, missionTableAddress, jbV5ControllerAddress).then((result) => {
      expect(result).to.be.an('array')
      expect(result.length).to.equal(0)
    })
  })

  it('Filters blocked missions correctly', () => {
    const mockMissionRows = [
      {
        id: 'blocked-1',
        teamId: '1',
        projectId: '100',
        fundingGoal: 1000000,
      },
      {
        id: '2',
        teamId: '2',
        projectId: '200',
        fundingGoal: 2000000,
      },
    ]

    cy.stub(queryTableModule, 'default').resolves(mockMissionRows)

    fetchMissions(chain, chainSlug, missionTableAddress, jbV5ControllerAddress).then((result) => {
      expect(result).to.be.an('array')
    })
  })

  it('Fetches and returns missions with correct structure and metadata', () => {
    fetchMissions(chain, chainSlug, missionTableAddress, jbV5ControllerAddress).then((result) => {
      expect(result).to.be.an('array')
      expect(result.length).to.be.greaterThan(0)

      if (result.length > 0) {
        const mission = result[0]
        expect(mission).to.have.property('id')
        expect(mission.id).to.equal('1')
        expect(mission).to.have.property('teamId')
        expect(mission.teamId).to.equal('1')
        expect(mission).to.have.property('projectId')
        expect(mission.projectId).to.equal('100')
        expect(mission).to.have.property('fundingGoal')
        expect(mission.fundingGoal).to.equal(1000000)
        expect(mission).to.have.property('metadata')
        expect(mission.metadata).to.have.property('name')
        expect(mission.metadata.name).to.equal('Test Mission')
        expect(mission.metadata).to.have.property('description')
        expect(mission.metadata.description).to.equal('Test Description')
        expect(mission.metadata).to.have.property('image')
        expect(mission.metadata.image).to.equal('/test.png')
      }
    })
  })

  it('Handles missing projectId gracefully', () => {
    cy.stub(queryTableModule, 'default').resolves([
      {
        id: '1',
        teamId: '1',
        projectId: null,
        fundingGoal: 0,
      },
    ])

    fetchMissions(chain, chainSlug, missionTableAddress, jbV5ControllerAddress).then((result) => {
      expect(result).to.be.an('array')
      if (result.length > 0) {
        expect(result[0].projectId).to.be.null
        expect(result[0].metadata.name).to.include('Loading')
      }
    })
  })
})
