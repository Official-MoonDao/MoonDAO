import { useContract } from '@thirdweb-dev/react'
import { MOONEY_ADDRESSES, VMOONEY_ADDRESSES } from 'const/config'
import { ethers } from 'ethers'
import { useContext, useState } from 'react'
import ChainContext from '@/lib/thirdweb/chain-context'
import { useTokenApproval } from '@/lib/tokens/approve'
import Container from '@/components/layout/Container'
import ContentLayout from '@/components/layout/ContentLayout'
import Head from '@/components/layout/Head'
import { NoticeFooter } from '@/components/layout/NoticeFooter'
import StandardButton from '@/components/layout/StandardButton'

export default function Approve() {
  const { selectedChain } = useContext(ChainContext)

  const { contract: mooneyContract } = useContract(
    MOONEY_ADDRESSES[selectedChain.slug]
  )

  const [approvalAmount, setApprovalAmount] = useState('0')
  const { mutateAsync: approveToken } = useTokenApproval(
    mooneyContract,
    ethers.utils.parseEther(approvalAmount || '0'),
    ethers.BigNumber.from(0),
    VMOONEY_ADDRESSES[selectedChain.slug]
  )
  return (
    <section id="map-container" className="overflow-hidden">
      <Head title="Approve" />
      <Container>
        <ContentLayout
          header="Approve"
          headerSize="max(20px, 3vw)"
          description=""
          preFooter={<NoticeFooter />}
          mainPadding
          mode="compact"
          popOverEffect={false}
          isProfile
        >
          <div className="w-full flex flex-col inline-block md:mr-12 rounded-lg z-[100] min-h-[50vh] bg-dark-cool">
            <input
              className="text-black w-[300px]"
              value={approvalAmount}
              onChange={(e) => setApprovalAmount(e.target.value)}
            />
            <StandardButton
              className="mt-4 gradient-2"
              onClick={() => approveToken()}
            >
              Approve Mooney for vMooney Contract
            </StandardButton>
          </div>
        </ContentLayout>
      </Container>
    </section>
  )
}
