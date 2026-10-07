import Image from 'next/image'
import Link from 'next/link'
import React from 'react'
import {
  ChatBubbleLeftRightIcon,
  DocumentTextIcon,
  CameraIcon,
  PlayIcon,
  AtSymbolIcon,
  UserPlusIcon,
  RocketLaunchIcon,
  CalendarDaysIcon,
} from '@heroicons/react/24/outline'
import Container from '../components/layout/Container'
import WebsiteHead from '../components/layout/Head'

type HubLink = {
  name: string
  description: string
  url: string
  icon: React.ComponentType<{ className?: string }>
  external?: boolean
  /** HOLD entries stay in source but are not rendered. */
  hidden?: boolean
}

const LinkTree: React.FC = () => {
  const title = 'Follow MoonDAO'
  const description = '🚀 Connect with MoonDAO across all platforms and stay updated on our journey to the Moon'

  const socialLinks: HubLink[] = [
    {
      name: 'Become a Citizen',
      description: 'Join MoonDAO and take part in the network',
      url: 'https://moondao.com/join?utm_source=instagram&utm_medium=bio&utm_campaign=ig-bio-join',
      icon: UserPlusIcon,
      external: false,
    },
    {
      name: 'Help send Frank',
      description: 'Support the mission to fly with Frank White',
      url: 'https://moondao.com/frank?utm_source=instagram&utm_medium=bio&utm_campaign=ig-bio-frank',
      icon: RocketLaunchIcon,
      external: false,
    },
    {
      name: 'Events',
      description: 'See upcoming MoonDAO events',
      url: 'https://moondao.com/events?utm_source=instagram&utm_medium=bio&utm_campaign=ig-bio-events',
      icon: CalendarDaysIcon,
      external: false,
    },
    {
      name: 'Discord',
      description: 'Join the MoonDAO community',
      url: 'https://moondao.com/discord?utm_source=instagram&utm_medium=bio&utm_campaign=ig-bio-discord',
      icon: ChatBubbleLeftRightIcon,
      external: false,
    },
    {
      name: 'Documentation',
      description: 'Learn about our mission and governance',
      url: '/docs',
      icon: DocumentTextIcon,
    },
    {
      name: 'Instagram',
      description: 'Behind-the-scenes space content',
      url: '/instagram',
      icon: CameraIcon,
    },
    // HOLD: parked off the IG hub. Do not render while hidden is true.
    {
      name: 'Twitter/X',
      description: 'Daily updates and space news',
      url: '/twitter',
      icon: AtSymbolIcon,
      hidden: true,
    },
    {
      name: 'YouTube',
      description: 'Space missions and educational content',
      url: 'https://youtube.com/@officialmoondao',
      icon: PlayIcon,
      hidden: true,
    },
  ]

  return (
    <>
      <WebsiteHead title={title} description={description} />
      <Container>
        <div className="min-h-screen py-8 px-4">
          {/* Header Section */}
          <div className="max-w-2xl mx-auto text-center mb-12">
            {/* Logo */}
            <div className="mb-8">
              <Image
                src="/Original_White.png"
                alt="MoonDAO Logo"
                width={120}
                height={120}
                className="mx-auto rounded-full border-4 border-white/20 shadow-2xl"
              />
            </div>

            {/* Title & Description */}
            <h1 className="font-GoodTimes text-4xl md:text-5xl font-bold text-white mb-4">
              Follow MoonDAO
            </h1>
            <p className="text-gray-300 text-lg mb-6 leading-relaxed">
              Join the Space Acceleration Network and be part of humanity's multiplanetary future
            </p>

            {/* Featured Image */}
            <div className="relative mb-8 rounded-2xl overflow-hidden shadow-2xl">
              <Image
                src="/assets/dude-perfect.jpg"
                width={600}
                height={300}
                alt="MoonDAO Space Mission"
                className="w-full h-48 object-cover"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent"></div>
              <div className="absolute bottom-4 left-4 text-white">
                <p className="text-sm font-medium">Latest Mission Update</p>
                <p className="text-xs text-gray-300">Astronaut Selection Program</p>
              </div>
            </div>
          </div>

          {/* Social Links Grid */}
          <div className="max-w-2xl mx-auto space-y-4 mb-12">
            {socialLinks.filter((link) => !link.hidden).map((link, index) => (
              <Link
                key={index}
                href={link.url}
                target={link.external !== false ? "_blank" : undefined}
                rel={link.external !== false ? "noopener noreferrer" : undefined}
                className="block group"
              >
                <div className="w-full bg-gradient-to-r from-blue-500 to-purple-600 p-[1px] rounded-xl shadow-lg hover:shadow-2xl transition-all duration-300 transform hover:scale-[1.02]">
                  <div className="bg-gray-900/90 backdrop-blur-xl rounded-xl p-4 flex items-center space-x-4 hover:bg-gray-800/90 transition-colors">
                    <div className="flex-shrink-0">
                      <div className="w-12 h-12 rounded-lg bg-gradient-to-r from-blue-500 to-purple-600 flex items-center justify-center">
                        <link.icon className="w-6 h-6 text-white" />
                      </div>
                    </div>
                    <div className="flex-1 min-w-0">
                      <h3 className="text-white font-semibold text-lg group-hover:text-gray-100 transition-colors">
                        {link.name}
                      </h3>
                      <p className="text-gray-400 text-sm group-hover:text-gray-300 transition-colors">
                        {link.description}
                      </p>
                    </div>
                    <div className="flex-shrink-0">
                      <svg 
                        className="w-5 h-5 text-gray-400 group-hover:text-white group-hover:translate-x-1 transition-all duration-200" 
                        fill="none" 
                        stroke="currentColor" 
                        viewBox="0 0 24 24"
                      >
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                      </svg>
                    </div>
                  </div>
                </div>
              </Link>
            ))}
          </div>

          {/* Footer */}
          <div className="max-w-2xl mx-auto text-center mt-12">
            <p className="text-gray-500 text-sm">
              MoonDAO is an international collective united by the mission of decentralizing access to space research and exploration.
            </p>
          </div>
        </div>
      </Container>
    </>
  )
}

export default LinkTree
