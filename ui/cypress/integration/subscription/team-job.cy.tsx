import { PrivyProvider } from '@privy-io/react-auth'
import { Sepolia } from '@thirdweb-dev/chains'
import { PrivyThirdwebSDKProvider } from '@/lib/privy/PrivyThirdwebSDKProvider'
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
      jobTableContract: { call: cy.stub().resolves() },
      refreshJobs: cy.stub(),
      editable: false,
      teamContract: null,
      showTeam: false,
    }
  })

  it('Renders the component', () => {
    const timestamp = daysFromNowTimestamp(0)

    cy.mount(
      <PrivyProvider appId={process.env.NEXT_PUBLIC_PRIVY_APP_ID as string}>
        <PrivyThirdwebSDKProvider selectedChain={Sepolia}>
          <Job {...props} job={{ ...job, timestamp }} />
        </PrivyThirdwebSDKProvider>
      </PrivyProvider>
    )

    cy.contains(job.title).should('be.visible')
    cy.contains(job.description).should('be.visible')

    cy.window().then((win) => {
      cy.spy(win, 'open').as('windowOpen')
    })
    cy.contains('Apply').click()
    cy.get('@windowOpen').should('have.been.calledWith', job.contactInfo)

    cy.get('#job-posted-status').should(
      'have.text',
      'This job was posted today'
    )
  })

  it('Shows edit and delete buttons when editable', () => {
    cy.mount(
      <PrivyProvider appId={process.env.NEXT_PUBLIC_PRIVY_APP_ID as string}>
        <PrivyThirdwebSDKProvider selectedChain={Sepolia}>
          <Job {...props} editable />
        </PrivyThirdwebSDKProvider>
      </PrivyProvider>
    )

    cy.get('#edit-job-button').should('exist')
    cy.get('#delete-job-button').should('exist')
  })

  it('Deletes the job', () => {
    cy.mount(
      <PrivyProvider appId={process.env.NEXT_PUBLIC_PRIVY_APP_ID as string}>
        <PrivyThirdwebSDKProvider selectedChain={Sepolia}>
          <Job {...props} editable />
        </PrivyThirdwebSDKProvider>
      </PrivyProvider>
    )

    cy.get('#delete-job-button').click()
    cy.wrap(props.jobTableContract.call).should(
      'be.calledWith',
      'deleteFromTable',
      [job.id, job.teamId]
    )
  })

  it("Hides the job if it's expired", () => {
    const endTime = daysFromNowTimestamp(-1)
    cy.mount(
      <PrivyProvider appId={process.env.NEXT_PUBLIC_PRIVY_APP_ID as string}>
        <PrivyThirdwebSDKProvider selectedChain={Sepolia}>
          <Job {...props} job={{ ...job, endTime }} />
        </PrivyThirdwebSDKProvider>
      </PrivyProvider>
    )

    cy.get('#job-container').should('not.exist')
  })

  it("Shows 'expired' message if the job is expired and editable", () => {
    const endTime = daysFromNowTimestamp(-1)
    cy.mount(
      <PrivyProvider appId={process.env.NEXT_PUBLIC_PRIVY_APP_ID as string}>
        <PrivyThirdwebSDKProvider selectedChain={Sepolia}>
          <Job {...props} job={{ ...job, endTime }} editable />
        </PrivyThirdwebSDKProvider>
      </PrivyProvider>
    )

    cy.get('#job-expired-status').should(
      'have.text',
      '*This job post has expired and is no longer available.'
    )
  })
})
