import { SmartContract } from '@thirdweb-dev/sdk'
import { BigNumber } from 'ethers'
import { useMemo } from 'react'
import { prepareContractCall, sendAndConfirmTransaction } from 'thirdweb'
import { Account } from 'thirdweb/wallets'
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

type ApproveTokenProps = {
  account: Account
  tokenContract: any
  spender: string
  allowance: BigNumber | undefined
}

type RevokeAllowanceProps = {
  account: Account
  tokenContract: any
  spender: string
}

export async function approveToken({
  account,
  tokenContract,
  spender,
  allowance,
}: ApproveTokenProps) {
  const transaction = prepareContractCall({
    contract: tokenContract,
    method: 'approve' as string,
    params: [spender, allowance],
  })

  const receipt = await sendAndConfirmTransaction({
    transaction,
    account,
  })

  return receipt
}

export async function revokeAllowance({
  account,
  tokenContract,
  spender,
}: RevokeAllowanceProps) {
  const transaction = prepareContractCall({
    contract: tokenContract,
    method: 'approve' as string,
    params: [spender, BigNumber.from('0')],
  })

  const receipt = await sendAndConfirmTransaction({
    transaction,
    account,
  })

  return receipt
}
