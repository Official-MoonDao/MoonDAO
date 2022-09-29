import { useCallback } from 'react'
import { vMOONEYToken } from '../lib/config'
import VotingEscrow from '../abis/VotingEscrow.json'
import { useContractRead, useContractWrite, useBalance } from './use-wagmi'

const contractParams = {
  addressOrName: vMOONEYToken,
  contractInterface: VotingEscrow.abi,
}

export function useVMOONEYBalance(address: any) {
  return useBalance({
    addressOrName: address,
    token: vMOONEYToken,
    watch: true,
    enabled: address,
  })
}

let gasLimits = {
  locked: 330000,
  create_lock: 600000,
  increase_amount: 600000,
  increase_unlock_time: 600000,
  withdraw: 400000,
}

export function useVMOONEYLock(address: any) {
  return useContractRead(contractParams, 'locked', {
    args: [address],
    watch: true,
    enabled: !!address,
    overrides: {
      gasLimit: gasLimits.locked,
    },
  })
}

export function useVMOONEYCreateLock(amount: any, time: any) {
  return useContractWrite(contractParams, 'create_lock', {
    args: [amount, time],
    overrides: {
      gasLimit: gasLimits.create_lock,
    },
  })
}

export function useVMOONEYIncreaseLock({
  newAmount,
  currentTime,
  newTime,
}: any) {
  const { writeAsync: increaseLockAmount, data: lockAmountData } =
    useVMOONEYIncreaseLockAmount(newAmount)
  const { writeAsync: increaseLockTime, data: lockTimeData } =
    useVMOONEYIncreaseLockTime(newTime)
  const action = useCallback(() => {
    if (newAmount && newAmount.gt(0)) {
      return { writeAsync: increaseLockAmount, data: lockAmountData }
    }
    if (newTime && currentTime && newTime.gt(currentTime)) {
      return { writeAsync: increaseLockTime, data: lockTimeData }
    }
    return {}
  }, [newAmount, currentTime, newTime])

  return action()
}

export function useVMOONEYIncreaseLockAmount(amount: any) {
  return useContractWrite(contractParams, 'increase_amount', {
    args: [amount],
    overrides: {
      gasLimit: gasLimits.increase_amount,
    },
  })
}

export function useVMOONEYIncreaseLockTime(time: any) {
  return useContractWrite(contractParams, 'increase_unlock_time', {
    args: [time],
    overrides: {
      gasLimit: gasLimits.increase_unlock_time,
    },
  })
}

export function useVMOONEYWithdrawLock() {
  return useContractWrite(contractParams, 'withdraw', {
    overrides: {
      gasLimit: gasLimits.withdraw,
    },
  })
}

export function useVMOONEYSupply() {
  return useContractRead(contractParams, 'totalSupply()', {})
}
