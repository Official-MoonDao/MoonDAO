import { ThirdwebNftMedia } from '@thirdweb-dev/react'
import Image from 'next/image'
import Link from 'next/link'
import { useRouter } from 'next/router'
import { ReactNode, useEffect, useState } from 'react'
import Frame from '../layout/Frame'
import StandardButton from '../layout/StandardButton'

interface IndexCardProps {
  icon?: string
  iconAlt?: string
  header?: string
  paragraph?: ReactNode
  link?: string
  onClick?: Function
  hovertext?: string
  metadata?: any
}

export default function IndexCard({
  icon,
  iconAlt,
  header,
  paragraph,
  link,
  onClick,
  hovertext,
  metadata,
}: IndexCardProps) {
  icon = icon ?? '/assets/icon-passport.svg'
  iconAlt = iconAlt ?? 'Star'

  const router = useRouter()

  const [citizenDiscord, setCitizenDiscord] = useState<string | undefined>()
  const [isLoadingRoute, setIsLoadingRoute] = useState<boolean>(false)

  useEffect(() => {
    if (metadata) {
      const discordAttribute = metadata.attributes?.find(
        (attr: any) => attr.trait_type === 'discord'
      )
      setCitizenDiscord(discordAttribute?.value)
    }
  }, [metadata])

  const cardContent = (
    <span
      id="index-card-container"
      className="animate-fadeIn flex flex-col relative bg-dark-cool w-full h-full"
    >
      <div
        id="index-card-styling"
        className="rounded-[20px] w-[30%] h-[30%] absolute top-0 left-0 pb-5"
      ></div>
      <span
        id="index-content-container"
        className="h-full p-[20px] md:pb-10 rounded-[20px] overflow-hidden flex flex-col justify-between "
      >
        <span
          id="index-content"
          className={`animate-fadeIn relative z-50 flex flex-col items-center ${
            isLoadingRoute && 'animate-pulse'
          }`}
        >
          <Image
            id="index-featured-icon"
            src={icon}
            alt={iconAlt}
            width="250"
            height="250"
            className="z-20 w-[100px] h-[100px] pb-5"
          />
          <h2
            id="index-main-header"
            className="z-20 pt-[20px] mb-5 static-sub-header font-GoodTimes text-center justify-center md:justify-start"
          >
            {header && header}
            {metadata?.name}
          </h2>
          <div
            id="index-description-and-id-container"
            className="relative z-50 flex justify-center w-full"
          >
            <div
              id="index-description-and-id"
              className="description text-left "
            >
              <div className="flex opacity-[70%]">{paragraph}</div>
              {metadata?.id && (
                <div id="index-details-container" className="mt-4">
                  <p id="index-org-description">
                    {metadata.description && metadata.description.length > 100
                      ? `${metadata.description.slice(0, 100)}...`
                      : metadata.description}
                  </p>
                  {citizenDiscord && (
                    <div id="index-handle-container">
                      Discord: @{citizenDiscord}
                    </div>
                  )}
                </div>
              )}
              {hovertext && metadata?.name && (
                <span
                  id="index-mobile-button-container"
                  className="md:hidden flex pt-5 pb-5 justify-start w-full"
                >
                  <StandardButton
                    textColor="text-white"
                    borderRadius="rounded-tl-[10px] rounded-[2vmax]"
                    link="#"
                    paddingOnHover="pl-5"
                    className="gradient-2"
                    styleOnly={true}
                  >
                    {hovertext}
                  </StandardButton>
                </span>
              )}
            </div>
            {hovertext && (
              <span
                id="index-hovertext-container"
                className="hovertext absolute left-0 bottom-[-320px] ml-[-20px] w-[calc(100%+80px)] h-[calc(100%+300px)] p-[20px] text-lg text-white md:text-darkest-cool hovertext-bg flex justify-center z-50"
              >
                <span id="hovertext" className="hidden md:block">
                  {hovertext}
                </span>
              </span>
            )}
          </div>
        </span>
      </span>
    </span>
  )

  return (
    <span
      id="index-link-frame"
      className="card-container h-full mb-5 z-30 w-full flex lg:flex-col rounded-[20px] relative overflow-hidden"
    >
      <span
        id="index-Interactive-Element"
        className="clip absolute h-full w-full z-10 transition-transform transform hover:scale-110"
      ></span>
      {link || onClick ? (
        <button
          id="index-card-link"
          onClick={() => {
            if (onClick) onClick()
            else if (link) router.push(link)
          }}
          className="w-full h-full block"
        >
          {cardContent}
        </button>
      ) : metadata?.name ? (
        <button
          onClick={async () => {
            setIsLoadingRoute(true)
            const route = await router.push(`/citizen/${metadata.id}`)
            if (route) setIsLoadingRoute(false)
          }}
        >
          {cardContent}
        </button>
      ) : (
        cardContent
      )}
    </span>
  )
}
