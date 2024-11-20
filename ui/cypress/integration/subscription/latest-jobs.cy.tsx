import { PrivyProvider } from '@privy-io/react-auth'
import { Sepolia } from '@thirdweb-dev/chains'
import { TABLELAND_ENDPOINT, ZERO_ADDRESS } from 'const/config'
import { PrivyThirdwebSDKProvider } from '@/lib/privy/PrivyThirdwebSDKProvider'
import { Job } from '@/components/jobs/Job'
import LatestJobs from '@/components/subscription/LatestJobs'

describe('<LatestJobs />', () => {
  let props: any
  let job: Job

  before(() => {
    cy.fixture('jobs/job').then((j) => {
      job = j
    })
  })

  beforeEach(() => {
    props = {
      teamContract: {
        call: cy.stub().callsFake((method, args) => {
          if (method === 'expiresAt') {
            return Promise.resolve({
              toNumber: () => 1234567890,
            })
          }
          return Promise.resolve('TestTeamTable')
        }),
        getAddress: cy.stub().resolves(ZERO_ADDRESS),
      },
      jobTableContract: {
        call: cy.stub().resolves(1234567890),
        getAddress: cy.stub().resolves(ZERO_ADDRESS),
      },
    }

    cy.intercept('GET', `${TABLELAND_ENDPOINT}?statement=*`, {
      statusCode: 200,
      body: [job, job],
    }).as('getLatestJobs')

    cy.mountNextRouter('/')
    cy.mount(
      <PrivyProvider appId={process.env.NEXT_PUBLIC_PRIVY_APP_ID as string}>
        <PrivyThirdwebSDKProvider selectedChain={Sepolia}>
          <LatestJobs {...props} />
        </PrivyThirdwebSDKProvider>
      </PrivyProvider>
    )
  })

  it('Renders the component and jobs', () => {
    cy.wait('@getLatestJobs')

    cy.get('.header').contains('Latest Jobs')
    cy.get('#latest-jobs-container').children().should('have.length', 2)
  })
})
