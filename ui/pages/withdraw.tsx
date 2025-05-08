import ERC20 from 'const/abis/ERC20.json'
import VotingEscrow from 'const/abis/VotingEscrow.json'
import VMooneyFaucetAbi from 'const/abis/VMooneyFaucet.json'
import VotingEscrowDepositor from 'const/abis/VotingEscrowDepositor.json'
import { createLock, increaseLock } from '../lib/tokens/ve-token'
import { dateOut } from '../lib/utils/dates'
import {
  MOONEY_ADDRESSES,
  VMOONEY_ADDRESSES,
  VOTING_ESCROW_DEPOSITOR_ADDRESSES,
  VMOONEY_FAUCET_ADDRESSES,
  MOONEY_DECIMALS,
  DEFAULT_CHAIN_V5,
} from 'const/config'
import { BigNumber } from 'ethers'
import { useRouter } from 'next/router'
import React, { useContext, useState, useEffect } from 'react'
import toast from 'react-hot-toast'
import { prepareContractCall, sendAndConfirmTransaction } from 'thirdweb'
import { useActiveAccount } from 'thirdweb/react'
import toastStyle from '../lib/marketplace/marketplace-utils/toastConfig'
import useWindowSize from '@/lib/team/use-window-size'
import { getChainSlug } from '@/lib/thirdweb/chain'
import ChainContextV5 from '@/lib/thirdweb/chain-context-v5'
import { useChainDefault } from '@/lib/thirdweb/hooks/useChainDefault'
import useContract from '@/lib/thirdweb/hooks/useContract'
import useRead from '@/lib/thirdweb/hooks/useRead'
import { approveToken } from '@/lib/tokens/approve'
import useWithdrawAmount from '@/lib/utils/hooks/useWithdrawAmount'
import Container from '../components/layout/Container'
import ContentLayout from '../components/layout/ContentLayout'
import WebsiteHead from '../components/layout/Head'
import StandardButton from '../components/layout/StandardButton'
import Asset from '@/components/dashboard/treasury/balance/Asset'
import { NoticeFooter } from '@/components/layout/NoticeFooter'
import { PrivyWeb3Button } from '@/components/privy/PrivyWeb3Button'
import NetworkSelector from '@/components/thirdweb/NetworkSelector'

export default function Withdraw() {
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

  // 3.75 years ~ 45 months
  const [hasMoreThan45Months, setHasMoreThan45Months] = useState<boolean>(false)
  const fortyFiveMonths = 45 * 30 * 24 * 60 * 60 * 1000
  useEffect(() => {
    !VMOONEYLockLoading &&
      setHasMoreThan45Months(
        VMOONEYLock &&
          VMOONEYLock[1] != 0 &&
          BigNumber.from(+new Date() + fortyFiveMonths).lte(
            VMOONEYLock?.[1].toString() * 1000
          )
      )
  }, [VMOONEYLock, VMOONEYLockLoading, address, fortyFiveMonths])

  const handleWithdraw = async () => {
    try {
      const fourYearsOut = ethers.BigNumber.from(
        dateOut(new Date(), { days: 1461 })
      )
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
          amount: ethers.utils.parseUnits('1', MOONEY_DECIMALS),
          unlockTime: fourYearsOut,
        })
      }
      if (hasLessThan45Months) {
        await increaseLock({
          account,
          votingEscrowContract: vMooneyContract,
          currentTime: VMOONEYLock && VMOONEYLock[1],
          newTime: fourYearsOut,
        })
      }
      const mooneyAllowanceBigNum = BigNumber.from(mooneyAllowance)
      const withdrawableBigNum = BigNumber.from(withdrawable.toString())
      if (!account) throw new Error('No account found')
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
    <>
      <WebsiteHead
        title={'Withdraw'}
        description={'Withdraw vMOONEY rewards.'}
      />
      <section className="w-[calc(100vw-20px)]">
        <Container>
          <ContentLayout
            header={'Withdraw Rewards'}
            headerSize="max(20px, 3vw)"
            description={
              "Withdraw vMOONEY rewards. To complete your withdrawal, ensure you have an existing vMOONEY lock. You'll need to sign two transactions: one for approval and one to execute the withdrawal."
            }
            preFooter={<NoticeFooter />}
            mainPadding
            isProfile
            mode="compact"
            popOverEffect={false}
          >
            <div className="mt-3 w-full">
              <section
                className={`py-4 mt-8 flex flex-col ${isMobile ? '' : 'w-1/3'}`}
              >
                <Asset
                  name="vMOONEY"
                  amount={String(
                    (Number(withdrawable) / MOONEY_DECIMALS).toFixed(2)
                  )}
                  usd=""
                />
              </section>
              <StandardButton
                className="gradient-2 rounded-full"
                onClick={handleWithdraw}
                //disabled={Number(withdrawable) === 0}
                data-tip="You dont have any vMOONEY to withdraw"
              >
                Withdraw Rewards
              </StandardButton>
            </div>
          </ContentLayout>
        </Container>
      </section>
    </>
  )
}
