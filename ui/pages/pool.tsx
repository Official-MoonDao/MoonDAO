import { base, sepolia } from '@/lib/infura/infuraChains'
import { getMooneyPrice } from '@/lib/coinstats'
import { useEffect } from 'react'
import { useState } from 'react'
import useETHPrice from '@/lib/etherscan/useETHPrice'
import { assetImageExtension } from '@/lib/dashboard/dashboard-utils.ts/asset-config'
import Image from 'next/image'
import ERC20 from 'const/abis/ERC20.json'
import ContentLayout from '@/components/layout/ContentLayout'
import Container from '@/components/layout/Container'
import useContract from '@/lib/thirdweb/hooks/useContract'
import { useActiveAccount } from 'thirdweb/react'
import { prepareContractCall, sendAndConfirmTransaction } from 'thirdweb'
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

function PoolAsset({
  name,
  value,
  usdValue,
  approximateUSD,
}: RewardAssetProps) {
  const image = assetImageExtension[name]
    ? `/coins/${name}.${assetImageExtension[name]}`
    : '/coins/DEFAULT.png'
  const usd = Number(usdValue)

  return (
    <div className="flex gap-3 items-center">
      <Image
        className="scale-[0.55] filter drop-shadow-lg"
        src={image}
        alt={name}
        width={name === 'ETH' ? 42 : 50}
        height={name === 'ETH' ? 42 : 50}
      />
      <div className="flex flex-col min-w-0 flex-1">
        <div className="flex gap-2 font-GoodTimes text-lg text-white">
          <p className="text-white/80">{name}</p>
          {/* Show abbreviated on small screens, full on larger screens */}
          <p className="text-white font-bold whitespace-nowrap">
            <span className="sm:hidden">{value}</span>
            <span className="hidden sm:inline">{value}</span>
          </p>
        </div>
        {usd > 0 && (
          <p className="text-gray-400 text-xs">{`(${
            approximateUSD ? '~' : ''
          }$${usd.toLocaleString()})`}</p>
        )}
      </div>
    </div>
  )
}

export default function PoolPage() {
  const ETH_PRICE = 4305

  const MOONEY_PRICE = 0.0003691
  const chain = base
  const SAFE_ADDRESS = '0xFca7C9f7753C9EF46213a3159eEf1F2b0a1e4a78'
  const ETH_AMOUNT = 4.95

  //const MOONEY_PRICE = 0.0003672
  //const chain = sepolia
  //const SAFE_ADDRESS = '0xc1a809E51593051Fa550689d0dC850Bb5DC866c4'
  //const ETH_AMOUNT = 0.0001

  const { data: ethUsdPrice } = useETHPrice(ETH_AMOUNT, 'ETH_TO_USD')
  const [mooneyPrice, setMooneyPrice] = useState(0)
  useEffect(() => {
    const fetchPrice = async () => {
      const price = await getMooneyPrice()
      setMooneyPrice(price)
    }
    fetchPrice()
  }, [mooneyPrice, setMooneyPrice])

  const account = useActiveAccount()
  const chainSlug = getChainSlug(chain)
  const { safe, queueSafeTx, lastSafeTxExecuted } = useSafe(SAFE_ADDRESS, chain)
  const permitInterface = new ethers.utils.Interface(PERMIT2_ABI.abi)
  const mooneyInterface = new ethers.utils.Interface(ERC20)
  const maxUint160: bigint = 2n ** 160n - 1n
  const maxUint256: bigint = 2n ** 256n - 1n

  const timestampSeconds: number = Math.floor(Date.now() / 1000)
  const ONE_HOUR = 60 * 60
  const deadline = timestampSeconds + ONE_HOUR

  const txData = permitInterface.encodeFunctionData('approve', [
    MOONEY_ADDRESSES[chainSlug],
    POSITION_MANAGERS[chainSlug],
    maxUint160,
    deadline,
  ])
  const mooneyData = mooneyInterface.encodeFunctionData('approve', [
    PERMIT2_ADDRESS,
    maxUint256,
  ])
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
  const MIN_TICK = -887272
  const MAX_TICK = 887272
  const TICK_SPACING = 200 // default for 1% pools
  const tickLower = nearestUsableTick(MIN_TICK, TICK_SPACING)
  const tickUpper = nearestUsableTick(MAX_TICK, TICK_SPACING)

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
    FEE_HOOK_ADDRESSES[chainSlug],
    BigInt(startingPrice).toString(),
    '0',
    tick - 73
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
  const slippageTolerance = 0.5 // 0.5% slippage tolerance
  const slippagePct = new Percent(Math.floor(slippageTolerance * 100), 10_000)
  const mintOptions: MintOptions = {
    recipient: SAFE_ADDRESS,
    slippageTolerance: slippagePct,
    deadline: deadline.toString(),
    useNative: Ether.onChain(chain.id),
    hookData: '0x',
    createPool: true,
    sqrtPriceX96: BigInt(startingPrice).toString(),
  }
  const { calldata, value } = V4PositionManager.addCallParameters(
    position,
    mintOptions
  )
  const posmInterface = new ethers.utils.Interface(PositionManagerABI.abi)
  const mintData = posmInterface.encodeFunctionData('multicall', [[calldata]])
  const posmContract = useContract({
    address: POSITION_MANAGERS[chainSlug],
    chain: chain,
    abi: PositionManagerABI.abi as any,
  })
  const mooneyContract = useContract({
    address: MOONEY_ADDRESSES[chainSlug],
    chain: chain,
    abi: ERC20,
  })
  const approveContract = useContract({
    address: PERMIT2_ADDRESS,
    chain: chain,
    abi: PERMIT2_ABI.abi,
  })

  const handleCreate = async () => {
    //await queueSafeTx({
    //to: MOONEY_ADDRESSES[chainSlug],
    //data: mooneyData,
    //value: '0',
    //safeTxGas: '1000000',
    //})
    //await queueSafeTx({
      //to: PERMIT2_ADDRESS,
      //data: txData,
      //value: '0',
      //safeTxGas: '1000000',
    //})
    console.log('value', parseInt(value))
    console.log('data', mintData)
    await queueSafeTx({
      to: POSITION_MANAGERS[chainSlug],
      data: mintData,
      value: parseInt(value).toString(),
      safeTxGas: '1000000',
    })
  }
  const handleCreateEOA = async () => {
    const permit2Transaction = prepareContractCall({
      contract: mooneyContract,
      method: 'approve' as string,
      params: [PERMIT2_ADDRESS, maxUint256],
    })
    await sendAndConfirmTransaction({
      transaction: permit2Transaction,
      account,
    })
    const approveTransaction = prepareContractCall({
      contract: approveContract,
      method: 'approve' as string,
      params: [
        MOONEY_ADDRESSES[chainSlug],
        POSITION_MANAGERS[chainSlug],
        maxUint160,
        deadline,
      ],
    })
    await sendAndConfirmTransaction({
      transaction: approveTransaction,
      account,
    })
    const mintTransaction = prepareContractCall({
      contract: posmContract,
      method: 'multicall' as string,
      params: [[calldata]],
      value: value,
    })
    await sendAndConfirmTransaction({
      transaction: mintTransaction,
      account,
    })
  }
  return (
    <Container>
      <ContentLayout
        header="🦄"
        mainPadding
        mode="compact"
        popOverEffect={false}
        isProfile
      >
        <div className="m-4">
          <PoolAsset name="ETH" value={ETH_AMOUNT} usdValue={ethUsdPrice} />
          <PoolAsset
            name="MOONEY"
            value={Math.floor(amountMooney)}
            usdValue={MOONEY_PRICE * Math.floor(amountMooney)}
          />
          <PrivyWeb3Button
            v5
            requiredChain={chain}
            label="Create Pool"
            action={handleCreate}
            className="m-3 px-6 py-3 bg-gradient-to-r from-green-500 to-emerald-600 hover:from-green-600 hover:to-emerald-700 text-white font-RobotoMono rounded-xl transition-all duration-300 transform hover:scale-[1.02] shadow-lg hover:shadow-xl border-0"
          />
        </div>
      </ContentLayout>
    </Container>
  )
}
