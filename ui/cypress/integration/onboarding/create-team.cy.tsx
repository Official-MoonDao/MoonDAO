import { PrivyProvider } from '@privy-io/react-auth'
import { Sepolia } from '@thirdweb-dev/chains'
import { PrivyThirdwebSDKProvider } from '@/lib/privy/PrivyThirdwebSDKProvider'
import CreateTeam from '@/components/onboarding/CreateTeam'

describe('<CreateTeam />', () => {
  let props: any

  beforeEach(() => {
    props = {
      address: '0x1234567890abcdef',
      selectedChain: { slug: 'ethereum' },
      setSelectedTier: cy.stub(),
    }
    cy.mountNextRouter('/')
    cy.mount(
      <PrivyProvider appId={process.env.NEXT_PUBLIC_PRIVY_APP_ID as string}>
        <PrivyThirdwebSDKProvider selectedChain={Sepolia}>
          <CreateTeam {...props} />
        </PrivyThirdwebSDKProvider>
      </PrivyProvider>
    )
  })

  it('Should render the component', () => {
    cy.get('h1').contains('Join The Network').should('exist')
  })

  it('Should complete team onboarding flow', () => {
    //DESIGN
    cy.contains(
      'Design your unique onchain registration by uploading your logo or image. For best results, use an image with a white or transparent background.'
    ).should('exist')
    // Simulate image upload
    cy.get('input[type="file"]').attachFile('images/Original.png')
    cy.contains('Next').click()

    //TYPEFORM
    cy.contains('Please complete your team profile.').should('exist')
    cy.get('iframe').should('exist')
    cy.get('iframe').should('have.attr', 'src').should('include', 'typeform')
    cy.contains('NEXT').click()

    //MINT
    cy.get('#team-checkout-button').should('be.disabled')

    cy.get('input[type="checkbox"]').check()
    cy.get('input[type="checkbox"]').should('be.checked')

    cy.get('#team-checkout-button').should('not.be.disabled')
  })
})
