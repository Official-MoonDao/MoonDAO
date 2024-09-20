import { Ethereum } from '@thirdweb-dev/chains'
import { useContext, useEffect } from 'react'
import ChainContext from '@/lib/thirdweb/chain-context'
import Container from '@/components/layout/Container'
import ContentLayout from '@/components/layout/ContentLayout'
import Frame from '@/components/layout/Frame'
import Head from '@/components/layout/Head'
import { NoticeFooter } from '@/components/layout/NoticeFooter'
import NetworkSelector from '@/components/thirdweb/NetworkSelector'
import NativeToMooney from '@/components/uniswap/NativeToMooney'

export default function Swap() {
  const { selectedChain, setSelectedChain } = useContext<any>(ChainContext)

  useEffect(() => {
    setSelectedChain(Ethereum)
  }, [])

  const descriptionSection = (
    <div>
      <Frame
        bottomLeft="20px"
        topLeft="5vmax"
        marginBottom="30px"
        marginTop="30px"
        noPadding
      ></Frame>
    </div>
  )

  return (
    <section id="jobs-container" className="overflow-hidden">
      <Head title="Swap" image="" />
      <Container>
        <ContentLayout
          header="Swap"
          headerSize="max(20px, 3vw)"
          description={descriptionSection}
          preFooter={<NoticeFooter />}
          mainPadding
          mode="compact"
          popOverEffect={false}
          isProfile
        >
          <NetworkSelector />

          <NativeToMooney selectedChain={selectedChain} />
        </ContentLayout>
      </Container>
    </section>
  )
}
