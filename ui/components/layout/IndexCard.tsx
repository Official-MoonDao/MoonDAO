import Image from 'next/image'
import { useRouter } from 'next/router'
import { ReactNode, useEffect, useState } from 'react'
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
      className="group animate-fadeIn flex flex-col relative bg-dark-cool w-full h-full"
    >
      <div
        id="index-card-styling"
        className="bg-darkest-cool rounded-[20px] w-[30%] h-[30%] absolute top-0 left-0 pb-5"
      ></div>
      <span
        id="index-content-container"
        className="h-full p-[20px] md:pb-10 rounded-[20px] overflow-hidden flex flex-col justify-between border-b-[3px] border-x-[3px] border-darkest-cool min-h-[250px] md:min-h-[320px]"
      >
        <span
          id="index-content"
          className="animate-fadeIn relative z-50 flex flex-col items-center"
        >
          {icon || iconAlt ? (
            <Image
              id="index-featured-icon"
              src={icon || ''}
              alt={iconAlt || ''}
              width="250"
              height="250"
              className="z-20 w-[60px] h-[60px] md:w-[100px] md:h-[100px] pb-3 md:pb-5"
            />
          ) : (
            <></>
          )}
          <h2
            id="index-main-header"
            className="z-20 pt-[20px] mb-3 md:mb-5 static-sub-header font-GoodTimes text-left justify-start text-lg md:text-xl"
          >
            {header && header}
            {metadata?.name}
          </h2>
          <div
            id="index-description-and-id-container"
            className="relative z-50 flex justify-start w-full"
          >
            <div
              id="index-description-and-id"
              className="description text-left relative z-50 w-full opacity-100 !opacity-100"
              style={{ opacity: '1 !important' }}
            >
              <div className="flex justify-center text-center text-sm md:text-base">{paragraph}</div>
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
                <div
                  id="index-hovertext-always-container"
                  className="mt-5 flex justify-start w-full relative z-50"
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
                </div>
              )}
            </div>
          </div>
        </span>
      </span>
    </span>
  )

  return (
    <span
      id="index-link-frame"
      className="card-container at-a-glance-card h-full mb-5 z-30 w-full flex lg:flex-col rounded-[20px] relative overflow-hidden transition-all hover:ring-2 hover:ring-white"
    >
      <span
        id="index-Interactive-Element"
        className="clip absolute h-full w-full z-10 transition-all pointer-events-none opacity-100"
      />
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
