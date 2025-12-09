import { useContext } from 'react'
import ChainContextV5 from '@/lib/thirdweb/chain-context-v5'
import Container from '../components/layout/Container'
import WebsiteHead from '../components/layout/Head'
import { NoticeFooter } from '@/components/layout/NoticeFooter'
import BuyMooneySection from '@/components/mooney/BuyMooneySection'
import NativeToMooney from '@/components/uniswap/NativeToMooney'

export default function GetMooney() {
  const { selectedChain } = useContext(ChainContextV5)

  return (
    <>
      <WebsiteHead
        title="Buy MOONEY - MoonDAO"
        description="Buy MOONEY tokens to participate in MoonDAO governance. Swap from various cryptocurrencies across multiple networks."
      />

      <Container is_fullwidth={true}>
        <div className="min-h-screen bg-dark-cool text-white w-full">
          <BuyMooneySection
            selectedChain={selectedChain}
            swapComponent={<NativeToMooney selectedChain={selectedChain} />}
          />

          {/* Footer */}
          <div className="flex justify-center w-full">
            <NoticeFooter
              defaultImage="../assets/MoonDAO-Logo-White.svg"
              defaultTitle="Need Help?"
              defaultDescription="Submit a ticket in the support channel on MoonDAO's Discord!"
              defaultButtonText="Submit a Ticket"
              defaultButtonLink="https://discord.com/channels/914720248140279868/1212113005836247050"
              imageWidth={200}
              imageHeight={200}
            />
          </div>
        </div>
      </Container>
    </>
  )
}
