import React from 'react'
import { useChainDefault } from '@/lib/thirdweb/hooks/useChainDefault'
import Container from '../components/layout/Container'
import ContentLayout from '../components/layout/ContentLayout'
import WebsiteHead from '../components/layout/Head'
import { NoticeFooter } from '@/components/layout/NoticeFooter'

// Define a new info card component with the new styling
const InfoCard = ({ 
  icon, 
  iconAlt, 
  header, 
  paragraph, 
  link, 
  hovertext 
}: {
  icon?: string
  iconAlt?: string
  header?: string
  paragraph?: React.ReactNode
  link?: string
  hovertext?: string
}) => {
  const handleClick = () => {
    if (link) {
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

const infoCards = [
  {
    icon: '/assets/icon-news.svg',
    iconAlt: 'News and Updates',
    header: 'News & Updates',
    link: '/news',
    hovertext: 'Read More',
    paragraph: 'Weekly updates from MoonDAO about projects, proposals, open votes, and other initiatives. Be sure to subscribe to get updates in your inbox.',
  },
  {
    icon: '/assets/icon-events.svg',
    iconAlt: 'Town Hall Summaries',
    header: 'Town Hall Summaries',
    link: '/townhall',
    hovertext: 'View Summaries',
    paragraph: 'Weekly summaries of our Town Hall meetings with key topics, decisions, action items, and important updates for community members.',
  },
  {
    icon: '/assets/icon-about.svg',
    iconAlt: 'About MoonDAO',
    header: 'About MoonDAO',
    link: '/about',
    hovertext: 'Learn About MoonDAO',
    paragraph: 'Learn about how MoonDAO operates, how you can contribute or propose a project, read about our mission and vision, and more.',
  },
  {
    icon: '/assets/icon-events.svg',
    iconAlt: 'Events',
    header: 'Our Events',
    link: '/events',
    hovertext: 'Attend an Event',
    paragraph: 'Get started by attending one of our upcoming online events to find out how you can contribute to our plans by helping out on a project.',
  },
  {
    icon: '/assets/icon-analytics.svg',
    iconAlt: 'MoonDAO Analytics',
    header: 'Analytics',
    link: '/analytics',
    hovertext: 'Learn More',
    paragraph: 'Transparent data and analytics related to our treasury, token, transactions, and more.',
  },
  {
    icon: '/assets/icon-contract.svg',
    iconAlt: 'FAQ',
    header: 'FAQ',
    link: '/faq',
    hovertext: 'Read the FAQ',
    paragraph: 'Find answers to common questions about MoonDAO, projects, and more.',
  },
]

const Info: React.FC = () => {
  const title = 'Information Center'
  const description = "Learn More About The Internet's Space Program"
  const image = '/assets/moondao-og.jpg'

  useChainDefault()

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
              <div className="relative mx-4">
                <div className="absolute inset-0 bg-gradient-to-br from-blue-900/10 via-purple-900/10 to-teal-900/10 rounded-3xl" />
                <div className="relative p-6 md:p-12 bg-gradient-to-br from-white/5 via-white/10 to-white/5 backdrop-blur-xl border border-white/20 rounded-3xl shadow-2xl">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6 items-stretch">
                    {infoCards.map((card, index) => (
                      <InfoCard
                        key={`info-card-${index}`}
                        icon={card.icon}
                        iconAlt={card.iconAlt}
                        header={card.header}
                        paragraph={card.paragraph}
                        link={card.link}
                        hovertext={card.hovertext}
                      />
                    ))}
                  </div>
                </div>
              </div>
            </div>
          </ContentLayout>
        </Container>
      </section>
    </>
  )
}

export default Info
