import TestnetProviders from '@/cypress/mock/TestnetProviders'
import { CYPRESS_CHAIN_SLUG, CYPRESS_CHAIN_V5 } from '@/cypress/mock/config'
import JobTableABI from 'const/abis/JobBoardTable.json'
import TeamABI from 'const/abis/Team.json'
import { JOBS_TABLE_ADDRESSES, TABLELAND_ENDPOINT, TEAM_ADDRESSES } from 'const/config'
import { getContract } from 'thirdweb'
import * as thirdweb from 'thirdweb'
import { serverClient } from '@/lib/thirdweb/client'
import { Job } from '@/components/jobs/Job'
import LatestJobs from '@/components/subscription/LatestJobs'

describe('<LatestJobs />', () => {
  let props: any
  let job: Job
  const mockTableName = 'jobs_table_12345'
  const futureTimestamp = Math.floor(Date.now() / 1000) + 86400 // 24 hours in the future

  before(() => {
    cy.fixture('jobs/job.json').then((j) => {
      job = j
    })
  })

  beforeEach(() => {
    // Mock readContract for getTableName and expiresAt
    cy.stub(thirdweb, 'readContract').callsFake(async (options: any) => {
      if (options.method === 'getTableName') {
        return mockTableName
      }
      if (options.method === 'expiresAt') {
        return BigInt(futureTimestamp)
      }
      return null
    })

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

    cy.intercept('GET', `/api/tableland/query?statement=*`, {
      statusCode: 200,
      body: [job, job],
    }).as('getLatestJobs')

    cy.mountNextRouter('/')
    cy.mount(
      <TestnetProviders>
        <LatestJobs {...props} />
      </TestnetProviders>
    )
  })

  it('Renders the component and jobs', () => {
    cy.wait('@getLatestJobs')

    cy.get('h2.font-GoodTimes').contains('Latest Jobs')
    cy.get('#latest-jobs-container').children().should('have.length', 2)
  })
})
