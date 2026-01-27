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
  const [isSigningIn, setIsSigningIn] = useState(false)

  useEffect(() => {
    async function setActive() {
      try {
        const wallet = wallets[selectedWallet]
        if (!wallet) {
          // If no wallet is selected, we don't need to set an active wallet
          return
        }

        try {
          const walletClientType = wallet?.walletClientType
          // Only switch chain if:
          // 1. Wallet is not already on the target chain (prevents single-tab race condition)
          // 2. Wallet is an auto-switch type (Coinbase/Privy embedded wallets)
          // 3. This tab is visible (prevents multi-tab race condition where background tabs fight over the wallet chain)
          const currentWalletChainId = wallet?.chainId
            ? +wallet.chainId.split(':')[1]
            : null
          const isAutoSwitchWallet =
            walletClientType === 'coinbase_wallet' ||
            walletClientType === 'privy'
          const isTabVisible =
            typeof document === 'undefined' ||
            document.visibilityState === 'visible'

          const shouldSwitchChain =
            isAutoSwitchWallet &&
            isTabVisible &&
            currentWalletChainId !== null &&
            currentWalletChainId !== selectedChain.id

          if (shouldSwitchChain) {
            await wallet?.switchChain(selectedChain.id)
          }
        } catch (switchError: any) {
          console.warn('Chain switch failed:', switchError.message)
        }

        // Get provider and signer AFTER chain switch
        const provider = await wallet?.getEthersProvider()
        const signer = provider?.getSigner()

        const adaptedAccount = await ethers5Adapter.signer.fromEthers({
          signer,
        })

        const thirdwebWallet = createWalletAdapter({
          adaptedAccount,
          chain: defineChain(selectedChain.id),
          client,
          onDisconnect: () => {
            // When disconnected, we don't need to set an active wallet
            return
          },
          switchChain: () => {},
        })

        await thirdwebWallet.connect({ client })
        setActiveWallet(thirdwebWallet)
      } catch (err: any) {
        console.log(err.message)
        // On error, we don't need to set an active wallet
        return
      }
    }

    setActive()
  }, [user, wallets, selectedWallet, selectedChain])

  useEffect(() => {
    async function handleAuth() {
      if (ready && authenticated && user && !isSigningIn) {
        try {
          setIsSigningIn(true)
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
        } finally {
          setIsSigningIn(false)
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
