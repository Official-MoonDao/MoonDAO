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
import Image from 'next/image'
import { useRouter } from 'next/router'
import React, { useContext, useState, useEffect } from 'react'
import toast from 'react-hot-toast'
import { prepareContractCall, sendAndConfirmTransaction } from 'thirdweb'
import { useActiveAccount } from 'thirdweb/react'
import toastStyle from '@/lib/marketplace/marketplace-utils/toastConfig'
import useWindowSize from '@/lib/team/use-window-size'
import { getChainSlug } from '@/lib/thirdweb/chain'
import ChainContextV5 from '@/lib/thirdweb/chain-context-v5'
import { useChainDefault } from '@/lib/thirdweb/hooks/useChainDefault'
import useContract from '@/lib/thirdweb/hooks/useContract'
import useRead from '@/lib/thirdweb/hooks/useRead'
import { approveToken } from '@/lib/tokens/approve'
import { createLock, increaseLock } from '@/lib/tokens/ve-token'
import { dateOut } from '@/lib/utils/dates'
import useWithdrawAmount from '@/lib/utils/hooks/useWithdrawAmount'
import Asset from '@/components/dashboard/treasury/balance/Asset'
import StandardButton from '@/components/layout/StandardButton'

export default function WithdrawVMooney() {
  useChainDefault()
  const router = useRouter()

  const account = useActiveAccount()
  const address = account?.address

  const { selectedChain } = useContext(ChainContextV5)
  const chainSlug = getChainSlug(selectedChain)

  //Contracts
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
  const { isMobile } = useWindowSize()

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

  const handleWithdraw = async () => {
    try {
      if (!account) throw new Error('No account found')
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
          const dripReceipt = await sendAndConfirmTransaction({
            transaction: dripTx,
            account,
          })
        }
        await createLock({
          account,
          votingEscrowContract: vMooneyContract,
          amount: utils.parseUnits('1', MOONEY_DECIMALS),
          time: fourYearsOut,
        })
      }
      if (!hasMoreThan36Months) {
        await increaseLock({
          account,
          votingEscrowContract: vMooneyContract,
          currentTime: VMOONEYLock && VMOONEYLock[1],
          newAmount: utils.parseUnits('0', MOONEY_DECIMALS), // increase time, not amount
          newTime: fourYearsOut,
        })
      }
      const mooneyAllowanceBigNum = BigNumber.from(mooneyAllowance)
      const withdrawableBigNum = BigNumber.from(withdrawable.toString())
      if (mooneyAllowanceLoading) throw new Error('Loading...')
      if (
        mooneyAllowanceBigNum &&
        withdrawableBigNum &&
        mooneyAllowanceBigNum.lt(withdrawableBigNum)
      ) {
        const allowance = withdrawableBigNum.sub(mooneyAllowanceBigNum)
        const approveReceipt = await approveToken({
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
        setTimeout(() => {
          router.reload()
        }, 5000)
      }
    } catch (error) {
      console.error('Error withdrawing:', error)
      toast.error('Error withdrawing. Please try again.', {
        style: toastStyle,
      })
    }
  }

  return (
    <div className="flex flex-col md:flex-row gap-4">
      <div className="flex flex-col gap-4 bg-dark-cool p-4">
        <div className="flex gap-2">
          <Image
            src="/assets/vmooney-shield.svg"
            alt="vMOONEY"
            width={24}
            height={24}
          />
          <p className="text-light-warm brightness-150 font-bold">vMOONEY</p>
        </div>
        <p className="text-2xl">
          {String(
            (Number(withdrawable) / 10 ** MOONEY_DECIMALS).toLocaleString()
          )}
        </p>
        <StandardButton
          className="gradient-2 rounded-full"
          onClick={handleWithdraw}
          disabled={Number(withdrawable) === 0}
          data-tip="You dont have any vMOONEY to withdraw"
        >
          Withdraw Rewards
        </StandardButton>
      </div>

      <div className="flex flex-col gap-4 bg-dark-cool p-4 max-w-[700px]">
        <h1 className="text-2xl font-GoodTimes">You have unclaimed rewards!</h1>
        <p>{`Click the 'Withdraw Rewards' button to claim your vMOONEY rewards and increase your voting impact! You'll be prompted to create or increase the duration of your lock to 4 years. Expect to sign 2-4 transactions.`}</p>
        <p>{`Increase your stake amount or duration at any time on this page for greater impact!`}</p>
      </div>
    </div>
  )
}
