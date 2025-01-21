import { useSigner } from '@thirdweb-dev/react'
import { SmartContract } from '@thirdweb-dev/sdk'
import { useCallback } from 'react'
import { prepareContractCall, sendAndConfirmTransaction } from 'thirdweb'
import { Account } from 'thirdweb/wallets'
import { useHandleRead } from '../thirdweb/hooks'
import { useHandleWrite } from '../thirdweb/hooks'

let gasLimits = {
  locked: 330000,
  create_lock: 600000,
  increase_amount: 600000,
  increase_unlock_time: 600000,
  withdraw: 400000,
}

export function useVMOONEYBalance(
  votingEscrowContract: SmartContract | undefined,
  address: string | undefined
) {
  return useHandleRead(votingEscrowContract, 'balanceOf', [address])
}

export function useVMOONEYLock(
  votingEscrowContract: SmartContract | undefined,
  address: string | undefined
) {
  return useHandleRead(votingEscrowContract, 'locked', [address])
}

export function useVMOONEYCreateLock(
  votingEscrowContract: SmartContract | undefined,
  amount: any,
  time: any
) {
  return useHandleWrite(votingEscrowContract, 'create_lock', [amount, time])
}

type CreateLockProps = {
  account: Account
  votingEscrowContract: any
  amount: any
  time: any
}

type IncreaseLockProps = {
  account: Account
  votingEscrowContract: any
  newAmount: any
  currentTime: any
  newTime: any
}

type WithdrawLockProps = {
  account: Account
  votingEscrowContract: any
}

export async function createLock({
  account,
  votingEscrowContract,
  amount,
  time,
}: CreateLockProps) {
  const transaction = prepareContractCall({
    contract: votingEscrowContract,
    method: 'create_lock' as string,
    params: [amount, time],
  })
  const receipt = await sendAndConfirmTransaction({
    transaction,
    account,
  })
  return receipt
}

export async function increaseLock({
  account,
  votingEscrowContract,
  newAmount,
  currentTime,
  newTime,
}: IncreaseLockProps) {
  let transaction
  if (newAmount && newAmount.gt(0)) {
    transaction = prepareContractCall({
      contract: votingEscrowContract,
      method: 'increase_amount' as string,
      params: [newAmount],
    })
  } else if (newTime && currentTime && newTime.gt(currentTime)) {
    transaction = prepareContractCall({
      contract: votingEscrowContract,
      method: 'increase_unlock_time' as string,
      params: [newTime],
    })
  } else {
    throw new Error('Invalid lock increase')
  }

  const receipt = await sendAndConfirmTransaction({
    transaction,
    account,
  })
  return receipt
}

export async function withdrawLock({
  account,
  votingEscrowContract,
}: WithdrawLockProps) {
  const transaction = prepareContractCall({
    contract: votingEscrowContract,
    method: 'withdraw' as string,
    params: [],
  })
  const receipt = await sendAndConfirmTransaction({
    transaction,
    account,
  })
  return receipt
}

export function useVMOONEYIncreaseLock({
  votingEscrowContract,
  newAmount,
  currentTime,
  newTime,
}: any) {
  const { mutateAsync: increaseLockAmount } = useVMOONEYIncreaseLockAmount(
    votingEscrowContract,
    newAmount
  )
  const { mutateAsync: increaseLockTime } = useVMOONEYIncreaseLockTime(
    votingEscrowContract,
    newTime
  )

  const action = useCallback(() => {
    if (newAmount && newAmount.gt(0)) {
      return { mutateAsync: increaseLockAmount }
    }
    if (newTime && currentTime && newTime.gt(currentTime)) {
      return { mutateAsync: increaseLockTime }
    }
    return {}
  }, [newAmount, currentTime, newTime])
  return action()
}

export function useVMOONEYIncreaseLockAmount(
  votingEscrowContract: SmartContract | undefined,
  amount: any
) {
  return useHandleWrite(votingEscrowContract, 'increase_amount', [amount])
}

export function useVMOONEYIncreaseLockTime(
  votingEscrowContract: SmartContract | undefined,
  time: any
) {
  return useHandleWrite(votingEscrowContract, 'increase_unlock_time', [time])
}

export function useVMOONEYWithdrawLock(
  votingEscrowContract: SmartContract | undefined
) {
  return useHandleWrite(votingEscrowContract, 'withdraw', [])
}

export function useVMOONEYSupply(
  votingEscrowContract: SmartContract | undefined
) {
  return useHandleRead(votingEscrowContract, 'totalSupply')
}

export function calculateVestingStart({
  MOONEYAmount,
  VMOONEYAmount,
  lockTime,
}: any) {
  const fourYears = 31556926000 * 4
  return lockTime - (VMOONEYAmount / MOONEYAmount) * fourYears
}

export function calculateVMOONEY({
  MOONEYAmount,
  VMOONEYAmount,
  time,
  lockTime,
  max,
}: any) {
  if (!MOONEYAmount) return 0

  const vestingStart = calculateVestingStart({
    MOONEYAmount,
    VMOONEYAmount,
    lockTime,
  })
  const percentage = (time - vestingStart) / (max - vestingStart)
  const finalVMOONEYAmount = MOONEYAmount * percentage || 0
  return finalVMOONEYAmount.toFixed(
    finalVMOONEYAmount > 1 || finalVMOONEYAmount === 0 ? 2 : 8
  )
}
