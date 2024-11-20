import { PrivyProvider } from '@privy-io/react-auth'
import { Sepolia } from '@thirdweb-dev/chains'
import { Toaster } from 'react-hot-toast'
import { PrivyThirdwebSDKProvider } from '@/lib/privy/PrivyThirdwebSDKProvider'
import { daysFromNowTimestamp } from '@/lib/utils/timestamp'
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
      jobTableContract: { call: cy.stub().resolves() },
      edit: false,
    }
  })

  it('Renders the component', () => {
    cy.mount(
      <PrivyProvider appId={process.env.NEXT_PUBLIC_PRIVY_APP_ID as string}>
        <PrivyThirdwebSDKProvider selectedChain={Sepolia}>
          <TeamJobModal {...props} />
        </PrivyThirdwebSDKProvider>
      </PrivyProvider>
    )
    cy.get('h2').contains('Add a Job')
    cy.get('#job-expiration-status').should(
      'have.text',
      `*This job post will end on ${new Date(
        job.endTime * 1000
      ).toLocaleDateString()}`
    )
  })

  it('Displays error when fields are empty', () => {
    cy.mount(
      <PrivyProvider appId={process.env.NEXT_PUBLIC_PRIVY_APP_ID as string}>
        <PrivyThirdwebSDKProvider selectedChain={Sepolia}>
          <TeamJobModal {...props} />
          <Toaster />
        </PrivyThirdwebSDKProvider>
      </PrivyProvider>
    )

    cy.get('button').contains('Add Job').click()
    cy.get('div').should('contain', 'Please fill out all fields')
  })

  it('Submits form with valid data', () => {
    cy.mount(
      <PrivyProvider appId={process.env.NEXT_PUBLIC_PRIVY_APP_ID as string}>
        <PrivyThirdwebSDKProvider selectedChain={Sepolia}>
          <TeamJobModal {...props} />
        </PrivyThirdwebSDKProvider>
      </PrivyProvider>
    )

    cy.get('#job-title-input').type('Test Job Title')
    cy.get('#job-description-input').type('Test Job Description')
    cy.get('#job-application-link-input').type('contact@example.com')

    const endTime = daysFromNowTimestamp(2)
    const endTimeDate = new Date(endTime * 1000).toISOString().split('T')[0]
    cy.get('#job-end-time-input').type(endTimeDate)

    cy.get('form').submit()

    cy.wrap(props.jobTableContract.call).should('have.been.called')
  })

  it('Displays expiration status if job is expired', () => {
    const endTime = daysFromNowTimestamp(-1)

    cy.mount(
      <PrivyProvider appId={process.env.NEXT_PUBLIC_PRIVY_APP_ID as string}>
        <PrivyThirdwebSDKProvider selectedChain={Sepolia}>
          <TeamJobModal {...props} job={{ ...job, endTime }} />
        </PrivyThirdwebSDKProvider>
      </PrivyProvider>
    )

    cy.get('#job-expiration-status').should(
      'have.text',
      `*This job post expired on ${new Date(
        endTime * 1000
      ).toLocaleDateString()}`
    )
  })
})
