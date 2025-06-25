import { usePrivy } from '@privy-io/react-auth'
import React, { useEffect, useState } from 'react'
import toast from 'react-hot-toast'
import Container from '../components/layout/Container'
import ContentLayout from '../components/layout/ContentLayout'
import WebsiteHead from '../components/layout/Head'
import { NoticeFooter } from '@/components/layout/NoticeFooter'

// Define a new governance card component with the new styling
const GovernanceCard = ({ 
  icon, 
  iconAlt, 
  header, 
  paragraph, 
  link, 
  onClick, 
  hovertext 
}: {
  icon?: string
  iconAlt?: string
  header?: string
  paragraph?: React.ReactNode
  link?: string
  onClick?: () => void
  hovertext?: string
}) => {
  const handleClick = () => {
    if (onClick) {
      onClick()
    } else if (link) {
      if (link.startsWith('http')) {
        window.open(link, '_blank')
      } else {
        window.location.href = link
      }
    }
  }

  return (
    <button
      onClick={handleClick}
      className="w-full h-full min-h-[140px] p-4 bg-gradient-to-b from-slate-700/20 to-slate-800/30 rounded-2xl border border-slate-600/30 hover:border-slate-500/50 transition-all duration-200 hover:scale-[1.02] group"
    >
      <div className="flex flex-row items-start gap-4 w-full h-full">
        {icon && (
          <div className="w-[60px] h-[60px] flex-shrink-0">
            <img
              className="w-full h-full object-contain"
              src={icon}
              alt={iconAlt || ''}
            />
          </div>
        )}
        <div className="flex-1 min-w-0 text-left flex flex-col justify-start">
          <h3 className="font-bold font-GoodTimes text-lg text-white mb-2 break-words group-hover:text-slate-200 transition-colors">
            {header}
          </h3>
          <div className="text-sm text-slate-300 leading-relaxed break-words">
            {paragraph}
          </div>
        </div>
      </div>
    </button>
  )
}

const Governance: React.FC = () => {
  const { exportWallet } = usePrivy()

  const [isClient, setIsClient] = useState(false)

  // Ensure code only runs on the client-side after hydration
  useEffect(() => {
    setIsClient(true)
  }, [])

  const governanceCards = [
    {
      icon: '/assets/icon-vote.svg',
      iconAlt: 'Vote on Proposals',
      header: 'Vote on Proposals',
      link: '/vote',
      hovertext: 'Vote on Proposals',
      paragraph: 'Vote on proposals and help shape the future of MoonDAO.',
    },
    {
      icon: '/assets/icon-constitution.svg',
      iconAlt: 'Constitution',
      header: 'Constitution',
      link: '/constitution',
      hovertext: 'Constitution',
      paragraph: 'Read MoonDAO\'s Constitution to understand our governance.',
    },
    {
      icon: '/assets/icon-wallet.svg',
      iconAlt: 'Get $MOONEY',
      header: 'Get $MOONEY',
      link: 'https://app.uniswap.org/#/swap?inputCurrency=ETH&outputCurrency=0x20d4DB1946859E2Adb0e5ACC2eac58047aD41395&chain=mainnet',
      hovertext: 'Get $MOONEY',
      paragraph: 'Join the MoonDAO community by acquiring our governance token $MOONEY on UniSwap.',
    },
    {
      icon: '/assets/icon-power.svg',
      iconAlt: 'Get Voting Power',
      header: 'Get Voting Power',
      link: '/lock',
      hovertext: 'Get Voting Power',
      paragraph: 'Voting power is granted to stakeholders, stake $MOONEY to fully participate in co-governance and co-creation.',
    },
    {
      icon: '/assets/icon-bridge.svg',
      iconAlt: 'Bridge $MOONEY',
      header: 'Bridge $MOONEY',
      link: 'https://www.youtube.com/watch?v=oQtHjbcbAio',
      hovertext: 'Bridge $MOONEY',
      paragraph: 'Learn how you can reduce onchain gas fees by bridging $MOONEY from L1 to L2.',
    },
    {
      icon: '/assets/icon-wallet.svg',
      iconAlt: 'Export Wallet',
      header: 'Export Wallet',
      hovertext: 'Export Wallet',
      paragraph: 'Export your embedded wallet to an external wallet.',
      onClick: () => {
        if (isClient) {
          exportWallet().catch(() =>
            toast.error('Please select a privy wallet to export.')
          )
        }
      },
    },
    {
      icon: '/assets/icon-governance.svg',
      iconAlt: 'City Hall',
      header: 'City Hall',
      link: 'https://discord.com/channels/914720248140279868/1175882517149130892',
      hovertext: 'Visit City Hall',
      paragraph: 'City Hall channels are home to MoonDAO\'s governance processes, where decisions regarding proposals and our internal operations are addressed.',
    },
    {
      icon: '/assets/icon-role.svg',
      iconAlt: 'Guild.xyz',
      header: 'Guild.xyz',
      link: 'https://discord.com/channels/914720248140279868/945284940721975356',
      hovertext: 'Connect with Guild.xyz',
      paragraph: 'Connect your Discord and wallet to Guild.xyz to unlock new roles and permissions based on your holdings to see everything that is happening with projects and governance.',
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
            <div className="mt-10 mb-10">
              <div className="p-4 md:p-8 bg-gradient-to-b from-slate-800/90 to-slate-900/95 backdrop-blur-xl border border-slate-700/50 rounded-[2vmax] shadow-2xl">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6 items-stretch">
                  {governanceCards.map((card, index) => (
                    <GovernanceCard
                      key={`governance-card-${index}`}
                      icon={card.icon}
                      iconAlt={card.iconAlt}
                      header={card.header}
                      paragraph={card.paragraph}
                      link={card.link}
                      onClick={card.onClick}
                      hovertext={card.hovertext}
                    />
                  ))}
                </div>
              </div>
            </div>
          </ContentLayout>
        </Container>
      </section>
    </>
  )
}

export default Governance
