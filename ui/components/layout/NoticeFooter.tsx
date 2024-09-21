import Image from 'next/image'
import Link from 'next/link'
import { useContext, useEffect, useState } from 'react'
import useCitizen from '@/lib/citizen/useCitizen'
import ChainContext from '@/lib/thirdweb/chain-context'
import Footer from './Footer'

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
  darkBackground?: boolean;
}

export function NoticeFooter({
  defaultTitle = 'Join the Network',
  defaultImage = '../assets/moondao-logo-white.svg',
  defaultDescription = 'Be part of the first open-source, interplanetary network state dedicated to establishing a permanent human presence on the Moon and beyond.',
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
  darkBackground = true,
}: NoticeFooterProps) {
  const { selectedChain } = useContext(ChainContext)
  const isCitizen = useCitizen(selectedChain)

  const [notice, setNotice] = useState({
    title: defaultTitle,
    image: defaultImage,
    description: defaultDescription,
    buttonText: defaultButtonText,
    buttonLink: defaultButtonLink,
  })

  useEffect(() => {
    if (isCitizen) {
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
  ])

  return (
    <div className={`pb-10 md:pb-0 ${darkBackground ? 'md:pl-5 pb-10 w-full pt-5' : 'p-5'}`}>
      <div className="md:pl-10 flex items-center gap-5 lg:ml-[80px] max-w-[970px] gradient-15 mx-5 md:ml-7 p-5 md:mr-5 pb-10 rounded-[5vmax] rounded-tl-[20px]">
        <div id="Image container" className="hidden opacity-[90%] lg:block">
          <Image
            src={notice.image}
            alt="MoonDAO Logo"
            width={150}
            height={150}
          />
        </div>
        <div id="callout-container" className="flex flex-col">
          <div className="flex wrap items-center">
            <div className="flex justify-center">
              <div id="Image container" className="lg:hidden">
                <Image
                  src="../assets/icon-star.svg"
                  alt="MoonDAO Logo"
                  width={40}
                  height={40}
                />
              </div>
              <h3 className="header opacity-80 font-GoodTimes">
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
      <Footer darkBackground={darkBackground} />
    </div>
  )
}
