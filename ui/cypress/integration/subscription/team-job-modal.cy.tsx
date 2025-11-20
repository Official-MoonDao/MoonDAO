import TestnetProviders from '@/cypress/mock/TestnetProviders'
import { CYPRESS_CHAIN_SLUG, CYPRESS_CHAIN_V5 } from '@/cypress/mock/config'
import JobTableABI from 'const/abis/JobBoardTable.json'
import { JOBS_TABLE_ADDRESSES } from 'const/config'
import { Toaster } from 'react-hot-toast'
import { getContract } from 'thirdweb'
import { serverClient } from '@/lib/thirdweb/client'
import { Job } from '@/components/jobs/Job'
import TeamJobModal from '@/components/subscription/TeamJobModal'

describe('<TeamJobModal />', () => {
  let job: Job
  let props: any

  before(() => {
    cy.fixture('jobs/job').then((j) => {
      job = j
    })
  })

  beforeEach(() => {
    props = {
      job,
      teamId: 0,
      setEnabled: cy.stub(),
      refreshJobs: cy.stub(),
      jobTableContract: getContract({
        client: serverClient,
        address: JOBS_TABLE_ADDRESSES[CYPRESS_CHAIN_SLUG],
        abi: JobTableABI as any,
        chain: CYPRESS_CHAIN_V5,
      }),
      edit: false,
    }
    cy.mountNextRouter('/')
  })

  it('Renders the component', () => {
    cy.mount(
      <TestnetProviders>
        <TeamJobModal {...props} />
      </TestnetProviders>
    )
    cy.get('h2').contains('Add a Job')
    cy.get('#job-expiration-status').should(
      'have.text',
      `*This job post will end on ${new Date(job.endTime * 1000).toLocaleDateString()}`
    )
  })

  it('Displays error when fields are empty', () => {
    cy.mount(
      <TestnetProviders>
        <TeamJobModal {...props} />
        <Toaster />
      </TestnetProviders>
    )

    cy.get('form').submit()
    cy.contains('Please fill out all fields', { timeout: 5000 }).should('exist')
  })
})
