import TestnetProviders from '@/cypress/mock/TestnetProviders'
import { CYPRESS_CHAIN_SLUG, CYPRESS_CHAIN_V5 } from '@/cypress/mock/config'
import JobTableABI from 'const/abis/JobBoardTable.json'
import TeamABI from 'const/abis/Team.json'
import { JOBS_TABLE_ADDRESSES, TEAM_ADDRESSES } from 'const/config'
import { getContract } from 'thirdweb'
import * as thirdweb from 'thirdweb'
import { serverClient } from '@/lib/thirdweb/client'
import { Job } from '@/components/jobs/Job'
import LatestJobs from '@/components/subscription/LatestJobs'

describe('<LatestJobs />', () => {
  let props: any
  let job: Job

  before(() => {
    cy.fixture('jobs/job.json').then((j) => {
      job = j
    })
  })

  beforeEach(() => {
    props = {
      teamContract: getContract({
        client: serverClient,
        address: TEAM_ADDRESSES[CYPRESS_CHAIN_SLUG],
        abi: TeamABI as any,
        chain: CYPRESS_CHAIN_V5,
      }),
      jobTableContract: getContract({
        client: serverClient,
        address: JOBS_TABLE_ADDRESSES[CYPRESS_CHAIN_SLUG],
        abi: JobTableABI as any,
        chain: CYPRESS_CHAIN_V5,
      }),
    }

    cy.mountNextRouter('/')
  })

  it('Renders the component and jobs', () => {
    // Mock readContract for getTableName and expiresAt
    cy.stub(thirdweb, 'readContract').callsFake(async (options: any) => {
      if (options.method === 'getTableName') {
        return 'jobs_table_12345'
      }
      if (options.method === 'expiresAt') {
        return BigInt(Math.floor(Date.now() / 1000) + 86400)
      }
      return BigInt(0)
    })

    // Set up intercept before mounting
    cy.intercept('GET', '**/api/tableland/query*', {
      statusCode: 200,
      body: [job, job],
    }).as('getLatestJobs')

    cy.mount(
      <TestnetProviders>
        <LatestJobs {...props} />
      </TestnetProviders>
    )

    cy.wait('@getLatestJobs', { timeout: 15000 })

    cy.get('.header', { timeout: 10000 }).contains('Latest Jobs')
    cy.get('#latest-jobs-container', { timeout: 10000 }).children().should('have.length', 2)
  })
})
