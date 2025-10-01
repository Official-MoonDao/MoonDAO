import ERC20 from 'const/abis/ERC20.json'
import VMooneyFaucetAbi from 'const/abis/VMooneyFaucet.json'
import VotingEscrow from 'const/abis/VotingEscrow.json'
import VotingEscrowDepositor from 'const/abis/VotingEscrowDepositor.json'
import {
  MOONEY_ADDRESSES,
  VMOONEY_ADDRESSES,
  VOTING_ESCROW_DEPOSITOR_ADDRESSES,
  VMOONEY_FAUCET_ADDRESSES,
  MOONEY_DECIMALS,
} from 'const/config'
import { BigNumber, utils } from 'ethers'
import { useContext, useState, useEffect, useCallback } from 'react'
import toast from 'react-hot-toast'
import { prepareContractCall, sendAndConfirmTransaction } from 'thirdweb'
import { useActiveAccount } from 'thirdweb/react'
import toastStyle from '@/lib/marketplace/marketplace-utils/toastConfig'
import { getChainSlug } from '@/lib/thirdweb/chain'
import ChainContextV5 from '@/lib/thirdweb/chain-context-v5'
import useContract from '@/lib/thirdweb/hooks/useContract'
import useRead from '@/lib/thirdweb/hooks/useRead'
import { approveToken } from '@/lib/tokens/approve'
import { createLock, increaseLock } from '@/lib/tokens/ve-token'
import { dateOut } from '@/lib/utils/dates'
import useWithdrawAmount from '@/lib/utils/hooks/useWithdrawAmount'

export type UseRetroactiveRewardsReturn = {
  withdrawable: BigNumber
  hasLock: boolean | undefined
  hasMoreThan36Months: boolean
  VMOONEYLock: any
  mooneyBalance: any
  vMooneyBalance: any
  mooneyAllowance: any
  VMOONEYLockLoading: boolean
  mooneyAllowanceLoading: boolean
  withdraw: () => Promise<void>
  contracts: {
    votingEscrowDepositorContract: any
    vMooneyFaucetContract: any
    vMooneyContract: any
    mooneyContract: any
  }
}

export default function useRetroactiveRewards(): UseRetroactiveRewardsReturn {
  const account = useActiveAccount()
  const address = account?.address

  const { selectedChain } = useContext(ChainContextV5)
  const chainSlug = getChainSlug(selectedChain)

  const votingEscrowDepositorContract = useContract({
    address: VOTING_ESCROW_DEPOSITOR_ADDRESSES[chainSlug],
    abi: VotingEscrowDepositor.abi,
    chain: selectedChain,
  })
  const vMooneyFaucetContract = useContract({
    address: VMOONEY_FAUCET_ADDRESSES[chainSlug],
    abi: VMooneyFaucetAbi.abi,
    chain: selectedChain,
  })
  const vMooneyContract = useContract({
    address: VMOONEY_ADDRESSES[chainSlug],
    abi: VotingEscrow,
    chain: selectedChain,
  })
  const mooneyContract = useContract({
    address: MOONEY_ADDRESSES[chainSlug],
    abi: ERC20,
    chain: selectedChain,
  })

  const withdrawable = useWithdrawAmount(votingEscrowDepositorContract, address)

  const { data: VMOONEYLock, isLoading: VMOONEYLockLoading } = useRead({
    contract: vMooneyContract,
    method: 'locked' as string,
    params: [address],
  })

  const { data: mooneyAllowance, isLoading: mooneyAllowanceLoading } = useRead({
    contract: mooneyContract,
    method: 'allowance' as string,
    params: [address, VMOONEY_ADDRESSES[chainSlug]],
  })

  const { data: mooneyBalance } = useRead({
    contract: mooneyContract,
    method: 'balanceOf' as string,
    params: [address],
  })

  const { data: vMooneyBalance } = useRead({
    contract: vMooneyContract,
    method: 'balanceOf' as string,
    params: [address],
  })

  const [hasLock, setHasLock] = useState<boolean>()
  useEffect(() => {
    !VMOONEYLockLoading && setHasLock(VMOONEYLock && VMOONEYLock[0] != 0)
  }, [VMOONEYLock, VMOONEYLockLoading, address])

  // 3 years ~ 36 months
  const [hasMoreThan36Months, setHasMoreThan36Months] = useState<boolean>(false)
  const thirtySixMonths = 36 * 30 * 24 * 60 * 60 * 1000
  useEffect(() => {
    !VMOONEYLockLoading &&
      setHasMoreThan36Months(
        VMOONEYLock &&
          VMOONEYLock[1] != 0 &&
          BigNumber.from(+new Date() + thirtySixMonths).lte(
            VMOONEYLock?.[1].toString() * 1000
          )
      )
  }, [VMOONEYLock, VMOONEYLockLoading, address, thirtySixMonths])

  const withdraw = useCallback(async () => {
    if (!account) {
      toast.error('Please connect your wallet.', { style: toastStyle })
      return
    }
    try {
      const millisecondsPerSecond = 1000
      const fourYearsOut = BigNumber.from(
        +dateOut(new Date(), { days: 1461 })
      ).div(millisecondsPerSecond)

      if (Number(vMooneyBalance) === 0) {
        if (Number(mooneyBalance) === 0) {
          const dripTx = prepareContractCall({
            contract: vMooneyFaucetContract,
            method: 'drip' as string,
            params: [],
          })
          await sendAndConfirmTransaction({ transaction: dripTx, account })
        }

        const initialLockAmount = utils.parseUnits('1', MOONEY_DECIMALS)
        const currentAllowance = BigNumber.from(mooneyAllowance || 0)
        if (currentAllowance.lt(initialLockAmount)) {
          await approveToken({
            account,
            tokenContract: mooneyContract,
            spender: VMOONEY_ADDRESSES[chainSlug],
            allowance: initialLockAmount,
          })
        }

        await createLock({
          account,
          votingEscrowContract: vMooneyContract,
          amount: initialLockAmount,
          time: fourYearsOut,
        })
      }

      if (!hasMoreThan36Months) {
        await increaseLock({
          account,
          votingEscrowContract: vMooneyContract,
          currentTime: VMOONEYLock && VMOONEYLock[1],
          newAmount: utils.parseUnits('0', MOONEY_DECIMALS),
          newTime: fourYearsOut,
        })
      }

      const mooneyAllowanceBigNum = BigNumber.from(mooneyAllowance)
      const withdrawableBigNum = BigNumber.from(withdrawable.toString())

      if (mooneyAllowanceLoading) {
        toast.error('Fetching allowance, please try again in a moment.', {
          style: toastStyle,
        })
        return
      }

      if (
        mooneyAllowanceBigNum &&
        withdrawableBigNum &&
        mooneyAllowanceBigNum.lt(withdrawableBigNum)
      ) {
        const allowance = withdrawableBigNum
        await approveToken({
          account,
          tokenContract: mooneyContract,
          spender: VMOONEY_ADDRESSES[chainSlug],
          allowance: allowance,
        })
      }

      const withdrawTx = prepareContractCall({
        contract: votingEscrowDepositorContract,
        method: 'withdraw' as string,
        params: [],
      })

      const withdrawReceipt = await sendAndConfirmTransaction({
        transaction: withdrawTx,
        account,
      })

      if (withdrawReceipt) {
        toast.success('Withdrawal successful!', {
          style: toastStyle,
        })
      }
    } catch (error: any) {
      console.error(error)
      if (!hasMoreThan36Months) {
        toast.error(
          'Failed to extend your lock. Please ensure your lock duration is at least 3 years.',
          {
            style: toastStyle,
          }
        )
      } else {
        toast.error(error?.message || 'Error withdrawing. Please try again.', {
          style: toastStyle,
        })
      }
    }
  }, [
    account,
    vMooneyBalance,
    mooneyBalance,
    mooneyAllowance,
    hasMoreThan36Months,
    VMOONEYLock,
    withdrawable,
    mooneyAllowanceLoading,
    vMooneyFaucetContract,
    mooneyContract,
    vMooneyContract,
    votingEscrowDepositorContract,
    chainSlug,
  ])

  return {
    withdrawable,
    hasLock,
    hasMoreThan36Months,
    VMOONEYLock,
    mooneyBalance,
    vMooneyBalance,
    mooneyAllowance,
    VMOONEYLockLoading,
    mooneyAllowanceLoading,
    withdraw,
    contracts: {
      votingEscrowDepositorContract,
      vMooneyFaucetContract,
      vMooneyContract,
      mooneyContract,
    },
  }
}
