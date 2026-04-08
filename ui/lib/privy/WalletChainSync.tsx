'use client'

import { useWallets } from '@privy-io/react-auth'
import { useContext, useEffect, useRef } from 'react'
import PrivyWalletContext from '@/lib/privy/privy-wallet-context'
import ChainContextV5 from '@/lib/thirdweb/chain-context-v5'
import { getChainById } from '@/lib/thirdweb/chain'

/**
 * Keeps app `selectedChain` aligned with the wallet when the user **changes** network in their
 * wallet (MetaMask, etc.). Does not run on first wallet observation — avoids rewriting the header
 * chain on every app load; mission pay flow aligns to RPC-richest only when opening contribute.
 *
 * Does not run when only the in-app dropdown changes while the wallet chain stays the same.
 */
export function WalletChainSync() {
  const { selectedChain, setSelectedChain } = useContext(ChainContextV5)
  const { selectedWallet } = useContext(PrivyWalletContext)
  const { wallets } = useWallets()
  const prevWalletChainIdRef = useRef<number | null>(null)

  const wallet = wallets?.[selectedWallet]
  const walletChainIdStr = wallet?.chainId

  useEffect(() => {
    if (process.env.NEXT_PUBLIC_TEST_ENV === 'true') return

    if (!walletChainIdStr) {
      prevWalletChainIdRef.current = null
      return
    }

    const id = +walletChainIdStr.split(':')[1]
    if (!Number.isFinite(id)) return

    const chain = getChainById(id)
    if (!chain) {
      prevWalletChainIdRef.current = id
      return
    }

    const prev = prevWalletChainIdRef.current
    prevWalletChainIdRef.current = id

    // Record first seen chain id only — do not sync app on initial load / first connect.
    if (prev === null) return

    if (prev === id) return

    if (selectedChain.id !== id) {
      setSelectedChain(chain)
    }
  }, [walletChainIdStr, selectedWallet, setSelectedChain, selectedChain.id])

  return null
}
