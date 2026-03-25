import { useWallets } from '@privy-io/react-auth'
import { useContext, useMemo } from 'react'
import toast from 'react-hot-toast'
import PrivyWalletContext from '@/lib/privy/privy-wallet-context'
import type { Chain } from '@/lib/rpc/chains'
import toastStyle from '@/lib/marketplace/marketplace-utils/toastConfig'
import { addNetworkToWallet } from '@/lib/thirdweb/addNetworkToWallet'
import ChainContextV5 from '@/lib/thirdweb/chain-context-v5'
import StandardButton from '@/components/layout/StandardButton'

type MissionFundingChainBannerProps = {
  enabled: boolean
  chains: Chain[]
  fundingPickReady: boolean
  recommendedChain: Chain | null
}

/**
 * Default funding network stays Arbitrum; when another chain has more ETH, suggest switching.
 * If the user already chose a network in the selector but the wallet is elsewhere, prompt a wallet switch.
 */
export default function MissionFundingChainBanner({
  enabled,
  chains,
  fundingPickReady,
  recommendedChain,
}: MissionFundingChainBannerProps) {
  const { selectedChain, setSelectedChain } = useContext(ChainContextV5)
  const { selectedWallet } = useContext(PrivyWalletContext)
  const { wallets } = useWallets()

  const walletChainId = useMemo(() => {
    const w = wallets?.[selectedWallet]
    if (!w?.chainId) return null
    const id = +w.chainId.split(':')[1]
    return Number.isFinite(id) ? id : null
  }, [wallets, selectedWallet])

  const isKnownFundingChain = chains.some((c) => c.id === selectedChain.id)

  if (process.env.NEXT_PUBLIC_TEST_ENV === 'true') {
    return null
  }

  if (!enabled || !fundingPickReady) {
    return null
  }

  if (!isKnownFundingChain) {
    return null
  }

  const wallet = wallets?.[selectedWallet]

  const suggestBalanceChain =
    recommendedChain &&
    recommendedChain.id !== selectedChain.id &&
    chains.some((c) => c.id === recommendedChain.id)

  const suggestWalletSwitch =
    walletChainId !== null &&
    walletChainId !== selectedChain.id &&
    !suggestBalanceChain

  if (!suggestBalanceChain && !suggestWalletSwitch) {
    return null
  }

  const targetChain = suggestBalanceChain ? recommendedChain! : selectedChain
  const targetName = (targetChain.name ?? 'the network').replace(' One', '')

  async function switchWalletTo(chain: Chain) {
    if (!wallet || typeof wallet.switchChain !== 'function') return
    try {
      await wallet.switchChain(chain.id)
    } catch (err: any) {
      if (err?.code === 4902 || err?.message?.includes('Unrecognized chain')) {
        const ok = await addNetworkToWallet(chain)
        if (ok) {
          try {
            await wallet.switchChain(chain.id)
          } catch {
            /* user rejected */
          }
        }
      } else if (err?.code !== 4001) {
        toast.error('Failed to switch network. Please try again.', {
          style: toastStyle,
        })
      }
    }
  }

  return (
    <div className="mb-4 rounded-xl border border-cyan-500/35 bg-gradient-to-r from-cyan-950/50 to-slate-900/60 px-4 py-3.5">
      {suggestBalanceChain ? (
        <>
          <p className="text-sm text-gray-200 leading-relaxed">
            You hold more ETH on <span className="font-semibold text-cyan-200">{targetName}</span>{' '}
            than on{' '}
            <span className="font-medium text-gray-100">
              {(selectedChain.name ?? 'your current selection').replace(' One', '')}
            </span>
            . Switch below if you want to pay from {targetName}, or change the network in the
            selector.
          </p>
          <StandardButton
            className="mt-3 gradient-2 rounded-full text-sm px-5 py-2.5"
            onClick={async () => {
              setSelectedChain(recommendedChain!)
              await switchWalletTo(recommendedChain!)
            }}
          >
            {`Pay from ${targetName}`}
          </StandardButton>
        </>
      ) : (
        <>
          <p className="text-sm text-gray-200 leading-relaxed">
            Your wallet is not on {(selectedChain.name ?? 'the selected network').replace(' One', '')}.
            Switch your wallet to match the network you chose above.
          </p>
          <StandardButton
            className="mt-3 gradient-2 rounded-full text-sm px-5 py-2.5"
            onClick={() => switchWalletTo(selectedChain)}
          >
            {`Switch wallet to ${(selectedChain.name ?? 'network').replace(' One', '')}`}
          </StandardButton>
        </>
      )}
    </div>
  )
}
