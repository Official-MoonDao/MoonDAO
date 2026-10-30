import { ScaleIcon, ShieldCheckIcon, GlobeAltIcon } from '@heroicons/react/24/outline'
import Head from 'next/head'
import Link from 'next/link'
import React from 'react'
import WebsiteHead from '../components/layout/Head'
import Container from '@/components/layout/Container'
import { NoticeFooter } from '@/components/layout/NoticeFooter'
import CallToActionSection from '@/components/mooney/CallToActionSection'
import KeyFeaturesSection from '@/components/mooney/KeyFeaturesSection'
import TokenHeroSection from '@/components/mooney/TokenHeroSection'
import TokenInfoSection from '@/components/mooney/TokenInfoSection'
import MooneyHowItWorks from '@/components/mooney/howItWorks/MooneyHowItWorks'

export default function Mooney() {
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
                <Link
                  href="/get-mooney"
                  className="bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 text-white py-4 px-8 rounded-xl font-semibold transition-all duration-200 transform hover:scale-105 shadow-lg"
                >
                  Buy MOONEY
                </Link>
                <Link
                  href="/lock"
                  className="bg-gradient-to-r from-indigo-600 to-violet-600 hover:from-indigo-700 hover:to-violet-700 text-white py-4 px-8 rounded-xl font-semibold transition-all duration-200 transform hover:scale-105 shadow-lg"
                >
                  Lock & Vote
                </Link>
              </>
            }
          />

          <KeyFeaturesSection features={features} />

          <MooneyHowItWorks />

          <TokenInfoSection />

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
