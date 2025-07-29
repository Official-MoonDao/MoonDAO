import { Actions, V4Planner, SwapExactInSingle } from '@uniswap/v4-sdk'
import { CommandType, RoutePlanner } from '@uniswap/universal-router-sdk'
import { ethers } from 'ethers'
import { useCallback } from 'react'
import { getChainSlug } from '@/lib/thirdweb/chain'
import ChainContextV5 from '@/lib/thirdweb/chain-context-v5'
import { useContext } from 'react'
import {
  FEE_HOOK_ADDRESSES,
  UNISWAP_V4_ROUTER_ADDRESSES,
  UNISWAP_V4_QUOTER_ADDRESSES,
} from '@/const/config'

// Minimal ABI for Uniswap V4 Quoter
const QUOTER_ABI = [
  {
    inputs: [
      {
        components: [
          { internalType: 'address', name: 'currency0', type: 'address' },
          { internalType: 'address', name: 'currency1', type: 'address' },
          { internalType: 'uint24', name: 'fee', type: 'uint24' },
          { internalType: 'int24', name: 'tickSpacing', type: 'int24' },
          { internalType: 'address', name: 'hooks', type: 'address' },
        ],
        internalType: 'struct PoolKey',
        name: 'poolKey',
        type: 'tuple',
      },
      { internalType: 'bool', name: 'zeroForOne', type: 'bool' },
      { internalType: 'uint256', name: 'exactAmount', type: 'uint256' },
      { internalType: 'bytes', name: 'hookData', type: 'bytes' },
    ],
    name: 'quoteExactInputSingle',
    outputs: [{ internalType: 'uint256', name: 'amountOut', type: 'uint256' }],
    stateMutability: 'nonpayable',
    type: 'function',
  },
]

const UNIVERSAL_ROUTER_ABI = [
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
]

export function useUniswapV4(tokenAddress: string, tokenDecimals: number) {
  const { selectedChain } = useContext(ChainContextV5)
  const chainSlug = getChainSlug(selectedChain)

  const provider = new ethers.providers.JsonRpcProvider(selectedChain.rpcUrls.default.http[0])

  const quoterContract = new ethers.Contract(
    UNISWAP_V4_QUOTER_ADDRESSES[chainSlug],
    QUOTER_ABI,
    provider
  )

  const quote = useCallback(
    async (amountIn: string) => {
      const config: SwapExactInSingle = {
        poolKey: {
          currency0: ethers.constants.AddressZero,
          currency1: tokenAddress,
          fee: 10000,
          tickSpacing: 100,
          hooks: FEE_HOOK_ADDRESSES[chainSlug],
        },
        zeroForOne: true,
        amountIn: ethers.utils.parseEther(amountIn).toString(),
        amountOutMinimum: '0',
        hookData: '0x00',
      }

      const result = await quoterContract.callStatic.quoteExactInputSingle({
        poolKey: config.poolKey,
        zeroForOne: config.zeroForOne,
        exactAmount: config.amountIn,
        hookData: config.hookData,
      })

      return ethers.utils.formatUnits(result.amountOut, tokenDecimals)
    },
    [chainSlug, quoterContract, tokenAddress, tokenDecimals]
  )

  const swap = useCallback(
    async (amountIn: string, signer: ethers.Signer, minOut: string) => {
      const config: SwapExactInSingle = {
        poolKey: {
          currency0: ethers.constants.AddressZero,
          currency1: tokenAddress,
          fee: 10000,
          tickSpacing: 100,
          hooks: FEE_HOOK_ADDRESSES[chainSlug],
        },
        zeroForOne: true,
        amountIn: ethers.utils.parseEther(amountIn).toString(),
        amountOutMinimum: ethers.utils.parseUnits(minOut, tokenDecimals).toString(),
        hookData: '0x00',
      }

      const universalRouter = new ethers.Contract(
        UNISWAP_V4_ROUTER_ADDRESSES[chainSlug],
        UNIVERSAL_ROUTER_ABI,
        signer
      )

      const v4Planner = new V4Planner()
      v4Planner.addAction(Actions.SWAP_EXACT_IN_SINGLE, [config])
      v4Planner.addAction(Actions.SETTLE_ALL, [config.poolKey.currency0, config.amountIn])
      v4Planner.addAction(Actions.TAKE_ALL, [config.poolKey.currency1, config.amountOutMinimum])

      const encodedActions = v4Planner.finalize()

      const routePlanner = new RoutePlanner()
      routePlanner.addCommand(CommandType.V4_SWAP, [v4Planner.actions, v4Planner.params])

      const deadline = Math.floor(Date.now() / 1000) + 3600

      const tx = await universalRouter.execute(routePlanner.commands, [encodedActions], deadline, {
        value: config.amountIn,
      })

      return tx.wait()
    },
    [chainSlug, tokenAddress, tokenDecimals]
  )

  return { quote, swap }
}
