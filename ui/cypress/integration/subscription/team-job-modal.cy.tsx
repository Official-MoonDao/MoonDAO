import TestnetProviders from '@/cypress/mock/TestnetProviders'
import { CYPRESS_CHAIN_SLUG, CYPRESS_CHAIN_V5 } from '@/cypress/mock/config'
import JobTableABI from 'const/abis/JobBoardTable.json'
import { JOBS_TABLE_ADDRESSES } from 'const/config'
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
      teamId: '0',
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
    cy.get('[data-testid="modal-title"]').should('contain', 'Create Job')
    cy.get('#job-expiration-status').should(
      'have.text',
      `*This job post will end on ${new Date(job.endTime * 1000).toLocaleDateString()}`
    )
  })

  it('Shows disabled styling when required fields are empty', () => {
    cy.mount(
      <TestnetProviders>
        <TeamJobModal {...props} />
      </TestnetProviders>
    )

    cy.get('#job-title-input').should('have.value', '')
    cy.get('#job-application-link-input').should('have.value', '')
    cy.get('button[type="submit"]').should('have.class', 'opacity-50')
  })

  it('Removes disabled styling when required fields are filled', () => {
    cy.mount(
      <TestnetProviders>
        <TeamJobModal {...props} />
      </TestnetProviders>
    )

    cy.get('#job-title-input').type('Test Job')
    cy.get('#job-description-input').type('A test description')
    cy.get('#job-application-link-input').type('https://example.com')
    cy.get('button[type="submit"]').should('not.have.class', 'opacity-50')
  })
})
