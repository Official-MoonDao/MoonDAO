import StakedEthABI from 'const/abis/StakingContract.json'
import { STAKED_ETH_ADDRESS, MOONDAO_TREASURY } from 'const/config'
import { Contract, utils } from 'ethers'
import client from 'lib/thirdweb/client'
import { useState, useEffect } from 'react'
import { readContract } from 'thirdweb'
import { ethers5Adapter } from 'thirdweb/adapters/ethers5'
import { ethereum } from '@/lib/infura/infuraChains'
import useContract from '@/lib/thirdweb/hooks/useContract'
import { keccak256 } from 'ethers/lib/utils'

export default function useStakedEth() {
  const [stakedEth, setStakedEth] = useState<any>()
  const [isLoading, setIsLoading] = useState<boolean>(false)
  const [error, setError] = useState<any>(null)
  const contract = useContract({
    address: STAKED_ETH_ADDRESS,
    abi: StakedEthABI as any,
    chain: ethereum,
  })

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

        // 1. Check if any deposits have been withdrawn
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

        // 2. each deposit = 32 ETH
        const totalStaked = stillStakedCount * 32
        setStakedEth(totalStaked)
      } catch (error) {
        console.log('Error fetching staked ETH:', error)
        setError(error)
      } finally {
        setIsLoading(false)
      }
    }
    fetchStakedEth()
  }, [contract])
  return { stakedEth, isLoading, error }
}
