import { P } from '@privy-io/react-auth/dist/dts/types-CWBSfCm7'
import Image from 'next/image'
import Link from 'next/link'
import { useRouter } from 'next/router'
import { ReactNode, useState } from 'react'
import { MediaRenderer } from 'thirdweb/react'
import client from '@/lib/thirdweb/client'
import Frame from '../layout/Frame'
import StandardButton from '../layout/StandardButton'
import CollapsibleContainer from './CollapsibleContainer'

type StandardWideCardProps = {
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
  stats?: any
  type?: string
  profile?: boolean
  footer?: any
  height?: string
}

export default function StandardWideCard({
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
  stats,
  type,
  profile = false,
  footer,
}: StandardWideCardProps) {
  const router = useRouter()
  const [isExpanded, setIsExpanded] = useState(false)

  const cardContent = (
    <div>
      <span
        id="card-container"
        className={`relative animate-fadeIn flex flex-col relative bg-dark-cool rounded-[20px] w-full h-full`}
      >
        {/* Ensure the card content takes full height */}
        <div className="flex-grow">
          <div
            id="card-styling"
            className="bg-dark-cool rounded-[20px] w-full h-full absolute top-0 left-0"
          ></div>
          <span
            id="content-container"
            className={`h-full p-[32px] rounded-[20px] overflow-hidden flex flex-col justify-between bg-[#14162c]`}
          >
            <span
              id="content"
              className={`animate-fadeIn relative z-50 flex flex-col gap-6`}
            >
              <div className="flex flex-col md:flex-row gap-4 items-center">
                {/* Image section */}
                {(image || orgimage) && (
                  <div className="relative w-[200px] h-[200px] rounded-full overflow-hidden bg-gray-300 flex-shrink-0">
                    {image ? (
                      image.startsWith('blob:') ? (
                        <Image
                          className="w-full h-full object-cover"
                          src={image}
                          alt="Card image"
                          width={200}
                          height={200}
                        />
                      ) : (
                        <MediaRenderer
                          className="w-full h-full object-cover"
                          client={client}
                          src={image}
                          width="200px"
                          height="200px"
                        />
                      )
                    ) : (
                      orgimage && (
                        <Image
                          src={orgimage}
                          alt="Team Image"
                          width={200}
                          height={200}
                          className="w-full h-full object-cover"
                        />
                      )
                    )}
                  </div>
                )}

                <div className="w-full flex flex-col">
                  {/* Title and tagline section */}
                  <div className="flex flex-col gap-2">
                    <h2 className="font-GoodTimes text-2xl text-white">
                      {header || title || (profile && 'Anon')}
                    </h2>
                    {subheader && (
                      <p className="text-gray-400 text-lg">{subheader}</p>
                    )}
                  </div>
                  {stats && (
                    <div className="mt-4 flex flex-row gap-4">{stats}</div>
                  )}
                </div>
              </div>

              {/* Description section */}
              <div
                className={`text-gray-300 overflow-hidden ${
                  isExpanded ? 'h-full' : 'h-[100px]'
                }`}
              >
                {paragraph}
              </div>

              {/* Add Show More button */}

              {footer && <div className="mt-4">{footer}</div>}
            </span>
          </span>
        </div>
      </span>
      <div className="absolute bottom-[-20px] left-[5%] gradient-2 rounded-full">
        <StandardButton
          onClick={(e: React.MouseEvent) => {
            e.preventDefault()
            e.stopPropagation()
            setIsExpanded(!isExpanded)
          }}
          styleOnly={true}
        >
          {isExpanded ? 'Show Less' : 'Show More'}
        </StandardButton>
      </div>
    </div>
  )

  return (
    <span
      id="link-frame"
      className={`
                card-container mb-4 min-w-[300px] flex lg:flex-col rounded-[20px] relative 
                ${link ? 'cursor-pointer' : ''}
            `}
    >
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
