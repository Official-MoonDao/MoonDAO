import Image from 'next/image'
import Link from 'next/link'
import { useRouter } from 'next/router'
import { ReactNode } from 'react'
import { MediaRenderer } from 'thirdweb/react'
import client from '@/lib/thirdweb/client'
import Frame from '../layout/Frame'
import StandardButton from '../layout/StandardButton'
import CollapsibleContainer from './CollapsibleContainer'

type StandardCardProps = {
  icon?: string
  iconAlt?: string
  header?: string
  title?: string
  paragraph?: ReactNode
  fullParagraph?: boolean
  link?: string
  headerLink?: string
  headerLinkLabel?: string
  onClick?: () => void
  hovertext?: string
  inline?: boolean
  orgimage?: string
  subheader?: any
  image?: string
  actions?: any
  type?: string
  profile?: boolean
  footer?: any
  height?: string
}

export default function StandardCard({
  icon,
  header,
  title,
  paragraph,
  fullParagraph,
  link,
  headerLink,
  headerLinkLabel,
  onClick,
  hovertext,
  inline,
  iconAlt,
  orgimage,
  subheader,
  image,
  actions,
  type,
  profile = false,
  footer,
}: StandardCardProps) {
  const router = useRouter()

  const cardContent = (
    <span
      id="card-container"
      className={`animate-fadeIn flex flex-col relative bg-dark-cool w-full h-full max-w-[300px] md:max-w-[500px]`}
    >
      {/* Ensure the card content takes full height */}
      <div className="flex-grow">
        <div
          id="card-styling"
          className="bg-darkest-cool rounded-[20px] w-[30%] h-[30%] absolute top-0 left-0 pb-5"
        ></div>
        <span
          id="content-container"
          className={`h-full p-[20px] md:pb-10 rounded-[20px] overflow-hidden flex flex-col justify-between border-b-[3px] border-x-[3px] border-darkest-cool`}
        >
          <span
            id="content"
            className={`animate-fadeIn relative z-50 flex flex-col`}
          >
            {orgimage && (
              <div
                id="featured-image-container"
                className="z-50 animate-fadeIn"
              >
                <Frame noPadding marginBottom="0px">
                  <Image
                    id="featured-image"
                    src={orgimage}
                    alt="Team Image"
                    width="675"
                    height="675"
                    className="w-full h-full"
                  />
                </Frame>
              </div>
            )}
            {image && (
              <div id="team-citizen-image-container" className="z-40">
                <Frame noPadding marginBottom="0px" className="aspect-square">
                  {image.startsWith('blob:') ? (
                    // For local blob URLs (like from URL.createObjectURL)
                    <Image
                      className="w-full h-full object-cover"
                      src={image}
                      alt="Card image"
                      width={500}
                      height={500}
                    />
                  ) : (
                    // For IPFS/remote URLs
                    <MediaRenderer
                      className="w-full h-full object-cover"
                      client={client}
                      src={image}
                      width="100%"
                      height="100%"
                    />
                  )}
                </Frame>
              </div>
            )}

            <div className="mt-4 flex flex-row justify-between items-start">
              {headerLink && headerLinkLabel && (
                <button
                  onClick={(e) => {
                    e.stopPropagation()
                    router.push(headerLink)
                  }}
                  className="w-fit text-light-cool hover:text-light-warm font-GoodTimes text-sm text-left relative z-[60]"
                >
                  {headerLinkLabel}
                </button>
              )}
              <div className="flex flex-row justify-between">
                <span
                  id="title-section"
                  className={`
                flex 
                ${
                  inline
                    ? 'pb-5 flex-row items-center pr-5 justify-start'
                    : 'flex-col justify-center items-center'
                }
              `}
                >
                  {icon && (
                    <Image
                      id="featured-icon"
                      src={icon}
                      alt={iconAlt ?? ''}
                      width="250"
                      height="250"
                      className={`z-20 ${
                        inline
                          ? 'pt-[20px] w-[50px] h-[50px]'
                          : 'w-[100px] h-[100px] pb-5'
                      }`}
                    />
                  )}
                </span>
              </div>
            </div>
            <div className="mt-4 w-full flex">
              <h2
                id="main-header"
                className={`
                    w-full z-20 static-sub-header font-GoodTimes flex min-h-[50px]
                    ${
                      inline
                        ? 'text-left'
                        : 'text-center justify-center md:justify-start'
                    }
                `}
              >
                {header && header}
                {title ? title : profile && 'Anon'}
              </h2>
              <div>{actions && actions}</div>
            </div>

            {subheader && subheader}
            <div id="description-and-id-container" className="relative z-50">
              <div
                id="description-and-id"
                className={`text-left ${hovertext && 'description'}`}
              >
                {fullParagraph ? (
                  <CollapsibleContainer minHeight="100px">
                    {paragraph}
                  </CollapsibleContainer>
                ) : (
                  <div className="flex opacity-[70%] min-h-[100px]">
                    {paragraph &&
                    !fullParagraph &&
                    typeof paragraph === 'string' &&
                    paragraph.length > 100
                      ? `${paragraph.slice(0, 100)}...`
                      : paragraph}
                  </div>
                )}
                {footer && footer}
                {hovertext && (
                  <span
                    id="mobile-button-container"
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
                  id="hovertext-container"
                  className="hovertext absolute left-0 bottom-[-320px] ml-[-20px] w-[calc(100%+40px)] h-[calc(100%+325px)] p-[20px] text-lg rounded-[10px] text-white md:text-darkest-cool hovertext-bg flex justify-center z-50"
                >
                  <span id="hovertext" className="hidden md:block">
                    {hovertext}
                  </span>
                </span>
              )}
            </div>
          </span>
        </span>
      </div>
    </span>
  )

  return (
    <span
      id="link-frame"
      className={`
                card-container min-w-[300px] w-[65vw] md:w-full flex lg:flex-col rounded-[20px] relative overflow-hidden 
                ${link ? 'cursor-pointer' : ''}
            `}
    >
      {link || onClick || headerLink ? (
        <span
          id="Interactive-Element"
          className="clip absolute h-full w-full z-10"
        ></span>
      ) : (
        <span
          id="Static-Element"
          className="divider-8 absolute w-[80%] h-full z-10"
        ></span>
      )}
      {!link && (
        <span
          id="Static-Element"
          className="divider-8 absolute w-[80%] h-full z-10"
        ></span>
      )}
      {onClick ? (
        <button onClick={onClick} className="w-full h-full block">
          {cardContent}
        </button>
      ) : link ? (
        <Link id="card-link" href={link} className="w-full h-full block">
          {cardContent}
        </Link>
      ) : (
        cardContent
      )}
    </span>
  )
}
