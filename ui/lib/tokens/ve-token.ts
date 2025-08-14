import { prepareContractCall, sendAndConfirmTransaction } from 'thirdweb'
import { Account } from 'thirdweb/wallets'

let gasLimits = {
  locked: 330000,
  create_lock: 600000,
  increase_amount: 600000,
  increase_unlock_time: 600000,
  withdraw: 400000,
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
  if (!MOONEYAmount) return '0.00'

  const vestingStart = calculateVestingStart({
    MOONEYAmount,
    VMOONEYAmount,
    lockTime,
  })
  const percentage = (time - vestingStart) / (max - vestingStart)
  const finalVMOONEYAmount = MOONEYAmount * percentage || 0
  
  // Format with commas and exactly 2 decimals
  return finalVMOONEYAmount.toLocaleString('en-US', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })
}
