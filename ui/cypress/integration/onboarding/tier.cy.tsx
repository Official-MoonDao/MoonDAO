import { PrivyProvider } from '@privy-io/react-auth'
import { Sepolia } from '@thirdweb-dev/chains'
import { PrivyThirdwebSDKProvider } from '@/lib/privy/PrivyThirdwebSDKProvider'
import Tier from '@/components/onboarding/Tier'

describe('<Tier />', () => {
  let props: any

  beforeEach(() => {
    props = {
      label: 'Test Label',
      description: 'Test Description',
      points: ['Point 1: Description 1', 'Point 2: Description 2'],
      price: 1.5,
      onClick: cy.stub(),
      buttoncta: 'Click Me',
      type: 'team',
      compact: false,
      hasCitizen: false, // Ensure hasCitizen is false
    }

    cy.mount(
      <PrivyProvider appId={process.env.NEXT_PUBLIC_PRIVY_APP_ID as string}>
        <PrivyThirdwebSDKProvider selectedChain={Sepolia}>
          <Tier {...props} />
        </PrivyThirdwebSDKProvider>
      </PrivyProvider>
    )
  })

  it('Renders the component with default props', () => {
    cy.get('h2').contains(props.label)
    cy.get('p').contains(props.description)
    cy.get('button').contains(props.buttoncta)
  })

  it('Displays points correctly', () => {
    props.points.forEach((point: string) => {
      const [title, description] = point.split(': ')
      cy.get('p').contains(title)
      cy.get('p').contains(description)
    })
  })

  it('Displays price correctly', () => {
    cy.get('p').contains(`${props.price} ETH`)
  })

  it('Renders compact view correctly', () => {
    cy.mount(
      <PrivyProvider appId={process.env.NEXT_PUBLIC_PRIVY_APP_ID as string}>
        <PrivyThirdwebSDKProvider selectedChain={Sepolia}>
          <Tier {...props} compact={true} />
        </PrivyThirdwebSDKProvider>
      </PrivyProvider>
    )
    cy.get('button').should('exist')
  })
})
