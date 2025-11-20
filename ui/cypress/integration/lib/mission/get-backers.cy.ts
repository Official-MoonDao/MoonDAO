import { getBackers } from '@/lib/mission/index'

describe('getBackers', () => {
  beforeEach(() => {
    cy.intercept('POST', '**/graphql**', (req) => {
      if (req.body && req.body.query && req.body.query.includes('backers')) {
        req.reply({
          body: {
            data: {
              backers: [
                {
                  id: '1',
                  backer: '0x1234567890123456789012345678901234567890',
                  projectId: '1',
                  totalAmountContributed: '1000000000000000000',
                  numberOfPayments: 1,
                  firstContributionTimestamp: '1000000',
                  lastContributionTimestamp: '1000000',
                },
              ],
            },
          },
        })
      }
    }).as('subgraphQuery')
  })

  it('fetches backers from subgraph when cache is expired', async () => {
    const backers = await getBackers(1, 1)
    expect(backers).to.be.an('array')
    expect(backers.length).to.be.greaterThan(0)
    expect(backers[0]).to.have.property('backer')
    expect(backers[0]).to.have.property('projectId')
  })

  it('returns cached data when available and fresh', async () => {
    // First call
    const backers1 = await getBackers(1, 1)
    // Second call should use cache
    const backers2 = await getBackers(1, 1)
    expect(backers1).to.deep.equal(backers2)
  })

  it('handles batch fetching for large datasets', () => {
    // Mock large dataset
    cy.intercept('POST', '**/graphql**', (req) => {
      if (req.body && req.body.query && req.body.query.includes('backers')) {
        const skip = req.body.variables?.skip || 0
        const batch = Array.from({ length: 1000 }, (_, i) => ({
          id: `${skip + i}`,
          backer: `0x${(skip + i).toString().padStart(40, '0')}`,
          projectId: '1',
          totalAmountContributed: '1000000000000000000',
          numberOfPayments: 1,
          firstContributionTimestamp: '1000000',
          lastContributionTimestamp: '1000000',
        }))
        req.reply({ body: { data: { backers: batch } } })
      }
    }).as('largeDataset')

    const backers = getBackers(1, 1).then((data: any) => {
      expect(data).to.be.an('array')
      expect(data.length).to.be.greaterThan(0)
      expect(data[0]).to.have.property('backer')
      expect(data[0]).to.have.property('projectId')
    })
  })

  it('throws error when neither missionId nor projectId provided', async () => {
    try {
      await getBackers(undefined, undefined)
      expect.fail('Should have thrown an error')
    } catch (error: any) {
      expect(error.message).to.include('Mission ID or Project ID is required')
    }
  })
})
