import { useWallets } from '@privy-io/react-auth'
import { SwapExactInSingle, Actions, V4Planner } from '@uniswap/v4-sdk'
import { CommandType, RoutePlanner } from '@uniswap/universal-router-sdk'
import { ethers } from 'ethers'
import { useContext } from 'react'
import { ethers5Adapter } from 'thirdweb/adapters/ethers5'
import ChainContextV5 from '@/lib/thirdweb/chain-context-v5'
import client from '@/lib/thirdweb/client'
import { getChainSlug } from '@/lib/thirdweb/chain'
import PrivyWalletContext from '@/lib/privy/privy-wallet-context'
import {
  UNISWAP_V4_ROUTER_ADDRESSES,
  UNISWAP_V4_QUOTER_ADDRESSES,
} from '@/const/config'
import QUOTER_ABI from '@/const/abis/UniswapV4Quoter.json'

export function useUniswapV4(poolKey: any) {
  const { selectedWallet } = useContext(PrivyWalletContext)
  const { selectedChain } = useContext(ChainContextV5)
  const chainSlug = getChainSlug(selectedChain)
  const { wallets } = useWallets()

  async function getQuote(amountIn: string, zeroForOne = true) {
    const provider = ethers5Adapter.provider.toEthers({
      client,
      chain: selectedChain,
    })
    const quoter = new ethers.Contract(
      UNISWAP_V4_QUOTER_ADDRESSES[chainSlug],
      QUOTER_ABI as any,
      provider
    )
    const result = await quoter.callStatic.quoteExactInputSingle({
      poolKey,
      zeroForOne,
      exactAmount: amountIn,
      hookData: '0x00',
    })
    return result.amountOut as ethers.BigNumber
  }

  async function executeSwap(config: SwapExactInSingle) {
    const provider = await wallets[selectedWallet]?.getEthersProvider()
    const signer = provider.getSigner()

    const v4Planner = new V4Planner()
    v4Planner.addAction(Actions.SWAP_EXACT_IN_SINGLE, [config])
    v4Planner.addAction(Actions.SETTLE_ALL, [config.poolKey.currency0, config.amountIn])
    v4Planner.addAction(Actions.TAKE_ALL, [config.poolKey.currency1, config.amountOutMinimum])

    const encodedActions = v4Planner.finalize()

    const routePlanner = new RoutePlanner()
    routePlanner.addCommand(CommandType.V4_SWAP, [v4Planner.actions, v4Planner.params])

    const universalRouter = new ethers.Contract(
      UNISWAP_V4_ROUTER_ADDRESSES[chainSlug],
      [
        {
          inputs: [
            { internalType: 'bytes', name: 'commands', type: 'bytes' },
            { internalType: 'bytes[]', name: 'inputs', type: 'bytes[]' },
            { internalType: 'uint256', name: 'deadline', type: 'uint256' },
          ],
          name: 'execute',
          outputs: [],
          stateMutability: 'payable',
          type: 'function',
        },
      ],
      signer
    )

    const deadline = Math.floor(Date.now() / 1000) + 3600

    const tx = await universalRouter.execute(
      routePlanner.commands,
      [encodedActions],
      deadline,
      { value: config.amountIn }
    )

    return tx.wait()
  }

  return { getQuote, executeSwap }
}
