import { usePrivy, useWallets } from '@privy-io/react-auth'
import { ethers } from 'ethers'
import { signIn, signOut } from 'next-auth/react'
import { useContext, useEffect, useState } from 'react'
import { Chain, defineChain } from 'thirdweb'
import { ethers5Adapter } from 'thirdweb/adapters/ethers5'
import { useSetActiveWallet } from 'thirdweb/react'
import { createWalletAdapter } from 'thirdweb/wallets'
import client from '@/lib/thirdweb/client'
import PrivyWalletContext from './privy-wallet-context'

interface PrivyThirdwebV5ProviderProps {
  selectedChain: Chain
  children: any
}

export function PrivyThirdwebV5Provider({
  selectedChain,
  children,
}: PrivyThirdwebV5ProviderProps) {
  const { selectedWallet } = useContext(PrivyWalletContext)
  const { user, ready, authenticated, getAccessToken } = usePrivy()
  const { wallets } = useWallets()
  const setActiveWallet = useSetActiveWallet()

  useEffect(() => {
    async function setActive() {
      try {
        const wallet = wallets?.[selectedWallet]
        if (!wallet) return
        const privyProvider = await wallet.getEthereumProvider()
        const provider = new ethers.providers.Web3Provider(privyProvider)
        const signer = provider?.getSigner()

        const walletClientType = wallet?.walletClientType
        if (
          walletClientType === 'coinbase_wallet' ||
          walletClientType === 'privy'
        )
          await wallet?.switchChain(selectedChain.id)

        const adaptedAccount = await ethers5Adapter.signer.fromEthers({
          signer,
        })

        const thirdwebWallet = createWalletAdapter({
          adaptedAccount,
          chain: selectedChain,
          client,
          onDisconnect: async () => {},
          switchChain: async (chain: Chain) => {
            await wallet?.switchChain(chain.id)
          },
        })

        await thirdwebWallet.connect({ client })
        setActiveWallet(thirdwebWallet)
      } catch (err: any) {
        console.log(err.message)
      }
    }

    setActive()
  }, [wallets, selectedWallet, selectedChain])

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

  return <>{children}</>
}
