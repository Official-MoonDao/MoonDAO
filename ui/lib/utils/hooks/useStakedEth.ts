import StakedEthABI from 'const/abis/StakingContract.json'
import { STAKED_ETH_ADDRESS, MOONDAO_TREASURY } from 'const/config'
import { Contract, utils } from 'ethers'
import client from 'lib/thirdweb/client'
import { useState, useEffect } from 'react'
import { readContract } from 'thirdweb'
import { ethers5Adapter } from 'thirdweb/adapters/ethers5'
import { getRpcClient, eth_getBlockByNumber } from 'thirdweb/rpc'
import { ethereum } from '@/lib/rpc/chains'
import useContract from '@/lib/thirdweb/hooks/useContract'
import { keccak256 } from 'ethers/lib/utils'

export default function useStakedEth() {
  const [stakedEth, setStakedEth] = useState<any>()
  const [historicalData, setHistoricalData] = useState<any>()
  const [isLoading, setIsLoading] = useState<boolean>(false)
  const [error, setError] = useState<any>(null)
  const ETH_PER_DEPOSIT = 32
  const contract = useContract({
    address: STAKED_ETH_ADDRESS,
    abi: StakedEthABI as any,
    chain: ethereum,
  })
  const provider = ethers5Adapter.provider.toEthers({
    client,
    chain: ethereum,
  })
  const rpcRequest = getRpcClient({ client, chain: ethereum })
  const ethersContract = new Contract(
    STAKED_ETH_ADDRESS,
    StakedEthABI, // include at least the Deposit event ABI
    provider
  )

  useEffect(() => {
    async function fetchStakedEth() {
      setIsLoading(true)
      try {
        const provider = ethers5Adapter.provider.toEthers({
          client,
          chain: ethereum,
        })
        const ethersContract = new Contract(
          STAKED_ETH_ADDRESS,
          StakedEthABI, // include at least the Deposit event ABI
          provider
        )

        const filter = ethersContract.filters.Deposit(null, MOONDAO_TREASURY)

        // Inital stake transaction
        //https://app.safe.global/transactions/tx?safe=eth:0xce4a1E86a5c47CD677338f53DA22A91d85cab2c9&id=multisig_0xce4a1E86a5c47CD677338f53DA22A91d85cab2c9_0xc00049254699f2e997d1732c8da36024697bef66ff02cab0da39f629a105fac1
        const initialStakeBlockNumber = 21839730

        // 0. Grab deposit events from the contract
        const events = await ethersContract.queryFilter(
          filter,
          initialStakeBlockNumber,
          initialStakeBlockNumber
        )
        const pubKeys = events.map((e) => e?.args?.publicKey)
        const timeSeries = await Promise.all(
          events.map(async (event) => {
            const block = await eth_getBlockByNumber(rpcRequest, {
              blockNumber: BigInt(event.blockNumber),
            })
            return {
              timestamp: block.timestamp,
              value: ETH_PER_DEPOSIT,
              date: new Date(Number(block.timestamp)).toISOString(),
            }
          })
        )
        // Group by timestamp
        const timeSeriesReduced = timeSeries.reduce((acc, current) => {
          if (!acc.length) {
            acc.push(current)
            return acc
          }
          if (acc.at(-1).timestamp == current.timestamp) {
            acc.at(-1).value += current.value
          }
          return acc
        }, [] as any[])

        //1. Check if any deposits have been withdrawn
        const roots = pubKeys.map((pk) => keccak256(pk))
        const withdrawnFrom = await Promise.all(
          roots.map((root) =>
            readContract({
              contract: contract,
              method: 'getWithdrawnFromPublicKeyRoot' as string,
              params: [root],
            })
          )
        )
        const stillStakedCount = roots.filter(
          (_, i) => !withdrawnFrom[i]
        ).length

        const totalStaked = stillStakedCount * ETH_PER_DEPOSIT
        setStakedEth(totalStaked)
        setHistoricalData(timeSeriesReduced)
      } catch (error) {
        console.log('Error fetching staked ETH:', error)
        setError(error)
      } finally {
        setIsLoading(false)
      }
    }
    fetchStakedEth()
  }, [contract, rpcRequest])
  return { stakedEth, historicalData, isLoading, error }
}
