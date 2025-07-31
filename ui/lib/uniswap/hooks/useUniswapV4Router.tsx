import { useWallets } from '@privy-io/react-auth'
import { ethers } from 'ethers'
import { useContext } from 'react'
import { getChainSlug } from '@/lib/thirdweb/chain'
import ChainContextV5 from '@/lib/thirdweb/chain-context-v5'
import PrivyWalletContext from '../../privy/privy-wallet-context'
import { UNISWAP_V4_ROUTER_ADDRESSES } from '../../../const/config'

const UNISWAP_V4_ROUTER_ABI = [
  'function swapExactETHForTokens(address tokenOut,address recipient,uint256 amountOutMin) payable returns (uint256 amountOut)'
]

export function useUniswapV4Router() {
  const { selectedChain } = useContext(ChainContextV5)
  const { selectedWallet } = useContext(PrivyWalletContext)
  const { wallets } = useWallets()
  const chainSlug = getChainSlug(selectedChain)
  const routerAddress = UNISWAP_V4_ROUTER_ADDRESSES[chainSlug]

  async function swapExactETHForTokens(amountIn: number, tokenOut: string, minOut: bigint = 0n) {
    const wallet = wallets[selectedWallet]
    const provider = await wallet.getEthersProvider()
    const signer = provider.getSigner()
    const router = new ethers.Contract(routerAddress, UNISWAP_V4_ROUTER_ABI, signer)
    const tx = await router.swapExactETHForTokens(
      tokenOut,
      wallet.address,
      minOut,
      { value: ethers.utils.parseEther(String(amountIn)) }
    )
    return provider.waitForTransaction(tx.hash)
  }

  return { swapExactETHForTokens }
}
