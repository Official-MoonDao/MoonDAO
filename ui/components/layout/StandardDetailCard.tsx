import Image from 'next/image'
import Link from 'next/link'
import { useRouter } from 'next/router'
import { truncateTokenValue } from '@/lib/utils/numbers'
import Frame from '@/components/layout/Frame'
import IPFSRenderer from './IPFSRenderer'

type StandardDetailCardProps = {
  title?: string
  subheader?: any
  paragraph?: string
  image?: string
  link?: string
  onClick?: () => void
  price?: string
  currency?: string
  isCitizen?: boolean
}

export default function StandardDetailCard({
  title,
  subheader,
  paragraph,
  image,
  link,
  onClick,
  price,
  currency,
  isCitizen = false,
}: StandardDetailCardProps) {
  const router = useRouter()
  const CardContent = (
    <div className="w-full h-full p-4 bg-black/20 backdrop-blur-sm rounded-2xl border border-white/10 hover:border-white/20 transition-all duration-200 group">
      <div className="flex flex-row items-start gap-4 w-full h-full">
        {image && (
          <div className="w-[80px] h-[80px] sm:w-[100px] sm:h-[100px] md:w-[120px] md:h-[120px] flex-shrink-0">
            <IPFSRenderer
              className="w-full h-full object-cover rounded-xl border border-slate-600/50"
              src={image}
              width={500}
              height={500}
              alt={title || ''}
            />
          </div>
        )}
        <div className="flex-1 min-w-0 flex flex-col justify-between h-full">
          <div>
            <h1 className="font-bold font-GoodTimes text-xl text-white break-words group-hover:text-slate-200 transition-colors text-left">
              {title}
            </h1>
            <div className="break-words text-left mb-3">{subheader}</div>
            <p className="hidden md:block text-sm text-slate-300 leading-relaxed break-words text-left">
              {paragraph && paragraph?.length > 200
                ? paragraph.slice(0, 200) + '...'
                : paragraph}
            </p>
          </div>

          {/* Pricing Information */}
          {price && currency && (
            <div className="mt-3 text-sm">
              <div className="flex flex-col gap-2">
                <div className="flex items-center gap-2">
                  <p className="font-bold text-white">
                    {`${
                      isCitizen
                        ? truncateTokenValue(price, currency)
                        : truncateTokenValue(+price * 1.1, currency)
                    } ${currency}`}
                  </p>
                  {isCitizen && (
                    <p className="line-through text-xs opacity-70 text-slate-400">
                      {`${truncateTokenValue(
                        +price * 1.1,
                        currency
                      )} ${currency}`}
                    </p>
                  )}
                </div>
                {!isCitizen && (
                  <div className="flex items-center text-sm text-slate-300">
                    <button
                      onClick={(e) => {
                        e.stopPropagation()
                        router.push('/citizen')
                      }}
                      className="bg-light-warm px-2 py-1 rounded mr-1 text-black hover:bg-light-warm/80 transition-colors"
                    >
                      Save 10%
                    </button>
                    {' with citizenship'}
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )

  return (
    <div className={`w-full h-full ${link || onClick ? 'cursor-pointer' : ''}`}>
      {onClick ? (
        <button onClick={onClick} className="block w-full h-full">
          {CardContent}
        </button>
      ) : link ? (
        <Link href={link} className="block w-full h-full">
          {CardContent}
        </Link>
      ) : (
        <div className="w-full h-full">{CardContent}</div>
      )}
    </div>
  )
}
