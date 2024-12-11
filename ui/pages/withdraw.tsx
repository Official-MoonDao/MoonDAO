import { Arbitrum, Sepolia } from '@thirdweb-dev/chains'
import { useAddress, useContract } from '@thirdweb-dev/react'
import ERC20 from 'const/abis/ERC20.json'
import {
  MOONEY_ADDRESSES,
  VMOONEY_ADDRESSES,
  VOTING_ESCROW_DEPOSITOR_ADDRESSES,
  MOONEY_DECIMALS,
} from 'const/config'
import { BigNumber } from 'ethers'
import { useRouter } from 'next/router'
import React, { useContext } from 'react'
import toast from 'react-hot-toast'
import toastStyle from '../lib/marketplace/marketplace-utils/toastConfig'
import useWindowSize from '@/lib/team/use-window-size'
import ChainContext from '@/lib/thirdweb/chain-context'
import useWithdrawAmount from '@/lib/utils/hooks/useWithdrawAmount'
import Container from '../components/layout/Container'
import ContentLayout from '../components/layout/ContentLayout'
import WebsiteHead from '../components/layout/Head'
import StandardButton from '../components/layout/StandardButton'
import Asset from '@/components/dashboard/treasury/balance/Asset'
import { NoticeFooter } from '@/components/layout/NoticeFooter'
import NetworkSelector from '@/components/thirdweb/NetworkSelector'

export default function Withdraw() {
  const userAddress = useAddress()
  const router = useRouter()
  const chain = process.env.NEXT_PUBLIC_CHAIN === 'mainnet' ? Arbitrum : Sepolia
  const { contract: votingEscrowDepositorContract } = useContract(
    VOTING_ESCROW_DEPOSITOR_ADDRESSES[chain.slug]
  )
  const { contract: mooneyContract } = useContract(
    MOONEY_ADDRESSES[chain.slug],
    ERC20.abi
  )
  const withdrawable = useWithdrawAmount(
    votingEscrowDepositorContract,
    userAddress
  )
  const { isMobile } = useWindowSize()

  const handleWithdraw = async () => {
    try {
      await mooneyContract?.call('approve', [
        VMOONEY_ADDRESSES[chain.slug],
        withdrawable.toString(),
      ])
      await votingEscrowDepositorContract?.call('withdraw')
      toast.success('Withdrawal successful!', {
        style: toastStyle,
      })
      setTimeout(() => {
        router.reload()
      }, 5000)
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
            description={'Withdraw VMOONEY rewards.'}
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
                  amount={String((withdrawable / MOONEY_DECIMALS).toFixed(2))}
                  usd=""
                />
              </section>
              {userAddress && (
                <StandardButton
                  className="gradient-2 rounded-full"
                  onClick={handleWithdraw}
                  disabled={withdrawable === 0}
                >
                  Withdraw Rewards
                </StandardButton>
              )}
            </div>
          </ContentLayout>
        </Container>
      </section>
    </>
  )
}
