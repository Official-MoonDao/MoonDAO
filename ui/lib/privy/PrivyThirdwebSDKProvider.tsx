import { usePrivy, useWallets } from '@privy-io/react-auth'
import { Ethereum, Goerli, Mumbai, Polygon } from '@thirdweb-dev/chains'
import { ThirdwebSDKProvider } from '@thirdweb-dev/react'
import { signIn, signOut } from 'next-auth/react'
import { useEffect, useState } from 'react'
import PrivyWalletContext from './privy-wallet-context'

export function PrivyThirdwebSDKProvider({ selectedChain, children }: any) {
  const [selectedWallet, setSelectedWallet] = useState<number>(0)
  const [signer, setSigner] = useState<any>(null)

  const { wallets } = useWallets()

  const { user, ready, authenticated, getAccessToken } = usePrivy()

  useEffect(() => {
    async function getPrivySigner() {
      try {
        const wallet = wallets[selectedWallet]
        const provider = await wallet?.getEthersProvider()
        const walletClientType = wallet.walletClientType
        if (
          walletClientType === 'coinbase_wallet' ||
          walletClientType === 'privy'
        )
          await wallet?.switchChain(selectedChain.chainId)
        setSigner(provider?.getSigner())
      } catch (err: any) {
        console.log(err.message)
      }
    }

    if (user) getPrivySigner()
    else setSigner(null)
  }, [wallets, user, selectedWallet, selectedChain])

  useEffect(() => {
    async function handleAuth() {
      if (ready && authenticated && user) {
        try {
          // Sign in to NextAuth with the Privy token
          const accessToken = await getAccessToken()
          const result = await signIn('credentials', {
            accessToken: accessToken,
            redirect: false, // Prevent automatic redirect
          })

          if (result?.error) {
            console.error('NextAuth sign in failed:', result.error)
          }
        } catch (error) {
          console.error('Auth error:', error)
        }
      }
    }

    handleAuth()
  }, [ready, authenticated, user, getAccessToken])

  useEffect(() => {
    if (ready && !authenticated) {
      signOut({ redirect: false })
    }
  }, [ready, authenticated, user])

  return (
    <PrivyWalletContext.Provider value={{ selectedWallet, setSelectedWallet }}>
      <ThirdwebSDKProvider
        clientId={process.env.NEXT_PUBLIC_THIRDWEB_CLIENT_ID}
        activeChain={selectedChain}
        supportedChains={[Ethereum, Polygon, Goerli, Mumbai]}
        signer={signer}
      >
        {children}
      </ThirdwebSDKProvider>
    </PrivyWalletContext.Provider>
  )
}
