import { useWallets } from '@privy-io/react-auth'
import { useContext, useMemo } from 'react'
import toast from 'react-hot-toast'
import PrivyWalletContext from '@/lib/privy/privy-wallet-context'
import type { Chain } from '@/lib/rpc/chains'
import toastStyle from '@/lib/marketplace/marketplace-utils/toastConfig'
import { addNetworkToWallet } from '@/lib/thirdweb/addNetworkToWallet'
import { getChainById } from '@/lib/thirdweb/chain'
import ChainContextV5 from '@/lib/thirdweb/chain-context-v5'
import StandardButton from '@/components/layout/StandardButton'
import type { FundingChainBalanceEntry } from '@/lib/mission/useMissionDefaultFundingChain'

type MissionFundingChainBannerProps = {
  enabled: boolean
  chains: Chain[]
  fundingPickReady: boolean
  recommendedChain: Chain | null
  /** Per-chain wei from the same fetch as `recommendedChain`; used to avoid nudging when all balances are zero. */
  fundingChainBalances: FundingChainBalanceEntry[] | null
}

/**
 * Two separate ideas (keep them straight):
 * - **App “selected” network** (`selectedChain`): what the header network dropdown says; used for
 *   contracts, URLs, and what we *intend* to use after the wallet matches.
 * - **Wallet network** (`wallet.chainId`): where the signer actually is; `useNativeBalance` reads this.
 *
 * We suggest switching when the wallet is not on the chain where you hold the most mission funding
 * ETH (per RPC), or when the wallet does not match the app’s selected chain (after that check).
 */
export default function MissionFundingChainBanner({
  enabled,
  chains,
  fundingPickReady,
  recommendedChain,
  fundingChainBalances,
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

  const walletOnFundingList =
    walletChainId !== null && chains.some((c) => c.id === walletChainId)

  const walletBalanceWei =
    fundingPickReady &&
    fundingChainBalances &&
    walletChainId !== null &&
    walletOnFundingList
      ? fundingChainBalances.find((e) => e.chain.id === walletChainId)?.wei ?? BigInt(0)
      : null

  const recommendedWei =
    fundingPickReady && fundingChainBalances && recommendedChain
      ? fundingChainBalances.find((e) => e.chain.id === recommendedChain.id)?.wei ?? BigInt(0)
      : null

  const strictlyMoreOnRecommended =
    recommendedWei != null &&
    recommendedWei > BigInt(0) &&
    (walletBalanceWei == null ? true : recommendedWei > walletBalanceWei)

  const suggestSwitchToRichestChain =
    recommendedChain != null &&
    walletChainId !== null &&
    recommendedChain.id !== walletChainId &&
    chains.some((c) => c.id === recommendedChain.id) &&
    strictlyMoreOnRecommended

  const suggestWalletMatchAppSelection =
    walletChainId !== null &&
    walletChainId !== selectedChain.id &&
    !suggestSwitchToRichestChain

  if (!suggestSwitchToRichestChain && !suggestWalletMatchAppSelection) {
    return null
  }

  const walletChainMeta =
    walletChainId != null ? getChainById(walletChainId) : undefined
  const walletNetworkLabel = (
    walletChainMeta?.name ??
    (walletChainId != null ? `Chain ${walletChainId}` : 'your wallet')
  ).replace(' One', '')

  const targetChain = suggestSwitchToRichestChain ? recommendedChain! : selectedChain
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
      {suggestSwitchToRichestChain ? (
        <>
          <p className="text-sm text-gray-200 leading-relaxed">
            You hold the most mission funding ETH on{' '}
            <span className="font-semibold text-cyan-200">{targetName}</span>
            {walletOnFundingList ? (
              <>
                , but your wallet is on{' '}
                <span className="font-medium text-gray-100">{walletNetworkLabel}</span>.
              </>
            ) : (
              <>
                . Your wallet is on{' '}
                <span className="font-medium text-gray-100">{walletNetworkLabel}</span>, which is not
                one of the mission funding networks.
              </>
            )}{' '}
            Use the button to set the app network and switch your wallet, or pick another network in
            the selector.
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
            The app is set to{' '}
            <span className="font-medium text-gray-100">
              {(selectedChain.name ?? 'a network').replace(' One', '')}
            </span>
            , but your wallet is on{' '}
            <span className="font-medium text-gray-100">{walletNetworkLabel}</span>. Switch your
            wallet to match, or change the network in the selector.
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
