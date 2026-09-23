import { useWallets } from '@privy-io/react-auth'
import { useCallback, useContext, useMemo, useState } from 'react'
import toast from 'react-hot-toast'
import type { Chain } from 'thirdweb'
import { isWrongNetwork, parseWalletChainId } from '@/lib/deprize/chain-guard'
import toastStyle from '@/lib/marketplace/marketplace-utils/toastConfig'
import PrivyWalletContext from '@/lib/privy/privy-wallet-context'
import { addNetworkToWallet } from '@/lib/thirdweb/addNetworkToWallet'

/**
 * Every DePrize write is built from the app's selected chain but signed by
 * whatever network the wallet is on. When those disagree the nonce is read from
 * the wrong chain and the receiving RPC rejects it as `nonce too high`, which
 * reads as a wallet bug. Guard the action instead, and offer the switch.
 */
export function useDePrizeChainGuard(chain?: Chain) {
  const { selectedWallet } = useContext(PrivyWalletContext)
  const { wallets } = useWallets()
  const [switching, setSwitching] = useState(false)

  const walletChainId = useMemo(
    () => parseWalletChainId(wallets?.[selectedWallet]?.chainId),
    [wallets, selectedWallet]
  )

  const wrongNetwork =
    process.env.NEXT_PUBLIC_TEST_ENV !== 'true' && isWrongNetwork(walletChainId, chain?.id)
  const chainLabel = (chain?.name ?? 'the network').replace(' One', '')

  const switchToChain = useCallback(async () => {
    const wallet = wallets?.[selectedWallet]
    if (!wallet || typeof wallet.switchChain !== 'function' || !chain) return
    setSwitching(true)
    try {
      await wallet.switchChain(chain.id)
    } catch (err: any) {
      if (err?.code === 4902 || err?.message?.includes('Unrecognized chain')) {
        const added = await addNetworkToWallet(chain as any)
        if (added) {
          try {
            await wallet.switchChain(chain.id)
          } catch {
            /* user rejected */
          }
        }
      } else if (err?.code !== 4001) {
        toast.error('Failed to switch network. Please try again.', { style: toastStyle })
      }
    } finally {
      setSwitching(false)
    }
  }, [wallets, selectedWallet, chain])

  /** Guard for use inside an action handler; toasts and returns true if blocked. */
  const blockedByNetwork = useCallback(() => {
    if (!wrongNetwork) return false
    toast.error(`Switch your wallet to ${chainLabel} to continue.`, { style: toastStyle })
    return true
  }, [wrongNetwork, chainLabel])

  return { wrongNetwork, chainLabel, switching, switchToChain, blockedByNetwork }
}
