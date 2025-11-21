import { ScaleIcon, ShieldCheckIcon, GlobeAltIcon } from '@heroicons/react/24/outline'
import Head from 'next/head'
import React, { useContext } from 'react'
import ChainContextV5 from '@/lib/thirdweb/chain-context-v5'
import WebsiteHead from '../components/layout/Head'
import Container from '@/components/layout/Container'
import { NoticeFooter } from '@/components/layout/NoticeFooter'
import BuyMooneySection from '@/components/mooney/BuyMooneySection'
import CallToActionSection from '@/components/mooney/CallToActionSection'
import KeyFeaturesSection from '@/components/mooney/KeyFeaturesSection'
import TokenHeroSection from '@/components/mooney/TokenHeroSection'
import TokenInfoSection from '@/components/mooney/TokenInfoSection'
import NativeToMooney from '@/components/uniswap/NativeToMooney'

export default function Mooney() {
  const { selectedChain } = useContext(ChainContextV5)

  const features = [
    {
      icon: (
        <div className="bg-blue-500/20 rounded-full w-12 h-12 flex items-center justify-center">
          <ScaleIcon className="w-6 h-6 text-blue-400" />
        </div>
      ),
      title: 'Quadratic Voting',
      description: 'Lock MOONEY to get vMOONEY voting power. Influence = √(vMOONEY balance).',
    },
    {
      icon: (
        <div className="bg-purple-500/20 rounded-full w-12 h-12 flex items-center justify-center">
          <ShieldCheckIcon className="w-6 h-6 text-purple-400" />
        </div>
      ),
      title: 'Fixed Supply',
      description: 'Only 2.53B MOONEY will ever exist. No new tokens minted.',
    },
    {
      icon: (
        <div className="bg-green-500/20 rounded-full w-12 h-12 flex items-center justify-center">
          <GlobeAltIcon className="w-6 h-6 text-green-400" />
        </div>
      ),
      title: 'Multi-Chain',
      description: 'Available on Ethereum, Arbitrum, Polygon, and Base.',
      badges: ['ETH', 'ARB', 'MATIC', 'BASE'],
    },
  ]

  const governanceSteps = [
    {
      number: 1,
      label: 'Get MOONEY',
      color: '#3B82F6',
    },
    {
      number: 2,
      label: 'Lock for vMOONEY',
      color: '#8B5CF6',
    },
    {
      number: 3,
      label: 'Vote on Proposals',
      color: '#10B981',
    },
    {
      number: 4,
      label: 'Shape Mission',
      color: '#F59E0B',
    },
  ]

  return (
    <>
      <WebsiteHead
        title="$MOONEY Token - MoonDAO Governance"
        description="Learn about MOONEY, the governance token powering MoonDAO's mission to establish a lunar settlement. Buy, lock, and bridge MOONEY tokens to participate in decentralized space exploration governance."
      />
      <Head>
        <link rel="preload" as="image" href="/assets/ngc6357_4k.webp" />
      </Head>

      <Container is_fullwidth={true}>
        <div className="min-h-screen bg-dark-cool text-white w-full">
          <TokenHeroSection
            title="MOONEY TOKEN"
            description="The governance token that powers MoonDAO's mission to create a self-sustaining, self-governing settlement on the Moon."
            imageSrc="/coins/MOONEY.png"
            imageAlt="MOONEY Token"
            ctaButtons={
              <>
                <a
                  href="#buy"
                  className="bg-gradient-to-r from-blue-500 to-purple-600 hover:from-blue-600 hover:to-purple-700 text-white py-4 px-8 rounded-xl font-semibold transition-all duration-200 transform hover:scale-105 shadow-lg"
                >
                  Buy MOONEY
                </a>
                <a
                  href="#buy"
                  className="bg-gradient-to-r from-purple-500 to-pink-600 hover:from-purple-600 hover:to-pink-700 text-white py-4 px-8 rounded-xl font-semibold transition-all duration-200 transform hover:scale-105 shadow-lg"
                >
                  Lock & Vote
                </a>
              </>
            }
          />

          <KeyFeaturesSection
            features={features}
            governanceSteps={governanceSteps}
            formula="Voting Power = √(vMOONEY)"
            formulaDescription="Quadratic voting prevents whale dominance"
          />

          <TokenInfoSection />

          <BuyMooneySection
            selectedChain={selectedChain}
            swapComponent={<NativeToMooney selectedChain={selectedChain} />}
          />

          <CallToActionSection />

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
