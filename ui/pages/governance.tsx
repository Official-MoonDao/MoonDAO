import { usePrivy } from '@privy-io/react-auth'
import dynamic from 'next/dynamic'
import React, { useEffect, useState } from 'react'
import toast from 'react-hot-toast'
import Container from '../components/layout/Container'
import ContentLayout from '../components/layout/ContentLayout'
import WebsiteHead from '../components/layout/Head'
import { NoticeFooter } from '@/components/layout/NoticeFooter'

// Dynamically import CardGrid to prevent SSR-related issues
const IndexCardGrid = dynamic(
  () => import('../components/layout/IndexCardGrid'),
  {
    ssr: false,
  }
)

const Governance: React.FC = () => {
  const { exportWallet } = usePrivy()

  const [isClient, setIsClient] = useState(false)

  // Ensure code only runs on the client-side after hydration
  useEffect(() => {
    setIsClient(true)
  }, [])

  const indexCardData = [
    {
      icon: '/assets/icon-vote.svg',
      iconAlt: 'Vote on Proposals',
      header: 'Vote on Proposals',
      link: '/vote',
      hovertext: 'Vote on Proposals',
      paragraph: <>Vote on proposals and help shape the future of MoonDAO.</>,
      inline: true,
    },
    {
      icon: '/assets/icon-constitution.svg',
      iconAlt: 'Constitution',
      header: ' Constitution',
      link: '/constitution',
      hovertext: 'Report a Bug',
      paragraph: <>Report a bug and help us improve MoonDAO.</>,
      inline: true,
    },
    {
      icon: '/assets/icon-wallet.svg',
      iconAlt: 'Get $MOONEY',
      header: 'Get $MOONEY',
      link: 'https://app.uniswap.org/#/swap?inputCurrency=ETH&outputCurrency=0x20d4DB1946859E2Adb0e5ACC2eac58047aD41395&chain=mainnet',
      hovertext: 'Get $MOONEY',
      paragraph: (
        <>
          Join the MoonDAO community by acquiring our governance token $MOONEY
          on UniSwap.
        </>
      ),
      inline: true,
    },
    {
      icon: '/assets/icon-power.svg',
      iconAlt: 'Get Voting Power',
      header: 'Get Voting Power',
      link: '/lock',
      hovertext: 'Get Voting Power',
      paragraph: (
        <>
          Voting power is granted to stakeholders, stake $MOONEY to fully
          participate in co-governance and co-creation.
        </>
      ),
      inline: true,
    },
    {
      icon: '/assets/icon-bridge.svg',
      iconAlt: 'Bridge $MOONEY',
      header: 'Bridge $MOONEY',
      link: 'https://www.youtube.com/watch?v=oQtHjbcbAio',
      hovertext: 'Bridge $MOONEY',
      paragraph: (
        <>
          Learn how you can reduce onchain gas fees by bridging $MOONEY from L1
          to L2.
        </>
      ),
      inline: true,
    },
    {
      icon: '/assets/icon-wallet.svg',
      iconAlt: 'Export Wallet',
      header: 'Export Wallet',
      hovertext: 'Export Wallet',
      paragraph: <>Export your embedded wallet to an external wallet.</>,
      onClick: () => {
        if (isClient) {
          exportWallet().catch(() =>
            toast.error('Please select a privy wallet to export.')
          )
        }
      },
      inline: true,
    },
    {
      icon: '/assets/icon-governance.svg',
      iconAlt: 'City Hall',
      header: 'City Hall',
      link: 'https://discord.com/channels/914720248140279868/1175882517149130892',
      hovertext: 'Visit City Hall',
      paragraph: (
        <>
          City Hall channels are home to MoonDAO's governance processes, where
          decisions regarding proposals and our internal operations are
          addressed.
        </>
      ),
      inline: true,
    },
    {
      icon: '/assets/icon-role.svg',
      iconAlt: 'Guild.xyz',
      header: 'Guild.xyz',
      link: 'https://discord.com/channels/914720248140279868/945284940721975356',
      hovertext: 'Connect with Guild.xyz',
      paragraph: (
        <>
          Connect your Discord and wallet to Guild.xyz to unlock new roles and
          permissions based on your holdings to see everything that is happening
          with projects and governance.
        </>
      ),
      inline: true,
    },
  ]

  const title = 'Governance'
  const description =
    "MoonDAO's Treasury is governed by its Citizens. If you don't have voting power, become a Citizen by joining our community. You can read MoonDAO's Constitution to understand more about how our governance works."

  return (
    <>
      <WebsiteHead
        title={title}
        description={description}
        image="/assets/moondao-og.jpg"
      />
      <section className="w-[calc(100vw-20px)]">
        <Container>
          <ContentLayout
            header={title}
            headerSize="max(20px, 3vw)"
            description={<>{description}</>}
            preFooter={
              <NoticeFooter 
                defaultImage="../assets/MoonDAO-Logo-White.svg"
                defaultTitle="Need Help?"
                defaultDescription="Submit a ticket in the support channel on MoonDAO's Discord!"
                defaultButtonText="Submit a Ticket"
                defaultButtonLink="https://discord.com/channels/914720248140279868/1212113005836247050"
                imageWidth={200}
                imageHeight={200}
              />
            }
            mainPadding
            mode="compact"
            popOverEffect={false}
            isProfile
          >
            <div className="mt-10 mb-10 flex justify-center">
              <IndexCardGrid cards={indexCardData} singleCol={false} />
            </div>
          </ContentLayout>
        </Container>
      </section>
    </>
  )
}

export default Governance
