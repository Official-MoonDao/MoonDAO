import { SmartContract } from '@thirdweb-dev/sdk'
import { BigNumber } from 'ethers'
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
  amountNeeded: any,
  spender: string
) {
  return useHandleWrite(tokenContract, 'approve', [spender, amountNeeded])
}
