import { Polygon } from '@thirdweb-dev/chains'
import { ethers } from 'ethers'
import { useEffect, useState } from 'react'
import ERC20 from '../../../const/abis/ERC20.json'
import { MARKETPLACE_FEE_SPLIT, MOONEY_ADDRESSES } from '../../../const/config'
import { initSDK } from '../thirdweb'

export function useMarketFeeSplitStats() {
  const [splitMooneyBalance, setSplitMooneyBalance] = useState<any>()
  const [releasedMooney, setReleasedMooney] = useState<any>()
  const [isLoading, setIsLoading] = useState<boolean>(false)

  async function getBalances() {
    setIsLoading(true)
    const sdk = initSDK(Polygon)
    const mooneyContract = await sdk.getContract(
      MOONEY_ADDRESSES['polygon'],
      ERC20.abi
    )

    const splitBalance = await mooneyContract.call('balanceOf', [
      MARKETPLACE_FEE_SPLIT,
    ])
    const splitContract = await sdk.getContract(MARKETPLACE_FEE_SPLIT)

    const totalReleased = await splitContract.call('totalReleased', [
      MOONEY_ADDRESSES['polygon'],
    ])

    const formattedReleased = +ethers.utils.formatEther(
      totalReleased.toString()
    )

    const treasuryReleased = formattedReleased * 0.25
    const burnReleased = formattedReleased * 0.75

    setSplitMooneyBalance(+ethers.utils.formatEther(splitBalance.toString()))
    setReleasedMooney({ treasury: treasuryReleased, burn: burnReleased })
    setIsLoading(false)
  }

  useEffect(() => {
    getBalances()
  }, [])

  return { balance: splitMooneyBalance, released: releasedMooney, isLoading }
}
