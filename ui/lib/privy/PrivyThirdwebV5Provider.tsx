import { usePrivy, useWallets } from '@privy-io/react-auth'
import { signIn, signOut } from 'next-auth/react'
import { useContext, useEffect, useState } from 'react'
import { defineChain } from 'thirdweb'
import { ethers5Adapter } from 'thirdweb/adapters/ethers5'
import { useSetActiveWallet } from 'thirdweb/react'
import { createWalletAdapter } from 'thirdweb/wallets'
import client from '@/lib/thirdweb/client'
import PrivyWalletContext from './privy-wallet-context'

export function PrivyThirdwebV5Provider({ selectedChain, children }: any) {
  const { user, ready, authenticated, getAccessToken } = usePrivy()
  const { selectedWallet } = useContext(PrivyWalletContext)
  const { wallets } = useWallets()
  const setActiveWallet = useSetActiveWallet()

  useEffect(() => {
    async function setActive() {
      try {
        const wallet = wallets[selectedWallet]
        const provider = await wallet?.getEthersProvider()
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
          chain: defineChain(selectedChain.id),
          client,
          onDisconnect: () => {},
          switchChain: () => {},
        })

        await thirdwebWallet.connect({ client })
        setActiveWallet(thirdwebWallet)
        console.log('Set Active Wallet')
      } catch (err: any) {
        console.log(err.message)
      }
    }

    setActive()
  }, [user, selectedWallet, selectedChain])

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
