// Keeps contribution writes on the contributions chain. A wallet signs on
// whatever network it is set to, whatever chain the transaction was built for,
// so a wallet left on Ethereum signed a submit there: it queued behind other
// mainnet transactions and would have reached an address with no contract.
import type { ConnectedWallet } from '@privy-io/react-auth'
import type { Chain } from 'thirdweb'
import { addNetworkToWallet } from '@/lib/thirdweb/addNetworkToWallet'

/** Arbitrum makes about four blocks a second, so thirdweb's default of 100 is ~25 seconds. */
export const RECEIPT_WAIT_BLOCKS = 2400

const chainLabel = (chain: Chain) => (chain.name ?? 'the right network').replace(' One', '')

/** The wallet's own answer, not Privy's cached `chainId`, which can lag a switch. */
async function walletChainId(wallet: ConnectedWallet): Promise<number> {
  const provider = await wallet.getEthereumProvider()
  return Number(await provider.request({ method: 'eth_chainId' }))
}

/**
 * Moves the wallet that will sign for `address` to `chain`, and throws a
 * message the form can show when it stays somewhere else.
 */
export async function ensureWalletOnChain(
  wallets: ConnectedWallet[] | undefined,
  address: string,
  chain: Chain
): Promise<void> {
  const wallet = wallets?.find((w) => w.address.toLowerCase() === address.toLowerCase())
  // Not a Privy wallet: thirdweb signs for it on the transaction's own chain.
  if (!wallet) return
  if ((await walletChainId(wallet)) === chain.id) return

  try {
    await wallet.switchChain(chain.id)
  } catch (err: any) {
    if (err?.code === 4902 || /Unrecognized chain/i.test(err?.message ?? '')) {
      if (await addNetworkToWallet(chain as any)) await wallet.switchChain(chain.id).catch(() => {})
    }
  }
  if ((await walletChainId(wallet)) !== chain.id)
    throw new Error(`Switch your wallet to ${chainLabel(chain)} and try again.`)
}
