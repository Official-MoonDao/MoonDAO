import { CYPRESS_CHAIN_V5 } from '@/cypress/mock/config'
import * as thirdweb from 'thirdweb'
import {
  batchCheckSubscriptions,
  fetchCitizensWithLocation,
  getDummyCitizenLocationData,
} from '@/lib/citizen/citizenDataService'
import * as queryTableModule from '@/lib/tableland/queryTable'
import { getChainSlug } from '@/lib/thirdweb/chain'

describe('citizenDataService', () => {
  const chain = CYPRESS_CHAIN_V5
  const chainSlug = getChainSlug(chain)

  const mockCitizenRows = [
    {
      id: 1,
      name: 'Test Citizen 1',
      description: 'Description 1',
      image: 'ipfs://test-image-1',
      location: '{"name":"New York, NY, USA","lat":40.7128,"lng":-74.0060}',
      website: 'https://test1.com',
      discord: 'test1#1234',
      twitter: '@test1',
      view: 'public',
      formId: 'form123',
      owner: '0x1234567890123456789012345678901234567890',
    },
    {
      id: 2,
      name: 'Test Citizen 2',
      description: 'Description 2',
      image: 'ipfs://test-image-2',
      location: '{"name":"Los Angeles, CA, USA","lat":34.0522,"lng":-118.2437}',
      website: 'https://test2.com',
      discord: 'test2#1234',
      twitter: '@test2',
      view: 'public',
      formId: 'form456',
      owner: '0x2345678901234567890123456789012345678901',
    },
    {
      id: 3,
      name: 'Test Citizen 3',
      description: 'Description 3',
      image: 'ipfs://test-image-3',
      location: '{"name":"New York, NY, USA","lat":40.7128,"lng":-74.0060}',
      website: 'https://test3.com',
      discord: 'test3#1234',
      twitter: '@test3',
      view: 'public',
      formId: 'form789',
      owner: '0x3456789012345678901234567890123456789012',
    },
  ]

  describe('batchCheckSubscriptions', () => {
    beforeEach(() => {
      const now = Math.floor(Date.now() / 1000)
      const futureTimestamp = now + 86400 // 1 day in the future

      // Mock Engine API
      cy.intercept('POST', 'https://engine.thirdweb.com/v1/read/contract', (req) => {
        const params = req.body.params
        const results = params.map((param: any) => ({
          result: `0x${futureTimestamp.toString(16)}`,
        }))
        req.reply({ result: results })
      }).as('engineMulticall')
    })

    it('Returns a Map with subscription validation results', () => {
      const contractAddress = '0x123'
      const chainId = 42161
      const citizenIds = [1, 2, 3]

      batchCheckSubscriptions(citizenIds, contractAddress, chainId).then((results) => {
        expect(results).to.be.instanceOf(Map)
        expect(results.size).to.be.greaterThan(0)

        // Check that results contain validation data
        results.forEach((result) => {
          expect(result).to.have.property('id')
          expect(result).to.have.property('expiresAt')
          expect(result).to.have.property('isValid')
          expect(result.isValid).to.be.true
        })
      })
    })

    it('Handles empty citizen list', () => {
      const contractAddress = '0x123'
      const chainId = 42161

      batchCheckSubscriptions([], contractAddress, chainId).then((results) => {
        expect(results).to.be.instanceOf(Map)
        expect(results.size).to.equal(0)
      })
    })

    it('Calls progress callback during processing', () => {
      const contractAddress = '0x123'
      const chainId = 42161
      const citizenIds = Array.from({ length: 10 }, (_, i) => i + 1)

      let progressCalls = 0
      const onProgress = () => {
        progressCalls++
      }

      batchCheckSubscriptions(citizenIds, contractAddress, chainId, { onProgress }).then(
        (results) => {
          expect(results).to.be.instanceOf(Map)
          expect(progressCalls).to.be.greaterThan(0)
        }
      )
    })

    it('Handles API failures gracefully', () => {
      cy.intercept('POST', 'https://engine.thirdweb.com/v1/read/contract', {
        statusCode: 500,
        body: { error: 'Internal Server Error' },
      }).as('engineError')

      const contractAddress = '0x123'
      const chainId = 42161
      const citizenIds = [1, 2, 3]

      batchCheckSubscriptions(citizenIds, contractAddress, chainId).then((results) => {
        expect(results).to.be.instanceOf(Map)
        // Should return empty map on error
        expect(results.size).to.equal(0)
      })
    })

    it('Filters out expired subscriptions', () => {
      const now = Math.floor(Date.now() / 1000)
      const pastTimestamp = now - 86400 // 1 day in the past
      const futureTimestamp = now + 86400 // 1 day in the future

      cy.intercept('POST', 'https://engine.thirdweb.com/v1/read/contract', (req) => {
        const params = req.body.params
        const results = params.map((param: any, index: number) => {
          // First citizen expired, rest valid
          const timestamp = index === 0 ? pastTimestamp : futureTimestamp
          return {
            result: `0x${timestamp.toString(16)}`,
          }
        })
        req.reply({ result: results })
      }).as('engineMulticall')

      const contractAddress = '0x123'
      const chainId = 42161
      const citizenIds = [1, 2, 3]

      batchCheckSubscriptions(citizenIds, contractAddress, chainId).then((results) => {
        expect(results).to.be.instanceOf(Map)

        // Check validation results
        const result1 = results.get(1)
        const result2 = results.get(2)

        if (result1) {
          expect(result1.isValid).to.be.false
        }
        if (result2) {
          expect(result2.isValid).to.be.true
        }
      })
    })
  })

  describe('fetchCitizensWithLocation', () => {
    beforeEach(() => {
      // Mock queryTable to return citizen rows
      cy.stub(queryTableModule, 'default').resolves(mockCitizenRows)

      // Mock readContract for table name and subscription validation
      const now = Math.floor(Date.now() / 1000)
      const futureTimestamp = now + 86400

      cy.stub(thirdweb, 'getContract').returns({} as any)
      cy.stub(thirdweb, 'readContract').callsFake(async (options: any) => {
        if (options.method === 'getTableName') {
          return 'CITIZENTABLE_42161_123'
        }
        if (options.method === 'expiresAt') {
          return BigInt(futureTimestamp)
        }
        return null
      })
    })

    it('Returns grouped location data', () => {
      fetchCitizensWithLocation(chain).then((results) => {
        expect(results).to.be.an('array')
        expect(results.length).to.be.greaterThan(0)

        // Check structure of grouped location data
        if (results.length > 0) {
          const firstLocation = results[0]
          expect(firstLocation).to.have.property('citizens')
          expect(firstLocation).to.have.property('names')
          expect(firstLocation).to.have.property('formattedAddress')
          expect(firstLocation).to.have.property('lat')
          expect(firstLocation).to.have.property('lng')
          expect(firstLocation).to.have.property('color')
          expect(firstLocation).to.have.property('size')

          expect(firstLocation.citizens).to.be.an('array')
          expect(firstLocation.names).to.be.an('array')
        }
      })
    })

    it('Groups citizens at same location', () => {
      fetchCitizensWithLocation(chain).then((results) => {
        // Citizens 1 and 3 have the same location (New York)
        // They should be grouped together
        const newYorkLocation = results.find((loc) => loc.formattedAddress.includes('New York'))

        if (newYorkLocation) {
          expect(newYorkLocation.citizens.length).to.equal(2)
          expect(newYorkLocation.names).to.include('Test Citizen 1')
          expect(newYorkLocation.names).to.include('Test Citizen 3')
        }
      })
    })

    it('Assigns colors based on citizen count', () => {
      fetchCitizensWithLocation(chain).then((results) => {
        results.forEach((location) => {
          if (location.citizens.length > 3) {
            expect(location.color).to.equal('#6a3d79')
          } else if (location.citizens.length > 1) {
            expect(location.color).to.equal('#5e4dbf')
          } else {
            expect(location.color).to.equal('#5556eb')
          }
        })
      })
    })

    it('Calls progress callback during processing', () => {
      let progressCalls = 0
      const onProgress = () => {
        progressCalls++
      }

      fetchCitizensWithLocation(chain, { onProgress }).then(() => {
        expect(progressCalls).to.be.greaterThan(0)
      })
    })

    it('Handles errors gracefully and returns empty array', () => {
      cy.stub(queryTableModule, 'default').rejects(new Error('Database error'))

      fetchCitizensWithLocation(chain).then((results) => {
        expect(results).to.be.an('array')
        expect(results.length).to.equal(0)
      })
    })

    it('Filters out blocked citizens', () => {
      // Add a blocked citizen ID to the mock data
      const rowsWithBlockedCitizen = [
        ...mockCitizenRows,
        {
          id: 999, // Assuming this is a blocked ID in BLOCKED_CITIZENS
          name: 'Blocked Citizen',
          description: 'Should be filtered',
          image: 'ipfs://blocked',
          location: '{"name":"Test","lat":0,"lng":0}',
          website: '',
          discord: '',
          twitter: '',
          view: 'public',
          formId: 'blocked',
          owner: '0x0000000000000000000000000000000000000000',
        },
      ]

      cy.stub(queryTableModule, 'default').resolves(rowsWithBlockedCitizen)

      fetchCitizensWithLocation(chain).then((results) => {
        // Verify blocked citizen is not in results
        const allCitizens = results.flatMap((loc) => loc.citizens)
        const hasBlockedCitizen = allCitizens.some((c) => c.id === 999)
        expect(hasBlockedCitizen).to.be.false
      })
    })
  })

  describe('getDummyCitizenLocationData', () => {
    it('Returns dummy data for development', () => {
      const dummyData = getDummyCitizenLocationData()

      expect(dummyData).to.be.an('array')
      expect(dummyData.length).to.be.greaterThan(0)

      // Check structure
      const firstLocation = dummyData[0]
      expect(firstLocation).to.have.property('citizens')
      expect(firstLocation).to.have.property('names')
      expect(firstLocation).to.have.property('formattedAddress')
      expect(firstLocation).to.have.property('lat')
      expect(firstLocation).to.have.property('lng')
      expect(firstLocation).to.have.property('color')
      expect(firstLocation).to.have.property('size')
    })

    it('Returns consistent dummy data', () => {
      const dummyData1 = getDummyCitizenLocationData()
      const dummyData2 = getDummyCitizenLocationData()

      expect(dummyData1.length).to.equal(dummyData2.length)
      expect(dummyData1[0].citizens.length).to.equal(dummyData2[0].citizens.length)
    })
  })
})
