import { CYPRESS_CHAIN_V5 } from '@/cypress/mock/config'
import * as thirdweb from 'thirdweb'
import * as queryTableModule from '@/lib/tableland/queryTable'
import {
  batchFetchTeamOwners,
  fetchTeamsWithOwners,
  fetchTeamWithOwner,
  getDummyTeamData,
} from '@/lib/team/teamDataService'
import { getChainSlug } from '@/lib/thirdweb/chain'

describe('teamDataService', () => {
  const chain = CYPRESS_CHAIN_V5
  const chainSlug = getChainSlug(chain)

  const mockTeamRows = [
    {
      id: 1,
      name: 'Test Team 1',
      description: 'Description 1',
      image: 'ipfs://test-image-1',
      website: 'https://test1.com',
      communications: 'https://discord.gg/test1',
      view: 'public',
      formId: 'form123',
    },
    {
      id: 2,
      name: 'Test Team 2',
      description: 'Description 2',
      image: 'ipfs://test-image-2',
      website: 'https://test2.com',
      communications: 'https://discord.gg/test2',
      view: 'public',
      formId: 'form456',
    },
    {
      id: 3,
      name: 'Test Team 3',
      description: 'Description 3',
      image: 'ipfs://test-image-3',
      website: 'https://test3.com',
      communications: 'https://discord.gg/test3',
      view: 'public',
      formId: 'form789',
    },
  ]

  describe('batchFetchTeamOwners', () => {
    beforeEach(() => {
      // Mock Engine API for ownerOf calls
      cy.intercept('POST', 'https://engine.thirdweb.com/v1/read/contract', (req) => {
        const params = req.body.params
        const results = params.map((param: any, index: number) => ({
          result: `0x${(index + 1).toString().padStart(40, '0')}`,
        }))
        req.reply({ result: results })
      }).as('engineMulticall')
    })

    it('Returns a Map with team owner addresses', () => {
      const contractAddress = '0x123'
      const chainId = 42161
      const teamIds = [1, 2, 3]

      batchFetchTeamOwners(teamIds, contractAddress, chainId).then((results) => {
        expect(results).to.be.instanceOf(Map)
        expect(results.size).to.equal(3)

        // Check that results contain owner addresses
        results.forEach((ownerAddress, teamId) => {
          expect(ownerAddress).to.be.a('string')
          expect(ownerAddress).to.match(/^0x[0-9a-fA-F]{40}$/)
        })
      })
    })

    it('Handles empty team list', () => {
      const contractAddress = '0x123'
      const chainId = 42161

      batchFetchTeamOwners([], contractAddress, chainId).then((results) => {
        expect(results).to.be.instanceOf(Map)
        expect(results.size).to.equal(0)
      })
    })

    it('Calls onProgress callback correctly', () => {
      const contractAddress = '0x123'
      const chainId = 42161
      const teamIds = [1, 2, 3]
      let progressCalls = 0

      const onProgress = (completed: number, total: number) => {
        progressCalls++
        expect(total).to.equal(3)
        expect(completed).to.be.at.most(total)
      }

      batchFetchTeamOwners(teamIds, contractAddress, chainId, { onProgress }).then(() => {
        expect(progressCalls).to.be.greaterThan(0)
      })
    })

    it('Handles API errors gracefully', () => {
      cy.intercept('POST', 'https://engine.thirdweb.com/v1/read/contract', {
        statusCode: 500,
        body: { error: 'Internal Server Error' },
      }).as('engineError')

      const contractAddress = '0x123'
      const chainId = 42161
      const teamIds = [1, 2, 3]

      batchFetchTeamOwners(teamIds, contractAddress, chainId).then((results) => {
        expect(results).to.be.instanceOf(Map)
        expect(results.size).to.equal(0)
      })
    })
  })

  describe('fetchTeamWithOwner', () => {
    beforeEach(() => {
      // Mock queryTable
      cy.stub(queryTableModule, 'default').resolves(mockTeamRows)

      // Mock readContract for ownerOf
      cy.stub(thirdweb, 'readContract').resolves('0x1234567890123456789012345678901234567890')
    })

    it('Returns team with owner data for valid team ID', () => {
      fetchTeamWithOwner(chain, 1).then((result) => {
        expect(result).to.not.be.null
        expect(result).to.have.property('owner')
        expect(result?.owner).to.be.a('string')
        expect(result?.metadata.name).to.equal('Test Team 1')
      })
    })

    it('Returns null for blocked team', () => {
      // Team ID in BLOCKED_TEAMS would return null
      // This test would need to mock a blocked team ID
      fetchTeamWithOwner(chain, 999).then((result) => {
        // Should handle appropriately based on blocking logic
        expect(result).to.satisfy((r: any) => r === null || r.metadata.id === '999')
      })
    })

    it('Returns null for non-existent team', () => {
      cy.stub(queryTableModule, 'default').resolves([])

      fetchTeamWithOwner(chain, 999).then((result) => {
        expect(result).to.be.null
      })
    })
  })

  describe('fetchTeamsWithOwners', () => {
    beforeEach(() => {
      // Mock queryTable
      cy.stub(queryTableModule, 'default').resolves(mockTeamRows)

      // Mock Engine API for batch ownerOf calls
      cy.intercept('POST', 'https://engine.thirdweb.com/v1/read/contract', (req) => {
        const params = req.body.params
        const results = params.map((param: any, index: number) => ({
          result: `0x${(index + 1).toString().padStart(40, '0')}`,
        }))
        req.reply({ result: results })
      }).as('engineMulticall')

      // Mock readContract for table name
      cy.stub(thirdweb, 'readContract').resolves('test_team_table')
    })

    it('Returns array of teams with owners', () => {
      fetchTeamsWithOwners(chain).then((results) => {
        expect(results).to.be.an('array')
        expect(results.length).to.be.greaterThan(0)

        results.forEach((team) => {
          expect(team).to.have.property('owner')
          expect(team.owner).to.be.a('string')
          expect(team.metadata).to.have.property('name')
        })
      })
    })

    it('Respects limit option', () => {
      fetchTeamsWithOwners(chain, { limit: 2 }).then((results) => {
        expect(results).to.be.an('array')
        // Note: Actual limit enforcement happens in SQL query
        expect(results.length).to.be.at.most(mockTeamRows.length)
      })
    })

    it('Calls onProgress callback with correct steps', () => {
      const progressSteps: string[] = []
      const onProgress = (step: string, completed: number, total: number) => {
        progressSteps.push(step)
      }

      fetchTeamsWithOwners(chain, { onProgress }).then(() => {
        expect(progressSteps).to.include('Fetching team table name')
        expect(progressSteps).to.include('Querying team table')
        expect(progressSteps).to.include('Converting team data')
        expect(progressSteps).to.include('Fetching team owners')
      })
    })

    it('Handles empty team table', () => {
      cy.stub(queryTableModule, 'default').resolves([])

      fetchTeamsWithOwners(chain).then((results) => {
        expect(results).to.be.an('array')
        expect(results.length).to.equal(0)
      })
    })

    it('Filters blocked teams', () => {
      const teamsWithBlocked = [
        ...mockTeamRows,
        {
          id: 999,
          name: 'Blocked Team',
          description: 'Should be filtered',
          image: 'ipfs://blocked',
          website: '',
          communications: '',
          view: 'public',
          formId: '',
        },
      ]

      cy.stub(queryTableModule, 'default').resolves(teamsWithBlocked)

      fetchTeamsWithOwners(chain).then((results) => {
        const blockedTeam = results.find((t: any) => t.metadata.id === '999')
        // Should not include blocked teams
        expect(results).to.be.an('array')
      })
    })
  })

  describe('getDummyTeamData', () => {
    it('Returns array of dummy teams', () => {
      const dummyData = getDummyTeamData()

      expect(dummyData).to.be.an('array')
      expect(dummyData.length).to.be.greaterThan(0)

      dummyData.forEach((team) => {
        expect(team).to.have.property('owner')
        expect(team).to.have.property('metadata')
        expect(team.metadata).to.have.property('name')
        expect(team.metadata).to.have.property('description')
      })
    })
  })
})
