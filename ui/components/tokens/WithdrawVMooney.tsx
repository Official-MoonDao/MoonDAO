import ERC20 from 'const/abis/ERC20.json'
import VMooneyFaucetAbi from 'const/abis/VMooneyFaucet.json'
import VotingEscrow from 'const/abis/VotingEscrow.json'
import VotingEscrowDepositor from 'const/abis/VotingEscrowDepositor.json'
import {
  MOONEY_ADDRESSES,
  VMOONEY_ADDRESSES,
  VOTING_ESCROW_DEPOSITOR_ADDRESSES,
  DEFAULT_CHAIN_V5,
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
import { PrivyWeb3Button } from '@/components/privy/PrivyWeb3Button'

export default function WithdrawVMooney() {
  useChainDefault()
  const router = useRouter()

  const account = useActiveAccount()
  const address = account?.address

  const { selectedChain } = useContext(ChainContextV5)
  const chainSlug = getChainSlug(selectedChain)
  const chain = DEFAULT_CHAIN_V5

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
          newAmount: utils.parseUnits('0', MOONEY_DECIMALS), // increase time, not amount
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
  }

  //Hide component if user has no vMOONEY to withdraw
  if (Number(withdrawable) <= 0) {
    return null
  }

  return (
    <div className="mb-6">
      <div className="bg-gradient-to-br from-gray-900 via-blue-900/30 to-purple-900/20 backdrop-blur-xl border border-white/10 shadow-2xl rounded-2xl overflow-hidden">
        <div className="p-5">
          <div className="flex flex-col md:flex-row gap-6">
            {/* Rewards Amount Section */}
            <div className="flex-1">
              <div className="flex items-center gap-3 mb-4">
                <div className="w-10 h-10 rounded-full bg-green-500/20 flex items-center justify-center">
                  <Image
                    src="/assets/vmooney-shield.svg"
                    alt="vMOONEY"
                    width={20}
                    height={20}
                  />
                </div>
                <div>
                  <p className="text-gray-400 text-sm">Unclaimed Rewards</p>
                  <p className="text-white text-lg font-medium">
                    vMOONEY Available
                  </p>
                </div>
              </div>

              <div className="bg-black/20 rounded-xl p-4 border border-white/5 mb-4">
                <div className="text-center">
                  <p className="text-green-400 text-3xl font-RobotoMono font-bold mb-2">
                    {String(
                      (
                        Number(withdrawable) /
                        10 ** MOONEY_DECIMALS
                      ).toLocaleString()
                    )}
                  </p>
                  <p className="text-gray-400 text-sm">vMOONEY Tokens</p>
                </div>
              </div>

              <PrivyWeb3Button
                className="w-full bg-gradient-to-r from-green-500 to-emerald-600 hover:from-green-600 hover:to-emerald-700 text-white py-3 px-6 rounded-xl text-base font-semibold transition-all duration-200 transform hover:scale-[1.01] shadow-lg disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:scale-100"
                action={handleWithdraw}
                isDisabled={Number(withdrawable) === 0}
                requiredChain={chain}
                label="Withdraw Rewards"
              />
            </div>

            {/* Information Section */}
            <div className="flex-1 bg-black/10 rounded-xl p-4 border border-white/5">
              <h3 className="text-lg font-bold text-white mb-3">
                💰 Claim Your Rewards!
              </h3>
              <div className="space-y-3 text-sm text-gray-300">
                <p>
                  Click 'Withdraw Rewards' to claim your vMOONEY rewards and
                  increase your voting impact!
                </p>
                <p>
                  You'll be prompted to create or increase the duration of your
                  lock to 4 years. Expect to sign 2-4 transactions.
                </p>
                <p className="text-blue-400">
                  💡 Increase your stake amount or duration at any time for
                  greater impact!
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
