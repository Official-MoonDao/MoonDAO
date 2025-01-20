import { PrivyProvider } from '@privy-io/react-auth'
import { Sepolia } from '@thirdweb-dev/chains'
import { ZERO_ADDRESS } from 'const/config'
import { ethers } from 'ethers'
import { Toaster } from 'react-hot-toast'
import { PrivyThirdwebSDKProvider } from '@/lib/privy/PrivyThirdwebSDKProvider'
import GuestActions from '@/components/subscription/GuestActions'

describe('<GuestActions />', () => {
  let props: any

  beforeEach(() => {
    props = {
      nativeBalance: 0,
      citizenContract: {
        call: cy.stub().resolves(ethers.utils.parseEther('0.1')),
      },
    }

    cy.mountNextRouter('/')
    cy.mount(
      <PrivyProvider appId={process.env.NEXT_PUBLIC_PRIVY_APP_ID as string}>
        <PrivyThirdwebSDKProvider selectedChain={Sepolia}>
          <GuestActions {...props} />
        </PrivyThirdwebSDKProvider>
      </PrivyProvider>
    )
  })

  it('Renders component with fund action if native balance < cost of citizen nft', () => {
    cy.contains('Fund Wallet').should('exist')
  })

  it('Renders component with become citizen action if native balance >= cost of citizen nft              ', () => {
    cy.mount(
      <PrivyProvider appId={process.env.NEXT_PUBLIC_PRIVY_APP_ID as string}>
        <PrivyThirdwebSDKProvider selectedChain={Sepolia}>
          <GuestActions {...props} address={ZERO_ADDRESS} nativeBalance={1} />
          <Toaster />
        </PrivyThirdwebSDKProvider>
      </PrivyProvider>
    )

    cy.contains('Become a Citizen').should('exist')
  })
})
