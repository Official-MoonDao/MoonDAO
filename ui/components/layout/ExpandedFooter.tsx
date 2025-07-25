// Expanded Footer

import Image from 'next/image'
import Link from 'next/link'
import { useContext, useEffect, useState } from 'react'
import { useCitizen } from '@/lib/citizen/useCitizen'
import ChainContextV5 from '@/lib/thirdweb/chain-context-v5'
import Disclaimer from './Disclaimer'
import LegalLinks from './LegalLinks'

type LinkItem = {
  text: string
  href: string
}

type LinkListProps = {
  title: string
  links: LinkItem[]
}

function LinkList({ title, links }: LinkListProps) {
  return (
    <div className="flex flex-col space-y-2">
      <h3 className="text-sm font-medium text-gray-400 uppercase mb-2">{title}</h3>
      <ul className="space-y-2">
        {links.map((link, index) => (
          <li key={index}>
            <Link href={link.href || '#'} className="text-white hover:text-purple-400 transition-colors">
              {link.text}
            </Link>
          </li>
        ))}
      </ul>
    </div>
  )
}

type ExpandedFooterProps = {
  callToActionImage?: string
  callToActionBody?: string
  callToActionTitle?: string
  callToActionButtonText?: string
  callToActionButtonLink?: string
  hasCallToAction: boolean
  darkBackground?: boolean
  isFullwidth?: boolean
  disclaimerOnly?: boolean
}

export function ExpandedFooter({
  callToActionImage = '',
  callToActionBody,
  callToActionTitle = 'Join the Network',
  callToActionButtonText = 'Learn More',
  callToActionButtonLink = '/join',
  hasCallToAction = true,
  darkBackground = true,
  isFullwidth = true,
  disclaimerOnly = false,
}: ExpandedFooterProps) {
  const { selectedChain } = useContext(ChainContextV5)
  const isCitizen = useCitizen(selectedChain)

  const [callToAction, setCallToAction] = useState({
    image: callToActionImage || '',
    body: callToActionBody,
    title: callToActionTitle,
    hasCallToAction: hasCallToAction,
    buttonText: callToActionButtonText,
    buttonLink: callToActionButtonLink || '/join',
  })

  useEffect(() => {
    setCallToAction({
      image: callToActionImage,
      body: callToActionBody,
      title: callToActionTitle,
      buttonText: callToActionButtonText,
      buttonLink: callToActionButtonLink,  
      hasCallToAction: hasCallToAction,
    })
  }, [
    callToActionImage,
    callToActionBody,
    callToActionTitle,
    callToActionButtonText,
    callToActionButtonLink,
    hasCallToAction,
  ])

  // Navigation link groups - matching topnav organization exactly
  const networkLinks = [
    { text: 'Explore Network', href: '/network' },
    { text: 'Become a Citizen', href: '/join' },
    { text: 'Create a Team', href: '/team' },
    { text: 'Submit Contribution', href: '/contributions' },
    { text: 'Jobs', href: '/jobs' },
  ]

  const governLinks = [
    { text: 'Governance', href: '/governance' },
    { text: 'Proposals', href: '/vote' },
    { text: 'Constitution', href: '/constitution' },
  ]

  const tokenLinks = [
    { text: 'Buy', href: '/get-mooney' },
    { text: 'Lock', href: '/lock' },
    { text: 'Bridge', href: '/bridge' },
  ]

  const projectLinks = [
    { text: 'Project Rewards', href: '/projects' },
    { text: 'Propose Project', href: '/proposals' },
  ]

  const learnLinks = [
    { text: 'News', href: '/news' },
    { text: 'About', href: '/about' },
    { text: 'Events', href: '/events' },
    { text: 'Analytics', href: '/analytics' },
    { text: 'FAQ', href: '/faq' },
  ]

  const marketplaceLinks = [
    { text: 'Shop', href: '/marketplace' },
  ]

  const supportLinks = [
    { text: 'Submit Ticket', href: 'https://discord.gg/moondao' },
  ]

  return (
    <>
      {!disclaimerOnly && (
        <div id="expanded-menu" className={`overflow-hidden relative ${isFullwidth ? 'bg-dark-cool' : ''} px-6 text-white`}>
          
          <div id="expanded-menu-container" className={`${isFullwidth ? 'container mx-auto md:pl-[5vw] lg:pl-[2vw] md:pb-[2vw] md:pt-[5vh]' : 'pb-[5vw] md:pt-[5vw]'} max-w-[1200px] pb-0 flex flex-col lg:grid lg:grid-cols-6 gap-8 relative z-10`}>
            {hasCallToAction && isFullwidth && (
              <div className="flex flex-col pb-[5vh] p-[2vw]  md:p-0 py-0 lg:col-span-2 order-2 lg:order-1 relative min-h-[250px] lg:min-h-[300px]">
                <div className="overflow-visible absolute bottom-0 left-0 z-0 w-full flex items-end">
                  <Image 
                    className="overflow-visible object-contain object-left ml-[-10vw] md:ml-0 w-full " 
                    src={callToAction.image} 
                    alt="Join the Space Acceleration Network" 
                    width={2000} 
                    height={2000} 
                  />
                </div>
                <h2 className="z-50 text-2xl font-bold font-GoodTimes mb-3">{callToAction.title}</h2>
                {callToAction.body && <p className="max-w-[400px] mb-4 opacity-80">{callToAction.body}</p>}
                <div>
                  <Link 
                    href={callToAction.buttonLink} 
                    className="gradient-2 hover:pl-7 transform transition-all ease-in-out duration-300 rounded-[2vmax] rounded-tl-[10px] mt-2 px-5 py-3 inline-block"
                  >
                    {callToAction.buttonText}
                  </Link>
                </div>
              </div>
            )}
            
            <div className={`z-50 px-[2vw] pt-[2vh] md:pt-0 py-0 grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-8 order-1 lg:order-2 ${hasCallToAction && isFullwidth ? 'lg:col-span-4' : 'lg:col-span-6'}`}>
              {/* Column 1: NETWORK */}
              <div>
                <LinkList title="NETWORK" links={networkLinks} />
              </div>

              {/* Column 2: GOVERN */}
              <div>
                <LinkList title="GOVERN" links={governLinks} />
              </div>
              
              {/* Column 3: $MOONEY TOKEN */}
              <div>
                <LinkList title="$MOONEY TOKEN" links={tokenLinks} />
              </div>
              
              {/* Column 4: PROJECTS */}
              <div>
                <LinkList title="PROJECTS" links={projectLinks} />
              </div>
              
              {/* Column 5: LEARN */}
              <div>
                <LinkList title="LEARN" links={learnLinks} />
              </div>
              
              {/* Column 6: MARKETPLACE & SUPPORT */}
              <div className="grid grid-rows-2 gap-8">
                <LinkList title="MARKETPLACE" links={marketplaceLinks} />
                <LinkList title="SUPPORT" links={supportLinks} />
              </div>
            </div>
          </div>
          
          {/* Footer content moved into main section */}
          <div className="container mx-auto px-[5vw] xl:px-[2vw] flex flex-col items-center pt-8 pb-10 max-w-[1200px] w-full">
            <div className="pb-5">
              <Disclaimer isCentered={false} />
            </div>          
            
            <div>
              <LegalLinks isCentered={true} />
            </div>
          </div>
        </div>
      )}
    </>
  )
}
