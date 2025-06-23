import Image from 'next/image'
import Link from 'next/link'
import { truncateTokenValue } from '@/lib/utils/numbers'
import Frame from '@/components/layout/Frame'
import IPFSRenderer from './IPFSRenderer'

type StandardDetailCardProps = {
  title?: string
  paragraph?: string
  image?: string
  link?: string
  onClick?: () => void
  price?: string
  currency?: string
  isCitizen?: boolean
  shipping?: string
}

export default function StandardDetailCard({
  title,
  paragraph,
  image,
  link,
  onClick,
  price,
  currency,
  isCitizen,
  shipping,
}: StandardDetailCardProps) {
  const CardContent = (
    <div className="w-full">
      <span
        id="card-container"
        className={`animate-fadeIn flex flex-col relative bg-dark-cool w-full h-full rounded-[20px] border border-darkest-cool/30 transition-all duration-300 z-10 hover:border-darkest-cool/60 hover:shadow-lg hover:shadow-darkest-cool/40 hover:scale-[1.02]`}
      >
        {/* Ensure the card content takes full height */}
        <div className="flex-grow">
          <div
            id="card-styling"
            className="bg-darkest-cool rounded-[20px] w-[20%] h-[20%] absolute top-0 left-0 pb-5"
          ></div>
          <span
            id="content-container"
            className={`h-full p-6 rounded-[20px] overflow-hidden flex flex-col border-b-[3px] border-x-[3px] border-darkest-cool relative z-20`}
          >
            <div className="flex flex-row items-start gap-6">
              {/* Image Section */}
              {image && (
                <div className="flex-shrink-0">
                  <div
                    id="team-citizen-image-container"
                    className="z-40 w-[140px] h-[140px]"
                  >
                    <Frame noPadding marginBottom="0px" className="aspect-square">
                      <IPFSRenderer
                        className="w-full h-full object-cover rounded-lg"
                        src={image}
                        width={140}
                        height={140}
                        alt={title || ''}
                      />
                    </Frame>
                  </div>
                </div>
              )}
              
              {/* Content Section */}
              <div className="flex flex-col gap-3 flex-1">
                {/* Title */}
                <h1 className="font-bold font-GoodTimes text-lg text-white text-left">
                  {title}
                </h1>
                
                {/* Description */}
                <p className="text-sm text-gray-400 text-left leading-relaxed h-10 overflow-hidden">
                  {paragraph && paragraph?.length > 100
                    ? paragraph.slice(0, 100) + '...'
                    : paragraph}
                </p>
                
                {/* Price and Info Section */}
                {price && currency && (
                  <div className="flex flex-col gap-2 pt-2 border-t border-gray-600">
                    {/* Price Display */}
                    <div className="flex items-center gap-2">
                      <p className="text-lg font-bold text-moon-orange">
                        {`${
                          isCitizen
                            ? truncateTokenValue(price, currency)
                            : truncateTokenValue(+price * 1.1, currency)
                        } ${currency}`}
                      </p>
                      {isCitizen && (
                        <p className="line-through text-xs opacity-60">
                          {`${truncateTokenValue(+price * 1.1, currency)} ${currency}`}
                        </p>
                      )}
                    </div>
                    
                    {/* Savings Banner for Non-Citizens */}
                    {!isCitizen && (
                      <div className="bg-gradient-to-r from-light-warm to-moon-gold text-dark-cool px-2 py-1 rounded text-xs font-medium">
                        Save {truncateTokenValue(+price * 0.1, currency)} {currency} with citizenship
                      </div>
                    )}
                    
                    {/* Shipping Info */}
                    {shipping === 'true' && (
                      <div className="flex items-center gap-1 text-xs text-gray-400">
                        <span>📦</span>
                        <span>Requires shipping address</span>
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>
          </span>
        </div>
      </span>
    </div>
  )

  return (
    <span
      id="link-frame"
      className="card-container w-full md:w-full flex lg:flex-col rounded-[20px] relative overflow-hidden cursor-pointer"
    >
      {link || onClick ? (
        <span
          id="Interactive-Element"
          className="clip absolute h-full w-full z-0"
        ></span>
      ) : (
        <span
          id="Static-Element"
          className="divider-8 absolute w-[80%] h-full z-0"
        ></span>
      )}
      {!link && !onClick && (
        <span
          id="Static-Element"
          className="divider-8 absolute w-[80%] h-full z-0"
        ></span>
      )}

      {onClick ? (
        <button onClick={onClick} className="block">
          {CardContent}
        </button>
      ) : link ? (
        <Link href={link} className="block">
          {CardContent}
        </Link>
      ) : (
        CardContent
      )}
    </span>
  )
}
