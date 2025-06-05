import FeeHook from 'const/abis/FeeHook.json'
import { FEE_HOOK_ADDRESSES } from 'const/config'
import { BigNumber, ethers } from 'ethers'
import { useRouter } from 'next/router'
import React, { useContext, useState, useEffect } from 'react'
import toast from 'react-hot-toast'
import {
  prepareContractCall,
  simulateTransaction,
  sendAndConfirmTransaction,
} from 'thirdweb'
import { useActiveAccount } from 'thirdweb/react'
import toastStyle from '../lib/marketplace/marketplace-utils/toastConfig'
import useETHPrice from '@/lib/etherscan/useETHPrice'
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
import Asset from '@/components/dashboard/treasury/balance/Asset'
import { NoticeFooter } from '@/components/layout/NoticeFooter'
import { PrivyWeb3Button } from '@/components/privy/PrivyWeb3Button'
import NetworkSelector from '@/components/thirdweb/NetworkSelector'

export default function Withdraw() {
  useChainDefault()
  const router = useRouter()

  const account = useActiveAccount()
  const address = account?.address
  const { data: ethPrice } = useETHPrice(1, 'ETH_TO_USD')

  const { selectedChain } = useContext(ChainContextV5)
  const chainSlug = getChainSlug(selectedChain)

  const feeHookContract = useContract({
    address: FEE_HOOK_ADDRESSES[chainSlug],
    abi: FeeHook.abi,
    chain: selectedChain,
  })
  const { isMobile } = useWindowSize()

  const [withdrawableFees, setWithdrawableFees] = useState<BigNumber>(
    BigNumber.from(0)
  )

  useEffect(() => {
    const fetchWithdrawableFees = async () => {
      if (!feeHookContract || !address) return

      try {
        const withdrawTx = prepareContractCall({
          contract: feeHookContract,
          method: 'withdrawFees' as string,
          params: [],
        })
        const fees = await simulateTransaction({
          transaction: withdrawTx,
          account: account,
        })

        setWithdrawableFees(BigNumber.from(fees))
      } catch (error) {
        console.error('Error fetching withdrawable fees:', error)
      }
    }
    fetchWithdrawableFees()
  }, [feeHookContract, address])

  const handleWithdrawFees = async () => {
    try {
      if (!account) throw new Error('No account found')
      const withdrawTx = prepareContractCall({
        contract: feeHookContract,
        method: 'withdrawFees' as string,
        params: [],
      })
      const withdrawReceipt = await sendAndConfirmTransaction({
        transaction: withdrawTx,
        account,
      })
      if (withdrawReceipt) {
        toast.success('Withdrawal submitted!', {
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
        description={'Withdraw liquidity fees.'}
      />
      <section className="w-[calc(100vw-20px)]">
        <Container>
          <ContentLayout
            header={'Withdraw Rewards'}
            headerSize="max(20px, 3vw)"
            description={'Withdraw liquidity fees.'}
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
                  name="ETH"
                  amount={parseFloat(
                    ethers.utils.formatEther(withdrawableFees)
                  ).toFixed(5)}
                  usd={(
                    parseFloat(ethers.utils.formatEther(withdrawableFees)) *
                    ethPrice
                  ).toFixed(2)}
                />
              </section>
              <PrivyWeb3Button
                action={handleWithdrawFees}
                label="Withdraw Fees"
                className="mt-2 rounded-[5vmax] rounded-tl-[20px]"
                isDisabled={!withdrawableFees.gt(0) || !address}
              />
            </div>
          </ContentLayout>
        </Container>
      </section>
    </>
  )
}
