// Expanded Footer

import Image from 'next/image'
import Link from 'next/link'
import { useContext, useEffect, useState } from 'react'
import { useCitizen } from '@/lib/citizen/useCitizen'
import ChainContextV5 from '@/lib/thirdweb/chain-context-v5'
import Footer from './Footer'

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
  callToActionImage: string
  callToActionBody?: string
  callToActionTitle: string
  callToActionButtonText: string
  callToActionButtonLink: string
  hasCallToAction: boolean
  darkBackground?: boolean
}

export function ExpandedFooter({
  callToActionImage = '',
  callToActionBody,
  callToActionTitle = 'Join the Network',
  callToActionButtonText = 'Learn More',
  callToActionButtonLink = '/join',
  hasCallToAction = true,
  darkBackground = true,
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

  // Navigation link groups
  const networkLinks = [
    { text: 'Citizens', href: '/network?tab=citizens' },
    { text: 'Teams', href: '/network?tab=teams' },
    { text: 'Map', href: '/map' },
    { text: 'Create a Team', href: '/team' },
  ]

  const governLinks = [
    { text: 'Proposals', href: '/vote' },
    { text: 'Constitution', href: 'https://docs.moondao.com/Governance/Constitution?_gl=1*xwpa15*_ga*NDEyMzExNTE4LjE3MTcxMjYxODU.*_ga_QPFCD9VH46*czE3NDc4NjI2NTUkbzI1MCRnMSR0MTc0Nzg2Mjc1NCRqMCRsMCRoMA..' },
    { text: 'Buy $MOONEY', href: '/get-mooney' },
    { text: 'Lock $MOONEY', href: '/lock' },
    { text: 'Bridge $MOONEY', href: '/bridge' },
  ]

  const contributeLinks = [
    { text: 'Projects', href: '/projects' },
    { text: 'Get Rewards', href: '/submit?tag=contribution' },
    { text: 'Jobs', href: '/jobs' },
  ]

  const learnLinks = [
    { text: 'News', href: '/news' },
    { text: 'About', href: '/about' },
    { text: 'Events', href: '/events' },
    { text: 'Analytics', href: '/analytics' },
    { text: 'FAQ', href: 'https://docs.moondao.com/About/FAQ?_gl=1*1g5c5e6*_ga*NDEyMzExNTE4LjE3MTcxMjYxODU.*_ga_QPFCD9VH46*czE3NDc4NjI2NTUkbzI1MCRnMSR0MTc0Nzg2Mjk1MSRqMCRsMCRoMA' },
  ]

  const marketplaceLinks = [
    { text: 'Shop', href: '/marketplace' },
  ]

  return (
    <>
      <div id="expanded-menu" className="overflow-hidden relative bg-dark-cool px-6 text-white"> 
        <div className="container mx-auto max-w-[1200px] pb-0 sm:pl-[5vw] md:pt-[5vh] md:pl-[5vw] lg:pl-[2vw] flex flex-col lg:grid lg:grid-cols-6 gap-8 relative z-10">
          {hasCallToAction && (
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
              <Link 
                href={callToAction.buttonLink} 
                className="inline-block"
              >
                <div
                  className="gradient-2 hover:pl-7 transform transition-all ease-in-out duration-300 rounded-[2vmax] rounded-tl-[10px] mt-2 px-5 py-3 inline-block"
                >
                  {callToAction.buttonText}
                </div>
              </Link>
            </div>
          )}
          
          <div className={`z-50 px-[2vw] pt-[5vh] md:pt-0 py-0 grid grid-cols-2 md:grid-cols-4 gap-8 order-1 lg:order-2 ${hasCallToAction ? 'lg:col-span-4' : 'lg:col-span-6'}`}>
            <LinkList title="NETWORK" links={networkLinks} />
            <LinkList title="GOVERN" links={governLinks} />
            <div>
              <LinkList title="CONTRIBUTE" links={contributeLinks} />
              <div className="mt-8">
                <LinkList title="MARKETPLACE" links={marketplaceLinks} />
              </div>
            </div>
            <LinkList title="LEARN" links={learnLinks} />
          </div>
        </div>
      </div>
      <div id="bottom-footer" className="bg-darkest-cool flex items-center justify-center">
        <Footer/>
      </div>
    </>
  )
}
