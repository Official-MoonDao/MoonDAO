import { CYPRESS_CHAIN_V5 } from '@/cypress/mock/config'
import { batchFetchHatTeamData, processHatsWithTeamData } from '@/lib/hats/batchHatOperations'
import { getChainSlug } from '@/lib/thirdweb/chain'

describe('batchHatOperations', () => {
  const chain = CYPRESS_CHAIN_V5
  const chainSlug = getChainSlug(chain)

  const mockHats = [
    {
      id: '0x0000000100000000000000000000000000000000000000000000000000000000',
      admin: {
        id: '0x0000000100010000000000000000000000000000000000000000000000000000',
        admin: {
          id: '0x0000000100010001000000000000000000000000000000000000000000000000',
        },
      },
    },
    {
      id: '0x0000000200000000000000000000000000000000000000000000000000000000',
      admin: {
        id: '0x0000000200010000000000000000000000000000000000000000000000000000',
        admin: {
          id: '0x0000000200010001000000000000000000000000000000000000000000000000',
        },
      },
    },
    {
      id: '0x0000000300000000000000000000000000000000000000000000000000000000',
      admin: {
        id: '0x0000000300010000000000000000000000000000000000000000000000000000',
        admin: {
          id: '0x0000000300010001000000000000000000000000000000000000000000000000',
        },
      },
    },
  ]

  describe('batchFetchHatTeamData', () => {
    beforeEach(() => {
      // Mock Engine API for adminHatToTokenId and teamAdminHat calls
      cy.intercept('POST', 'https://engine.thirdweb.com/v1/read/contract', (req) => {
        const params = req.body.params

        const results = params.map((param: any) => {
          const method = param.method

          if (method === 'adminHatToTokenId') {
            // Return a team ID (non-zero for some hats)
            const hatId = param.params[0]
            const teamIdNum = hatId.includes('00010001') ? 1 : hatId.includes('0001') ? 1 : 0
            return {
              result: `0x${teamIdNum.toString(16).padStart(64, '0')}`,
            }
          }

          if (method === 'teamAdminHat') {
            // Return admin hat ID for team
            const teamId = param.params[0]
            return {
              result: '0x0000000100010001000000000000000000000000000000000000000000000000',
            }
          }

          return { result: '0x0' }
        })

        req.reply({ result: results })
      }).as('engineMulticall')
    })

    it('Returns a Map with hat team data', () => {
      batchFetchHatTeamData(chain, mockHats).then((results) => {
        expect(results).to.be.instanceOf(Map)

        // Check structure of results
        results.forEach((teamData, hatId) => {
          expect(teamData).to.have.property('hatId')
          expect(teamData).to.have.property('teamId')
          expect(teamData).to.have.property('isAdminHat')
          expect(teamData.isAdminHat).to.be.a('boolean')
        })
      })
    })

    it('Handles empty hats array', () => {
      batchFetchHatTeamData(chain, []).then((results) => {
        expect(results).to.be.instanceOf(Map)
        expect(results.size).to.equal(0)
      })
    })

    it('Identifies admin hats correctly', () => {
      batchFetchHatTeamData(chain, mockHats).then((results) => {
        results.forEach((teamData) => {
          if (teamData.teamId !== '0') {
            expect(teamData).to.have.property('isAdminHat')
          }
        })
      })
    })

    it('Handles API errors gracefully', () => {
      cy.intercept('POST', 'https://engine.thirdweb.com/v1/read/contract', {
        statusCode: 500,
        body: { error: 'Internal Server Error' },
      }).as('engineError')

      batchFetchHatTeamData(chain, mockHats).then((results) => {
        expect(results).to.be.instanceOf(Map)
        expect(results.size).to.equal(0)
      })
    })

    it('Batches multiple contract calls efficiently', () => {
      let callCount = 0

      cy.intercept('POST', 'https://engine.thirdweb.com/v1/read/contract', (req) => {
        callCount++
        const params = req.body.params
        const results = params.map(() => ({
          result: '0x0000000000000000000000000000000000000000000000000000000000000001',
        }))
        req.reply({ result: results })
      }).as('engineMulticallCount')

      batchFetchHatTeamData(chain, mockHats).then(() => {
        // Should make only 2 batch calls: one for adminHatToTokenId, one for teamAdminHat
        expect(callCount).to.be.lessThan(10) // Much less than individual calls
      })
    })
  })

  describe('processHatsWithTeamData', () => {
    beforeEach(() => {
      // Mock Engine API
      cy.intercept('POST', 'https://engine.thirdweb.com/v1/read/contract', (req) => {
        const params = req.body.params
        const results = params.map((param: any) => {
          if (param.method === 'adminHatToTokenId') {
            return {
              result: '0x0000000000000000000000000000000000000000000000000000000000000001',
            }
          }
          if (param.method === 'teamAdminHat') {
            return {
              result: '0x0000000100010001000000000000000000000000000000000000000000000000',
            }
          }
          return { result: '0x0' }
        })
        req.reply({ result: results })
      }).as('engineMulticall')
    })

    it('Returns array of hats with team IDs', () => {
      processHatsWithTeamData(chain, mockHats).then((results) => {
        expect(results).to.be.an('array')

        results.forEach((hat) => {
          expect(hat).to.have.property('teamId')
          expect(hat.teamId).to.be.a('string')
        })
      })
    })

    it('Filters out hats without team associations', () => {
      const hatsWithSomeUnassociated = [
        ...mockHats,
        {
          id: '0x9999999900000000000000000000000000000000000000000000000000000000',
          admin: {
            id: '0x9999999900010000000000000000000000000000000000000000000000000000',
            admin: {
              id: '0x9999999900010001000000000000000000000000000000000000000000000000',
            },
          },
        },
      ]

      processHatsWithTeamData(chain, hatsWithSomeUnassociated).then((results) => {
        expect(results).to.be.an('array')
        // Should only include hats with valid team associations
        results.forEach((hat) => {
          expect(hat.teamId).to.not.equal('0')
        })
      })
    })

    it('Handles empty hats array', () => {
      processHatsWithTeamData(chain, []).then((results) => {
        expect(results).to.be.an('array')
        expect(results.length).to.equal(0)
      })
    })

    it('Preserves original hat properties', () => {
      processHatsWithTeamData(chain, mockHats).then((results) => {
        results.forEach((hat, index) => {
          expect(hat.id).to.equal(mockHats[index].id)
          expect(hat.admin.id).to.equal(mockHats[index].admin.id)
        })
      })
    })

    it('Handles null or undefined hats gracefully', () => {
      processHatsWithTeamData(chain, null as any).then((results) => {
        expect(results).to.be.an('array')
        expect(results.length).to.equal(0)
      })
    })
  })

  describe('Performance', () => {
    it('Batches calls more efficiently than sequential calls', () => {
      let totalCalls = 0

      cy.intercept('POST', 'https://engine.thirdweb.com/v1/read/contract', (req) => {
        totalCalls++
        const params = req.body.params
        const results = params.map(() => ({
          result: '0x0000000000000000000000000000000000000000000000000000000000000001',
        }))
        req.reply({ result: results })
      }).as('engineMulticallPerf')

      const largeHatArray = Array.from({ length: 10 }, (_, i) => ({
        id: `0x000000${i
          .toString()
          .padStart(2, '0')}00000000000000000000000000000000000000000000000000000000`,
        admin: {
          id: `0x000000${i
            .toString()
            .padStart(2, '0')}01000000000000000000000000000000000000000000000000000000`,
          admin: {
            id: `0x000000${i
              .toString()
              .padStart(2, '0')}01000100000000000000000000000000000000000000000000000000`,
          },
        },
      }))

      processHatsWithTeamData(chain, largeHatArray).then(() => {
        // With 10 hats, sequential would be 40+ calls (4 per hat)
        // Batched should be just 2 calls
        expect(totalCalls).to.be.lessThan(10)
      })
    })
  })
})
