import MissionTokenSwapV4 from '@/components/uniswap/MissionTokenSwapV4'
import Container from '@/components/layout/Container'
import ContentLayout from '@/components/layout/ContentLayout'
import WebsiteHead from '@/components/layout/Head'

const demoToken = {
  tokenAddress: '0x0000000000000000000000000000000000000000',
  tokenSymbol: 'TOKEN',
  tokenDecimals: 18,
}

export default function MissionTokenSwapPage() {
  return (
    <>
      <WebsiteHead title="Swap Mission Token" description="Swap using Uniswap V4" />
      <Container containerwidth={true}>
        <ContentLayout header="Swap Mission Token" mainPadding>
          <div className="flex justify-center">
            <MissionTokenSwapV4 token={demoToken} />
          </div>
        </ContentLayout>
      </Container>
    </>
  )
}
