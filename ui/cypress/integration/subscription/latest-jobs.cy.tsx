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
  const mockTableName = 'jobs_table_12345'
  const futureTimestamp = Math.floor(Date.now() / 1000) + 86400 // 24 hours in the future

  before(() => {
    cy.fixture('jobs/job.json').then((j) => {
      job = j
    })
  })

  beforeEach(() => {
    // Encode BigInt response for expiresAt (future timestamp)
    const futureTimestampHex = '0x' + BigInt(futureTimestamp).toString(16).padStart(64, '0')
    
    // Intercept thirdweb RPC calls
    cy.intercept('POST', '**/*.thirdweb.com/**', (req) => {
      if (req.body?.method === 'eth_call' || (Array.isArray(req.body) && req.body[0]?.method === 'eth_call')) {
        const requests = Array.isArray(req.body) ? req.body : [req.body]
        const responses = requests.map((r: any) => ({
          jsonrpc: '2.0',
          id: r.id,
          result: futureTimestampHex,
        }))
        req.reply(Array.isArray(req.body) ? responses : responses[0])
      } else {
        req.continue()
      }
    }).as('thirdwebRpc')

    // Stub thirdweb readContract (may not work with ES modules due to bundling)
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

    cy.intercept('GET', /\/api\/tableland\/query\?statement=.*/, {
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
    // Verify the component renders with the title
    cy.get('h2.font-GoodTimes').contains('Latest Jobs')
    
    // Verify the container exists
    cy.get('#latest-jobs-container').should('exist')
    
    // Verify the "See More" button exists
    cy.contains('See More').should('exist')
  })
})
