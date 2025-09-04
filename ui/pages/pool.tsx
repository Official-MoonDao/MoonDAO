import { base, sepolia } from '@/lib/infura/infuraChains'
import { BigNumber } from 'ethers'
import PERMIT2_ABI from 'const/abis/Permit2.json'
import PositionManagerABI from 'const/abis/PositionManager.json'
import { PrivyWeb3Button } from '@/components/privy/PrivyWeb3Button'
import { Ether, Token, Percent } from '@uniswap/sdk-core'
import { ethers } from 'ethers'
import {
  Actions,
  Position,
  Pool,
  MintOptions,
  V4PositionManager,
} from '@uniswap/v4-sdk'
import { getChainSlug } from '@/lib/thirdweb/chain'
import {
  MOONEY_ADDRESSES,
  POSITION_MANAGERS,
  PERMIT2_ADDRESS,
  FEE_HOOK_ADDRESSES,
} from 'const/config'
import useSafe from '@/lib/safe/useSafe'
import { nearestUsableTick } from '@uniswap/v3-sdk'

export default function PoolPage() {
  const MOONEY_PRICE = 0.0003672
  const ETH_PRICE = 4316.07
  const ETH_AMOUNT = 0.0001

  //const chain = base
  //const SAFE_ADDRESS = '0xFca7C9f7753C9EF46213a3159eEf1F2b0a1e4a78'

  const chain = sepolia
  const SAFE_ADDRESS = '0xc1a809E51593051Fa550689d0dC850Bb5DC866c4'

  const chainSlug = getChainSlug(chain)
  const { safe, queueSafeTx, lastSafeTxExecuted } = useSafe(SAFE_ADDRESS, chain)
  const permitInterface = new ethers.utils.Interface(PERMIT2_ABI.abi)
  const maxUint160: bigint = 2n ** 160n - 1n
  const timestampSeconds: number = Math.floor(Date.now() / 1000)
  const ONE_HOUR = 60 * 60
  const deadline = timestampSeconds + ONE_HOUR
  //console.log(
  //'mooney address',
  //MOONEY_ADDRESSES[chainSlug],
  //POSITION_MANAGERS[chainSlug]
  //)

  const txData = permitInterface.encodeFunctionData('approve', [
    MOONEY_ADDRESSES[chainSlug],
    POSITION_MANAGERS[chainSlug],
    maxUint160,
    deadline,
  ])
  // FIXME
  const startingPrice = Math.floor(
    Math.sqrt(ETH_PRICE / MOONEY_PRICE) * 2 ** 96
  )
  const DECIMALS = 18
  const ETH_NATIVE = Ether.onChain(chain.id)

  const ETH_TOKEN = new Token(
    chain.id,
    '0x0000000000000000000000000000000000000000',
    DECIMALS,
    'ETH',
    'ETHER'
  )
  const MOONEY_TOKEN = new Token(
    chain.id,
    MOONEY_ADDRESSES[chainSlug],
    DECIMALS,
    'MOONEY',
    'MOONEY'
  )
  //const startingPrice = 2505414483750479251915866636288
  //const startingPrice = 1234567890123456789
  // Round tickLower up (closer to the center)
  // The nearestUsableTick ensures the tick is aligned with tick spacing
  //
  const MIN_TICK = -887272
  const MAX_TICK = 887272
  const TICK_SPACING = 200 // default for 1% pools
  const tickLower = nearestUsableTick(MIN_TICK, TICK_SPACING)

  // Round tickUpper down (closer to the center)
  const tickUpper = nearestUsableTick(MAX_TICK, TICK_SPACING)

  // 5 eth
  //
  //
  //const tick = Math.floor(
  //BigNumber.from((startingPrice / 2n ** 96n).toString()).log() /
  //Math.log(1.0001)
  //)
  const tick = nearestUsableTick(
    Math.floor(Math.log(ETH_PRICE / MOONEY_PRICE) / Math.log(1.0001)),
    TICK_SPACING
  )
  const amountMooney = (ETH_PRICE * ETH_AMOUNT) / MOONEY_PRICE
  const amountEthDesired = BigInt(Math.floor(ETH_AMOUNT * 10 ** DECIMALS))
  const amountMooneyDesired = BigInt(Math.floor(amountMooney * 10 ** DECIMALS))
  const FEE = 10000 // 1% fee
  const pool = new Pool(
    ETH_NATIVE,
    MOONEY_TOKEN,
    FEE,
    TICK_SPACING,
    FEE_HOOK_ADDRESSES[chainSlug], // Pass the hook address from above
    BigInt(startingPrice).toString(), // Convert bigint to string for SDK
    '0',
    tick + 5
  )

  const position = Position.fromAmounts({
    pool,
    tickLower,
    tickUpper,
    amount0: amountEthDesired.toString(),
    amount1: amountMooneyDesired.toString(),
    useFullPrecision: true, // Use full precision for maximum accuracy
  })

  const poolKey = {
    currency0: ethers.constants.AddressZero,
    currency1: MOONEY_ADDRESSES[chainSlug],
    fee: FEE,
    tickSpacing: TICK_SPACING,
    hooks: FEE_HOOK_ADDRESSES[chainSlug],
  }
  // Create the basic MintOptions object with required fields
  const slippageTolerance = 0.5 // 0.5% slippage tolerance
  const slippagePct = new Percent(Math.floor(slippageTolerance * 100), 10_000)
  const mintOptions: MintOptions = {
    recipient: SAFE_ADDRESS,
    slippageTolerance: slippagePct,
    deadline: deadline.toString(),

    // 4. useNative (optional): Use native ETH
    useNative: Ether.onChain(chain.id),

    hookData: '0x', // Default empty bytes
    // 7-8. For new pools only:
    createPool: true, // Uncomment if creating a new pool
    sqrtPriceX96: BigInt(startingPrice).toString(), // Initial price, required if createPool is true
  }
  const { calldata, value } = V4PositionManager.addCallParameters(
    position,
    mintOptions
  )
  const handleApprove = async () => {
    await queueSafeTx({
      to: PERMIT2_ADDRESS,
      data: txData,
      value: '0',
      safeTxGas: '1000000',
    })
  }
  const handleCreate = async () => {
    const posmInterface = new ethers.utils.Interface(PositionManagerABI.abi)
    const mintData = posmInterface.encodeFunctionData('multicall', [[calldata]])
    await queueSafeTx({
      to: POSITION_MANAGERS[chainSlug],
      data: mintData,
      value: value,
      safeTxGas: '1000000',
    })
  }
  return (
    <div>
      <PrivyWeb3Button
        v5
        requiredChain={chain}
        label="Approve"
        action={handleApprove}
        className="px-6 py-3 bg-gradient-to-r from-green-500 to-emerald-600 hover:from-green-600 hover:to-emerald-700 text-white font-RobotoMono rounded-xl transition-all duration-300 transform hover:scale-[1.02] shadow-lg hover:shadow-xl border-0"
      />
      <PrivyWeb3Button
        v5
        requiredChain={chain}
        label="Create"
        action={handleCreate}
        className="px-6 py-3 bg-gradient-to-r from-green-500 to-emerald-600 hover:from-green-600 hover:to-emerald-700 text-white font-RobotoMono rounded-xl transition-all duration-300 transform hover:scale-[1.02] shadow-lg hover:shadow-xl border-0"
      />
    </div>
  )
}
