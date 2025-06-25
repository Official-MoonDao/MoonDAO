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
  imageWidth = 450,
  imageHeight = 450,
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
      <div className="mx-[3vw] mb-5 py-5 sm:p-5 sm:pb-10 lg:pl-10 flex items-center lg:ml-[80px] 2xl:ml-[125px] 2xl:max-w-[1040px] gradient-15 rounded-[20px] sm:rounded-tr-0 sm:rounded-bl-0 2xl:rounded-tr-[20px] 2xl:rounded-bl-[20px]">
        <div id="Image container" className="hidden opacity-[90%] lg:block ">
          <Image
            src={notice.image}
            alt="Logo"
            width={imageWidth}
            height={imageHeight}
          />
        </div>
        <div id="callout-container" className="flex flex-col mr-10 ml-5">
          <div className="flex wrap items-center">
            <div className="flex justify-center">
              <div id="Image container" className="lg:hidden">
                <Image
                  src="../assets/icon-star.svg"
                  alt="MoonDAO Logo"
                  width={iconWidth}
                  height={iconHeight}
                />
              </div>
              <h3 className="flex items-center justify-center ml-2 lg:ml-0 header opacity-80 font-GoodTimes !text-[5vw] sm:!text-[4vw] md:!text-[2vw]">
                {notice.title}
              </h3>
            </div>
          </div>
          <p className="opacity-60 pt-2">{notice.description}</p>
          <Link
            href={notice.buttonLink}
            className="inline-block"
            target="_blank"
            passHref
          >
            <div
              id="button-container"
              className="gradient-2 hover:pl-7 transform transition-all ease-in-out duration-300 rounded-[2vmax] rounded-tl-[10px] mt-5 px-5 py-3 inline-block"
            >
              {notice.buttonText}
            </div>
          </Link>
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
