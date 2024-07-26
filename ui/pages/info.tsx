import { Arbitrum, Sepolia } from '@thirdweb-dev/chains'
import { useAddress, useContract } from '@thirdweb-dev/react'
import { TEAM_ADDRESSES, CITIZEN_ADDRESSES, HATS_ADDRESS } from 'const/config'
import Image from 'next/image'
import Link from 'next/link'
import React, { useContext, useEffect, useState } from 'react'
import { useTeamData } from '@/lib/team/useTeamData'
import ChainContext from '@/lib/thirdweb/chain-context'
import CardGrid from '../components/layout/CardGrid'
import Container from '../components/layout/Container'
import ContentLayout from '../components/layout/ContentLayout'
import Footer from '../components/layout/Footer'
import WebsiteHead from '../components/layout/Head'
import PreFooter from '../components/layout/PreFooter'
import { NoticeFooter } from '@/components/layout/NoticeFooter'

const cardData = [
  {
    icon: '/assets/icon-news.svg',
    iconAlt: 'News and Updates',
    header: 'News & Updates',
    link: '/news',
    hovertext: 'Read More',
    paragraph: (
      <>
        Weekly updates from MoonDAO about projects, proposals, open votes, and
        other initiatives. Be sure to subscribe to get updates in your inbox.
      </>
    ),
    inline: true,
  },
  {
    icon: '/assets/icon-about.svg',
    iconAlt: 'About MoonDAO',
    header: 'About MoonDAO',
    link: '/about',
    hovertext: 'Learn About MoonDAO',
    paragraph: (
      <>
        Learn about how MoonDAO operates, how you can contribute or propose a
        project, read about our mission and vision, and more.
      </>
    ),
    inline: true,
  },
  {
    icon: '/assets/icon-constitution.svg',
    iconAlt: 'Constitution',
    header: 'Our Constitution',
    link: 'https://docs.moondao.com/Governance/Constitution',
    hovertext: 'Read the Constitution',
    paragraph: (
      <>
        This foundational document guides our governance processes, including
        the roles of the Senate, Member House, Executive Branch, and more.
      </>
    ),
    inline: true,
  },
  {
    icon: '/assets/icon-events.svg',
    iconAlt: 'Events',
    header: 'Our Events',
    link: '/events',
    hovertext: 'Attend an Event',
    paragraph: (
      <>
        Get started by attending one of our upcoming online events to find out
        how you can contribute to our plans by helping out on a project.
      </>
    ),
    inline: true,
  },
  {
    icon: '/assets/icon-analytics.svg',
    iconAlt: 'MoonDAO Analytics',
    header: 'Analytics',
    link: '/analytics',
    hovertext: 'Learn More',
    paragraph: (
      <>
        Transparent data and analytics related to our treasury, token,
        transactions, and more.
      </>
    ),
    inline: true,
  },
]

const Info: React.FC = () => {
  const title = 'Information Center'
  const description = "Learn More About The Internet's Space Program"
  const image = '/assets/moondao-og.jpg'

  const { setSelectedChain } = useContext(ChainContext)

  useEffect(() => {
    setSelectedChain(
      process.env.NEXT_PUBLIC_CHAIN === 'mainnet' ? Arbitrum : Sepolia
    )
  }, [])

  return (
    <>
      <WebsiteHead title={title} description={description} image={image} />
      <section className="w-[calc(100vw-20px)]">
        <Container>
          <ContentLayout
            header="Info Center"
            headerSize="max(20px, 3vw)"
            description={
              <>
                Learn more about the Internet's Space Program with the latest
                news and project updates, dive into the documentation, join an
                upcoming online event, or explore transparent analytics about
                our treasury and transactions.
              </>
            }
            preFooter={<NoticeFooter />}
            mainPadding
            mode="compact"
            popOverEffect={false}
            isProfile
          >
            <div className="mt-10 mb-10 flex justify-center">
              <CardGrid cards={cardData} singleCol={false} />
            </div>
          </ContentLayout>
        </Container>
      </section>
    </>
  )
}

export default Info
