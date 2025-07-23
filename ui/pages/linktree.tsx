import Image from 'next/image'
import Link from 'next/link'
import React from 'react'
import { 
  GlobeAltIcon, 
  ChatBubbleLeftRightIcon, 
  DocumentTextIcon,
  NewspaperIcon,
  ShoppingBagIcon,
  CameraIcon,
  PlayIcon,
  AtSymbolIcon
} from '@heroicons/react/24/outline'
import Container from '../components/layout/Container'
import WebsiteHead from '../components/layout/Head'
import MailingList from '../components/layout/MailingList'

const LinkTree: React.FC = () => {
  const title = 'Follow MoonDAO'
  const description = '🚀 Connect with MoonDAO across all platforms and stay updated on our journey to the Moon'

  const socialLinks = [
    {
      name: 'MoonDAO Website',
      description: 'Explore our main platform',
      url: 'https://moondao.com',
      icon: GlobeAltIcon,
      external: false
    },
    {
      name: 'Discord Community',
      description: 'Join 10,000+ space enthusiasts',
      url: '/discord',
      icon: ChatBubbleLeftRightIcon,
    },
    {
      name: 'Documentation',
      description: 'Learn about our mission & governance',
      url: 'https://docs.moondao.com',
      icon: DocumentTextIcon,
    },
    {
      name: 'Twitter/X',
      description: 'Daily updates & space news',
      url: '/twitter',
      icon: AtSymbolIcon,
    },
    {
      name: 'Newsletter',
      description: 'Weekly space industry insights',
      url: 'https://moondao.ck.page/profile',
      icon: NewspaperIcon,
    },
    {
      name: 'NFT Marketplace',
      description: 'Discover space-themed collectibles',
      url: 'https://market.moondao.com',
      icon: ShoppingBagIcon,
    },
    {
      name: 'Instagram',
      description: 'Behind-the-scenes space content',
      url: '/instagram',
      icon: CameraIcon,
    },
    {
      name: 'YouTube',
      description: 'Space missions & educational content',
      url: 'https://youtube.com/@moondao',
      icon: PlayIcon,
    }
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
            {socialLinks.map((link, index) => (
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

          {/* Newsletter Signup */}
          <div className="max-w-lg mx-auto bg-gradient-to-br from-gray-900 via-blue-900/30 to-purple-900/20 backdrop-blur-xl border border-white/10 rounded-2xl shadow-2xl p-8 text-center">
            <h2 className="font-GoodTimes text-2xl font-bold text-white mb-4">
              Stay Connected
            </h2>
            <p className="text-gray-300 mb-6">
              Get the latest news and updates from MoonDAO delivered to your inbox
            </p>
            <MailingList />
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
