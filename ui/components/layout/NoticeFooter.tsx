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
  )
}
