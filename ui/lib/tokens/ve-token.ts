import { useSigner } from '@thirdweb-dev/react'
import { SmartContract } from '@thirdweb-dev/sdk'
import { useCallback } from 'react'
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
