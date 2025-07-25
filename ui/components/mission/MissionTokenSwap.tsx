import { useContext, useState } from 'react'
import { ethers } from 'ethers'
import { useActiveAccount } from 'thirdweb/react'
import { getContract, readContract, prepareContractCall, sendAndConfirmTransaction } from 'thirdweb'
import ChainContextV5 from '@/lib/thirdweb/chain-context-v5'
import { getChainSlug } from '@/lib/thirdweb/chain'
import { V4_ROUTER_ADDRESSES } from 'const/config'
import UniversalRouterABI from 'const/abis/UniversalRouter.json'
import PoolDeployerABI from 'const/abis/PoolDeployer.json'
import StandardButton from '../layout/StandardButton'
import client from '@/lib/thirdweb/client'

export default function MissionTokenSwap({ poolDeployerAddress }: { poolDeployerAddress: string }) {
  const { selectedChain } = useContext(ChainContextV5)
  const chainSlug = getChainSlug(selectedChain)
  const account = useActiveAccount()
  const [amount, setAmount] = useState('')

  async function swap() {
    if (!account || !poolDeployerAddress) return

    const poolDeployerContract = getContract({
      client,
      address: poolDeployerAddress,
      abi: PoolDeployerABI as any,
      chain: selectedChain,
    })

    const [tokenAddress, hookAddress] = await Promise.all([
      readContract({ contract: poolDeployerContract, method: 'token' as string, params: [] }),
      readContract({ contract: poolDeployerContract, method: 'hookAddress' as string, params: [] }),
    ])

    const amountIn = ethers.utils.parseEther(amount || '0')
    const routerContract = getContract({
      client,
      address: V4_ROUTER_ADDRESSES[chainSlug],
      abi: UniversalRouterABI as any,
      chain: selectedChain,
    })

    const poolKey = {
      currency0: ethers.constants.AddressZero,
      currency1: tokenAddress,
      fee: 10000,
      tickSpacing: 100,
      hooks: hookAddress,
    }

    const exactInput = ethers.utils.defaultAbiCoder.encode(
      [
        'tuple(address currency0,address currency1,uint24 fee,int24 tickSpacing,address hooks)',
        'bool',
        'uint128',
        'uint256',
        'bytes',
      ],
      [poolKey, true, amountIn, 0, '0x']
    )
    const params1 = ethers.utils.defaultAbiCoder.encode(['address', 'uint256'], [poolKey.currency0, amountIn])
    const params2 = ethers.utils.defaultAbiCoder.encode(['address', 'uint256'], [poolKey.currency1, 0])
    const actions = ethers.utils.solidityPack(['uint8', 'uint8', 'uint8'], [0, 1, 2])
    const input = ethers.utils.defaultAbiCoder.encode(['bytes', 'bytes[]'], [actions, [exactInput, params1, params2]])
    const deadline = Math.floor(Date.now() / 1000) + 80

    const tx = prepareContractCall({
      contract: routerContract,
      method: 'execute' as string,
      params: ['0x10', [input], BigInt(deadline)],
      value: amountIn,
    })

    await sendAndConfirmTransaction({ transaction: tx, account })
  }

  return (
    <div className="mt-4 space-y-2">
      <input
        value={amount}
        onChange={(e) => setAmount(e.target.value)}
        placeholder="ETH amount"
        className="w-full p-2 rounded bg-black/20"
      />
      <StandardButton label="Buy Tokens" action={swap} />
    </div>
  )
}
