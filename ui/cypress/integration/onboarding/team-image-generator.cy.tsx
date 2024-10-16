import { PrivyProvider } from '@privy-io/react-auth'
import { Sepolia } from '@thirdweb-dev/chains'
import { PrivyThirdwebSDKProvider } from '@/lib/privy/PrivyThirdwebSDKProvider'
import { ImageGenerator } from '@/components/onboarding/TeamImageGenerator'

describe('<TeamImageGenerator />', () => {
  let props: any

  beforeEach(() => {
    props = {
      currImage: '/Original.png',
      setImage: cy.stub(),
      nextStage: cy.stub(),
      stage: 1,
    }

    cy.mount(
      <PrivyProvider appId={process.env.NEXT_PUBLIC_PRIVY_APP_ID as string}>
        <PrivyThirdwebSDKProvider selectedChain={Sepolia}>
          <ImageGenerator {...props} />
        </PrivyThirdwebSDKProvider>
      </PrivyProvider>
    )
  })

  it('Renders the component', () => {
    cy.get('input[type="file"]').should('exist')
  })

  it('Displays the current image if provided', () => {
    cy.get('#teamPic').should('exist')
    cy.get('img').should('have.attr', 'src', props.currImage)
  })

  it('Displays the uploaded image if provided', () => {
    cy.get('input[type="file"]').attachFile('images/Original.png')
    cy.get('#user-image')
      .should('have.css', 'background-image')
      .and('include', 'blob:')
  })

  it('Calls nextStage when the button is clicked', () => {
    cy.get('input[type="file"]').attachFile('images/Original.png')
    cy.contains('Next').should('exist').click()
    cy.wrap(props.nextStage).should('have.been.called')
  })
})
