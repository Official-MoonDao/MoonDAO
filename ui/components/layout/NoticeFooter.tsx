import Image from 'next/image'
import Link from 'next/link'
import { useContext, useEffect, useState } from 'react'
import { useCitizen } from '@/lib/citizen/useCitizen'
import ChainContextV5 from '@/lib/thirdweb/chain-context-v5'
import { ExpandedFooter } from './ExpandedFooter'

type NoticeFooterProps = {
  managerTitle?: string
  managerImage?: string
  managerDescription?: string
  managerButtonText?: string
  managerButtonLink?: string
  citizenTitle?: string
  citizenImage?: string
  citizenDescription?: string
  citizenButtonText?: string
  citizenButtonLink?: string
  defaultTitle?: string
  defaultImage?: string
  defaultDescription?: string
  defaultButtonText?: string
  defaultButtonLink?: string
  imageWidth?: number
  imageHeight?: number
  iconWidth?: number
  iconHeight?: number
  darkBackground?: boolean
  citizenNotice?: boolean
  disclaimerOnly?: boolean
}

export function NoticeFooter({
  defaultTitle = 'Join the Network',
  defaultImage = '../assets/logo-san-full-white.svg',
  defaultDescription = 'Be part of the Space Acceleration Network and play a role in establishing a permanent human presence on the Moon and beyond.',
  defaultButtonText = 'Learn More',
  defaultButtonLink = '/join',
  managerTitle = 'Need Help?',
  managerImage = '../assets/MoonDAO-Logo-White.svg',
  managerDescription = "Submit a ticket in the support channel on MoonDAO's Discord!",
  managerButtonText = 'Submit a Ticket',
  managerButtonLink = 'https://discord.com/channels/914720248140279868/1212113005836247050',
  citizenTitle = 'Need Help?',
  citizenImage = '../assets/MoonDAO-Logo-White.svg',
  citizenDescription = "Submit a ticket in the support channel on MoonDAO's Discord!",
  citizenButtonText = 'Submit a Ticket',
  citizenButtonLink = 'https://discord.com/channels/914720248140279868/1212113005836247050',
  imageWidth = 120,
  imageHeight = 120,
  iconWidth = 40,
  iconHeight = 40,
  darkBackground = true,
  citizenNotice = false,
  disclaimerOnly = false,
}: NoticeFooterProps) {
  const { selectedChain } = useContext(ChainContextV5)
  const isCitizen = useCitizen(selectedChain)

  const [notice, setNotice] = useState({
    title: defaultTitle,
    image: defaultImage,
    description: defaultDescription,
    buttonText: defaultButtonText,
    buttonLink: defaultButtonLink,
  })

  useEffect(() => {
    if (isCitizen || citizenNotice) {
      setNotice({
        title: citizenTitle,
        image: citizenImage,
        description: citizenDescription,
        buttonText: citizenButtonText,
        buttonLink: citizenButtonLink,
      })
    } else {
      setNotice({
        title: defaultTitle,
        image: defaultImage,
        description: defaultDescription,
        buttonText: defaultButtonText,
        buttonLink: defaultButtonLink,
      })
    }
  }, [
    isCitizen,
    managerTitle,
    managerImage,
    managerDescription,
    managerButtonText,
    managerButtonLink,
    citizenTitle,
    citizenImage,
    citizenDescription,
    citizenButtonText,
    citizenButtonLink,
    defaultTitle,
    defaultImage,
    defaultDescription,
    defaultButtonText,
    defaultButtonLink,
    citizenNotice,
  ])

  return (
    <div
      id="notice-footer"
      className={`pb-10 md:pb-0 ${
        darkBackground ? 'md:pl-5 pb-10 w-full pt-5' : 'p-5 mr-5'
      }`}
    >
      <div className="mx-[3vw] mb-5 bg-gradient-to-b from-slate-800/90 to-slate-900/95 backdrop-blur-xl border border-slate-700/50 rounded-[2vmax] shadow-2xl lg:ml-[80px] 2xl:ml-[125px] 2xl:max-w-[1040px]">
        <div className="bg-gradient-to-b from-slate-700/30 to-slate-800/40 rounded-[2vmax] border border-slate-600/30 p-8 flex flex-col lg:flex-row items-center gap-6">
          <div id="Image container" className="hidden lg:block flex-shrink-0">
            <Image
              src={notice.image}
              alt="Logo"
              width={imageWidth}
              height={imageHeight}
              className="opacity-90 w-32 h-32 lg:w-40 lg:h-40 object-contain"
            />
          </div>
          <div id="callout-container" className="flex flex-col flex-1 text-center lg:text-left">
            <div className="flex items-center justify-center lg:justify-start gap-3 mb-4">
              <div id="Image container" className="lg:hidden">
                <Image
                  src="../assets/icon-star.svg"
                  alt="MoonDAO Logo"
                  width={iconWidth}
                  height={iconHeight}
                />
              </div>
              <h3 className="font-GoodTimes text-white text-2xl md:text-3xl lg:text-4xl">
                {notice.title}
              </h3>
            </div>
            <p className="text-slate-300 text-base md:text-lg mb-6 leading-relaxed">
              {notice.description}
            </p>
            <Link
              href={notice.buttonLink}
              className="inline-block w-fit mx-auto lg:mx-0"
              {...(notice.buttonLink?.startsWith('http') && {
                target: "_blank",
                rel: "noopener noreferrer"
              })}
              passHref
            >
              <div className="gradient-2 hover:scale-105 transform transition-all ease-in-out duration-300 rounded-full px-8 py-4 inline-block text-white font-medium text-lg hover:shadow-lg">
                {notice.buttonText}
              </div>
            </Link>
          </div>
        </div>
      </div>
      <ExpandedFooter 
        callToActionImage={notice.image}
        callToActionTitle={notice.title}
        callToActionBody={notice.description}
        callToActionButtonText={notice.buttonText}
        callToActionButtonLink={notice.buttonLink}
        hasCallToAction={true}
        darkBackground={darkBackground}
        isFullwidth={false}
        disclaimerOnly={disclaimerOnly}
      />
    </div>
  )
}
