import { usePrivy, useWallets } from '@privy-io/react-auth'
import { signIn, signOut } from 'next-auth/react'
import { useContext, useEffect, useRef, useState } from 'react'
import { defineChain } from 'thirdweb'
import { ethers5Adapter } from 'thirdweb/adapters/ethers5'
import {
  useActiveWallet,
  useDisconnect,
  useSetActiveWallet,
} from 'thirdweb/react'
import { createWalletAdapter } from 'thirdweb/wallets'
import { chainForDeprizePath } from '@/lib/deprize/route-chain'
import { withClientFeeOverrides } from '@/lib/rpc/eip1559Fees'
import client from '@/lib/thirdweb/client'
import { getWalletEthersProvider } from './getWalletEthersProvider'
import PrivyWalletContext from './privy-wallet-context'

export function PrivyThirdwebV5Provider({ selectedChain, children }: any) {
  const { user, ready, authenticated, getAccessToken } = usePrivy()
  const { selectedWallet } = useContext(PrivyWalletContext)
  const { wallets, ready: walletsReady } = useWallets()
  const setActiveWallet = useSetActiveWallet()
  const activeWallet = useActiveWallet()
  const { disconnect: disconnectThirdwebWallet } = useDisconnect()
  const [isSigningIn, setIsSigningIn] = useState(false)
  const wasAuthenticated = useRef(false)
  const clearedStaleSession = useRef(false)

  useEffect(() => {
    async function setActive() {
      // The selected index can be empty while Privy is still connecting the
      // embedded wallet. Prefer that wallet once it appears so thirdweb does
      // not stay on a missing slot and leave useActiveAccount() null.
      const wallet =
        wallets[selectedWallet] ??
        wallets.find((candidate) => candidate.walletClientType === 'privy') ??
        wallets[0]
      if (!wallet) {
        return
      }

      try {

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

          // A /deprize/sep URL pins reads to Sepolia. Switching the wallet to
          // match reloads the page, and the next load switches again.
          const routePinnedChain =
            typeof window !== 'undefined' &&
            chainForDeprizePath(window.location.pathname)
          const shouldSwitchChain =
            isAutoSwitchWallet &&
            isTabVisible &&
            !routePinnedChain &&
            currentWalletChainId !== null &&
            currentWalletChainId !== selectedChain.id

          if (shouldSwitchChain) {
            await wallet?.switchChain(selectedChain.id)
          }
        } catch (switchError: any) {
          console.warn('Chain switch failed:', switchError.message)
        }

        // Get provider and signer AFTER chain switch.
        const provider = await getWalletEthersProvider(wallet)
        const signer = provider?.getSigner()

        const adaptedAccount = await ethers5Adapter.signer.fromEthers({
          signer,
        })

        // Privy / wallet RPCs often populate inflated maxFeePerGas. Nodes then
        // reject with "insufficient funds for gas * price + value" even when
        // the signer has enough ETH for the real L2 fee. Stamp our gas-price
        // API values (2.4× base + priority) onto every send from this adapter.
        const originalSendTransaction = adaptedAccount.sendTransaction.bind(
          adaptedAccount
        )
        adaptedAccount.sendTransaction = async (tx) => {
          const decorated = await withClientFeeOverrides(
            tx as Record<string, unknown>,
            selectedChain.id
          )
          return originalSendTransaction(decorated as typeof tx)
        }

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
        // This catch is the source of a particularly nasty class
        // of bugs: when adapter setup throws (provider not ready,
        // signer init failed, ethers5Adapter rejected, etc.) the
        // app continues happily — Privy still reports the wallet
        // connected, balances/VP still render — but
        // `useActiveAccount()` stays null. Downstream tx flows
        // then fail with generic "could not submit" toasts.
        // Surface it as a real error so it actually shows up in
        // Sentry / browser consoles, with enough breadcrumbs to
        // tell which wallet failed.
        console.error(
          '[PrivyThirdwebV5Provider] Failed to set active Thirdweb v5 wallet — useActiveAccount() will be null until the user reconnects.',
          {
            walletClientType: wallet?.walletClientType,
            address: wallet?.address,
            chainId: wallet?.chainId,
            selectedChainId: selectedChain?.id,
            walletsReady,
            message: err?.message,
            error: err,
          }
        )
        return
      }
    }

    setActive()
  }, [user, wallets, walletsReady, selectedWallet, selectedChain])

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
    if (!ready) return

    if (authenticated) {
      wasAuthenticated.current = true
      return
    }

    // Clear a leftover NextAuth session once Privy is ready and signed out.
    // Disconnect thirdweb only after a real logout. Doing it whenever
    // `authenticated` is still false drops the wallet that setActive() just
    // attached, while Privy's own user is already signed in.
    if (!clearedStaleSession.current || wasAuthenticated.current) {
      clearedStaleSession.current = true
      signOut({ redirect: false })
    }

    if (wasAuthenticated.current) {
      wasAuthenticated.current = false
      if (activeWallet) {
        try {
          disconnectThirdwebWallet(activeWallet)
        } catch (err) {
          console.warn('Failed to disconnect thirdweb wallet on logout:', err)
        }
      }
    }
  }, [ready, authenticated, activeWallet, disconnectThirdwebWallet])

  return <>{children}</>
}
