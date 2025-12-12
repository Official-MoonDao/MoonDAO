import useTranslation from 'next-translate/useTranslation'
import Link from 'next/link'
import React from 'react'
import Container from '../components/layout/Container'
import WebsiteHead from '../components/layout/Head'
import ArbitrumBridge from '@/components/bridge/ArbitrumBridge'
import { NoticeFooter } from '@/components/layout/NoticeFooter'
import SpaceBackground from '@/components/layout/SpaceBackground'

export default function Bridge() {
  const { t } = useTranslation('common')

  return (
    <>
      <WebsiteHead
        title="Bridge MOONEY - MoonDAO"
        description="Bridge MOONEY tokens across different blockchain networks securely and efficiently."
      />

      <Container is_fullwidth={true}>
        <SpaceBackground />
        <div className="min-h-screen text-white w-full relative z-10">
          {/* Bridge MOONEY Section */}
          <section className="py-12 px-6 w-full min-h-screen flex items-center">
            <div className="max-w-4xl mx-auto w-full">
              <div className="text-center mb-8">
                <h1 className="text-3xl md:text-4xl font-bold font-GoodTimes text-white mb-4">
                  Bridge MOONEY
                </h1>
                <p className="text-lg text-gray-300 max-w-3xl mx-auto">
                  Transfer your MOONEY tokens securely across different blockchain networks to
                  access various DeFi opportunities and governance features.
                </p>
              </div>

              {/* Centered Bridge Interface */}
              <div className="max-w-xl mx-auto">
                <div>
                  <ArbitrumBridge />
                </div>
              </div>
            </div>
          </section>

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
