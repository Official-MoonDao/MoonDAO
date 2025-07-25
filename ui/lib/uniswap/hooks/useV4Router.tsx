import { useWallets } from '@privy-io/react-auth'
import { ethers } from 'ethers'
import { useContext } from 'react'
import { ethers5Adapter } from 'thirdweb/adapters/ethers5'
import ChainContextV5 from '@/lib/thirdweb/chain-context-v5'
import client from '@/lib/thirdweb/client'
import { getChainSlug } from '@/lib/thirdweb/chain'
import PrivyWalletContext from '../../privy/privy-wallet-context'
import {
  UNISWAP_V4_ROUTER_ADDRESSES,
  FEE_HOOK_ADDRESSES,
  UNISWAP_V4_LP_FEE,
  UNISWAP_V4_TICK_SPACING,
  ZERO_ADDRESS,
} from '../../../const/config'

export function useV4Router(amountIn: number, tokenOut: string) {
  const { selectedWallet } = useContext(PrivyWalletContext)
  const { wallets } = useWallets()
  const { selectedChain } = useContext(ChainContextV5)
  const chainSlug = getChainSlug(selectedChain)

  async function swap() {
    const provider = ethers5Adapter.provider.toEthers({ client, chain: selectedChain })
    const signer = provider.getSigner(wallets[selectedWallet]?.address)
    const router = new ethers.Contract(
      UNISWAP_V4_ROUTER_ADDRESSES[chainSlug],
      ['function execute(bytes,bytes[],uint256) payable'],
      signer
    )

    const amount = ethers.utils.parseEther(String(amountIn))

    const poolKey = [
      ZERO_ADDRESS,
      tokenOut,
      UNISWAP_V4_LP_FEE[chainSlug],
      UNISWAP_V4_TICK_SPACING,
      FEE_HOOK_ADDRESSES[chainSlug],
    ]

    const actions = ethers.utils.solidityPack(['uint8','uint8','uint8'], [12, 21, 23])

    const params0 = ethers.utils.defaultAbiCoder.encode(
      ['tuple(address,address,uint24,int24,address)', 'bool', 'uint128', 'uint256', 'bytes'],
      [poolKey, true, amount, 0, '0x']
    )
    const params1 = ethers.utils.defaultAbiCoder.encode(['address', 'uint128'], [ZERO_ADDRESS, amount])
    const params2 = ethers.utils.defaultAbiCoder.encode(['address', 'uint128'], [tokenOut, 0])

    const inputs = [
      ethers.utils.defaultAbiCoder.encode(['bytes', 'bytes[]'], [actions, [params0, params1, params2]]),
    ]

    const deadline = Math.floor(Date.now() / 1000) + 80

    return router.execute('0x10', inputs, deadline, { value: amount })
  }

  return { swap }
}
