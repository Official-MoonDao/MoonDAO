//Get total mooney balance for an address on L1 and L2
import { useEffect, useState } from 'react'
import { getContract, readContract } from 'thirdweb'
import { arbitrum, base, ethereum, polygon } from '@/lib/infura/infuraChains'
import client from '@/lib/thirdweb/client'
import ERC20 from '../../../const/abis/ERC20.json'
import { MOONEY_ADDRESSES } from '../../../const/config'

const ethMooneyContract = getContract({
  client: client,
  address: MOONEY_ADDRESSES['ethereum'],
  chain: ethereum,
  abi: ERC20 as any,
})

const polygonMooneyContract = getContract({
  client: client,
  address: MOONEY_ADDRESSES['polygon'],
  chain: polygon,
  abi: ERC20 as any,
})

const arbMooneyContract = getContract({
  client: client,
  address: MOONEY_ADDRESSES['arbitrum'],
  chain: arbitrum,
  abi: ERC20 as any,
})

const baseMooneyContract = getContract({
  client: client,
  address: MOONEY_ADDRESSES['base'],
  chain: base,
  abi: ERC20 as any,
})

export function useTotalMooneyBalance(address: string | undefined) {
  const [totalMooneyBalance, setTotalMooneyBalance] = useState<number>(0)

  useEffect(() => {
    async function checkForBalance() {
      const results = await Promise.allSettled([
        readContract({
          contract: ethMooneyContract,
          method: 'balanceOf',
          params: [address],
        }),
        readContract({
          contract: polygonMooneyContract,
          method: 'balanceOf',
          params: [address],
        }),
        readContract({
          contract: arbMooneyContract,
          method: 'balanceOf',
          params: [address],
        }),
        readContract({
          contract: baseMooneyContract,
          method: 'balanceOf',
          params: [address],
        }),
      ])

      const [ethMooney, polygonMooney, arbMooney, baseMooney] = results.map(
        (result) => (result.status === 'fulfilled' ? result.value : 0)
      )

      setTotalMooneyBalance(
        (Number(ethMooney) +
          Number(polygonMooney) +
          Number(arbMooney) +
          Number(baseMooney)) /
          10 ** 18
      )
    }

    if (address) {
      checkForBalance()
    }
  }, [address])

  return totalMooneyBalance
}
