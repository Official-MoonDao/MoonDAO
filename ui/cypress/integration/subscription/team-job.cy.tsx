import TestnetProviders from '@/cypress/mock/TestnetProviders'
import { CYPRESS_CHAIN_SLUG, CYPRESS_CHAIN_V5 } from '@/cypress/mock/config'
import JobTableABI from 'const/abis/JobBoardTable.json'
import { JOBS_TABLE_ADDRESSES } from 'const/config'
import { getContract } from 'thirdweb'
import { serverClient } from '@/lib/thirdweb/client'
import { daysFromNowTimestamp } from '@/lib/utils/timestamp'
import Job, { Job as JobType } from '@/components/jobs/Job'

describe('<Job />', () => {
  let job: JobType
  let props: any

  before(() => {
    cy.fixture('jobs/job.json').then((j) => {
      job = j
    })
  })

  beforeEach(() => {
    props = {
      job,
      jobTableContract: getContract({
        client: serverClient,
        address: JOBS_TABLE_ADDRESSES[CYPRESS_CHAIN_SLUG],
        abi: JobTableABI as any,
        chain: CYPRESS_CHAIN_V5,
      }),
      refreshJobs: cy.stub(),
      editable: false,
      teamContract: null,
      showTeam: false,
    }

    cy.mountNextRouter('/')
  })

  it('Renders the component', () => {
    const timestamp = daysFromNowTimestamp(0)

    cy.mount(
      <TestnetProviders>
        <Job {...props} job={{ ...job, timestamp }} />
      </TestnetProviders>
    )

    cy.contains(job.title).should('be.visible')
    cy.contains(job.description).should('be.visible')

    cy.window().then((win) => {
      cy.spy(win, 'open').as('windowOpen')
    })
    cy.contains('Apply').click()
    cy.get('@windowOpen').should('have.been.calledWith', job.contactInfo)

    cy.contains('Posted today').should('be.visible')
  })

  it('Shows edit and delete buttons when editable', () => {
    cy.mount(
      <TestnetProviders>
        <Job {...props} editable />
      </TestnetProviders>
    )

    cy.get('#edit-job-button').should('exist')
    cy.get('#delete-job-button').should('exist')
  })

  it('Deletes the job', () => {
    cy.mount(
      <TestnetProviders>
        <Job {...props} editable />
      </TestnetProviders>
    )

    cy.get('#delete-job-button').click()
  })

  it("Hides the job if it's expired", () => {
    const endTime = daysFromNowTimestamp(-1)
    cy.mount(
      <TestnetProviders>
        <Job {...props} job={{ ...job, endTime }} />
      </TestnetProviders>
    )

    cy.contains(job.title).should('not.exist')
  })

  it("Shows 'expired' message if the job is expired and editable", () => {
    const endTime = daysFromNowTimestamp(-1)
    cy.mount(
      <TestnetProviders>
        <Job {...props} job={{ ...job, endTime }} editable />
      </TestnetProviders>
    )

    cy.contains('This job post has expired').should('be.visible')
  })
})
