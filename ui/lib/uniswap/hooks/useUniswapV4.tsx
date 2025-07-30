import { useWallets } from '@privy-io/react-auth'
import { CommandType, RoutePlanner } from '@uniswap/universal-router-sdk'
import { Actions, V4Planner, SwapExactInSingle } from '@uniswap/v4-sdk'
import QUOTER_ABI from 'const/abis/V4Quoter.json'
import {
  FEE_HOOK_ADDRESSES,
  UNISWAP_V4_ROUTER_ADDRESSES,
  UNISWAP_V4_QUOTER_ADDRESSES,
} from 'const/config'
import { ethers } from 'ethers'
import { useCallback } from 'react'
import { useContext } from 'react'
import {
  prepareContractCall,
  sendAndConfirmTransaction,
  simulateTransaction,
  ZERO_ADDRESS,
  readContract,
  waitForReceipt,
} from 'thirdweb'
import { ethers5Adapter } from 'thirdweb/adapters/ethers5'
import { useActiveAccount, useActiveWallet } from 'thirdweb/react'
import PrivyWalletContext from '@/lib/privy/privy-wallet-context'
import { getChainSlug } from '@/lib/thirdweb/chain'
import ChainContextV5 from '@/lib/thirdweb/chain-context-v5'
import client from '@/lib/thirdweb/client'

// Minimal ABI for Uniswap V4 Quoter
//const QUOTER_ABI = [
//{
//inputs: [
//{
//components: [
//{ internalType: 'address', name: 'currency0', type: 'address' },
//{ internalType: 'address', name: 'currency1', type: 'address' },
//{ internalType: 'uint24', name: 'fee', type: 'uint24' },
//{ internalType: 'int24', name: 'tickSpacing', type: 'int24' },
//{ internalType: 'address', name: 'hooks', type: 'address' },
//],
//internalType: 'struct PoolKey',
//name: 'poolKey',
//type: 'tuple',
//},
//{ internalType: 'bool', name: 'zeroForOne', type: 'bool' },
//{ internalType: 'uint256', name: 'exactAmount', type: 'uint256' },
//{ internalType: 'bytes', name: 'hookData', type: 'bytes' },
//],
//name: 'quoteExactInputSingle',
//outputs: [{ internalType: 'uint256', name: 'amountOut', type: 'uint256' }],
//stateMutability: 'nonpayable',
//type: 'function',
//},
//]

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
  const { selectedWallet } = useContext(PrivyWalletContext)
  //const wallet = useActiveWallet()
  //consol
  const { wallets } = useWallets()

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
      console.log('Quote config:', config)

      const wallet = wallets[selectedWallet]
      const provider = await wallet.getEthersProvider()

      const quoterContract = new ethers.Contract(
        UNISWAP_V4_QUOTER_ADDRESSES[chainSlug],
        QUOTER_ABI,
        provider
      )
      console.log('quoter address', UNISWAP_V4_QUOTER_ADDRESSES[chainSlug])
      const result = await quoterContract.callStatic.quoteExactInputSingle({
        poolKey: config.poolKey,
        zeroForOne: config.zeroForOne,
        exactAmount: config.amountIn,
        hookData: config.hookData,
      })
      //const result = await quoterContract.callStatic.quoteExactInputSingle(
      //config.poolKey,
      //config.zeroForOne,
      //config.amountIn,
      //config.hookData
      //)
      console.log('Quote result:', result)

      //return 0
      return ethers.utils.formatUnits(result.amountOut, tokenDecimals)
    },
    [chainSlug, tokenAddress, tokenDecimals]
  )

  const swap = useCallback(
    async (amountIn: string, minOut: string) => {
      console.log('amountIn:', amountIn)
      console.log('minOut:', minOut)
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
        amountOutMinimum: ethers.utils
          .parseUnits(minOut, tokenDecimals)
          .toString(),
        sqrtPriceLimitX96: '0', // 👈 add this
        hookData: '0x00',
      }
      console.log('Swap config:', config)

      const wallet = wallets[selectedWallet]
      //const provider = ethers5Adapter.provider.toEthers({
      //client,
      //chain: selectedChain,
      //})
      const provider = await wallet.getEthersProvider()

      const signer = provider?.getSigner()
      console.log('signer', signer)
      const universalRouter = new ethers.Contract(
        UNISWAP_V4_ROUTER_ADDRESSES[chainSlug],
        UNIVERSAL_ROUTER_ABI,
        provider?.getSigner()
      )
      console.log('universalRouter', universalRouter)

      const v4Planner = new V4Planner()
      console.log('v4Planner', v4Planner)
      console.log('Actions.SWAP_EXACT_IN_SINGLE', Actions.SWAP_EXACT_IN_SINGLE)
      v4Planner.addAction(Actions.SWAP_EXACT_IN_SINGLE, [config])
      console.log('added 0')
      v4Planner.addAction(Actions.SETTLE_ALL, [
        config.poolKey.currency0,
        config.amountIn,
      ])
      console.log('added 1')
      v4Planner.addAction(Actions.TAKE_ALL, [
        config.poolKey.currency1,
        config.amountOutMinimum,
      ])
      console.log('v4Planner.actions', v4Planner.actions)

      const encodedActions = v4Planner.finalize()
      console.log('encodedActions', encodedActions)

      const routePlanner = new RoutePlanner()
      console.log('routePlanner', routePlanner)
      console.log('v4planner', v4Planner)
      console.log('CommandType.V4_SWAP', CommandType.V4_SWAP)
      console.log('CommandType', CommandType)
      //const V4_SWAP = 4 // https://github.com/Uniswap/universal-router/blob/main/contracts/libraries/Commands.sol#L35
      routePlanner.addCommand(CommandType.V4_SWAP, [
        v4Planner.actions,
        v4Planner.params,
      ])
      console.log('added')

      const deadline = Math.floor(Date.now() / 1000) + 3600

      console.log('config.amountIn', config.amountIn)
      const tx = await universalRouter.execute(
        routePlanner.commands,
        [encodedActions],
        deadline,
        {
          value: config.amountIn,
        }
      )

      return tx.wait()
    },
    [chainSlug, tokenAddress, tokenDecimals]
  )

  return { quote, swap }
}
