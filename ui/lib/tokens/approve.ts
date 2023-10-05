import { SmartContract } from '@thirdweb-dev/sdk'
import { BigNumber } from 'ethers'
import { useMemo } from 'react'
import { useHandleRead } from '../thirdweb/hooks'
import { useHandleWrite } from '../thirdweb/hooks'

export function useTokenAllowance(
  tokenContract: SmartContract | undefined,
  address: string | undefined,
  spender: string
) {
  return useHandleRead(tokenContract, 'allowance', [address, spender])
}

export function useTokenApproval(
  tokenContract: SmartContract | undefined,
  amountNeeded: BigNumber | undefined,
  lockedMooney: BigNumber | undefined,
  spender: string
) {
  const neededAllowance = useMemo(() => {
    if (lockedMooney && amountNeeded) {
      return amountNeeded?.sub(lockedMooney)
    }
    return amountNeeded
  }, [lockedMooney, amountNeeded])

  return useHandleWrite(tokenContract, 'approve', [spender, neededAllowance])
}
