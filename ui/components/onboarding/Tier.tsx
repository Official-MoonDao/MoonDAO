import { usePrivy } from '@privy-io/react-auth'
import Image from 'next/image'
import { useActiveAccount } from 'thirdweb/react'

type TierProps = {
  label: string
  description: string
  points: any[]
  price: number
  usdPrice: number
  onClick: () => void
  hasCitizen?: boolean
  buttoncta: string
  tierDescription?: string
  type: string
  compact?: boolean
}

export default function Tier({
  label,
  description,
  tierDescription,
  points,
  buttoncta,
  price,
  usdPrice,
  onClick,
  type,
  compact = false,
}: TierProps) {
  const account = useActiveAccount()
  const address = account?.address
  const { login, user, logout } = usePrivy()

  const iconStar = './assets/icon-star.svg'

  return (
    <section
      id="callout-card-container"
      className={`bg-black/20 backdrop-blur-sm border border-white/10 rounded-[2vmax] md:bg-transparent z-[50] ${
        compact && 'max-w-[900px]'
      }`}
    >
      <div className="bg-black/20 backdrop-blur-sm border border-white/10 md:rounded-[2vmax] p-8">
        <div
          className={`w-full transition-all duration-150 ${
            !compact && 'pb-10'
          } cursor-pointer text-white text-opacity-[90%] hover:text-opacity-100`}
          onClick={() => {
            if (!compact) {
              if (!address && user) logout()
              if (!address) return login()

              onClick()
            }
          }}
        >
          <div className="w-full h-full flex flex-col md:flex-row">
            <div className="pt-5 md:pt-0 flex items-center rounded-2xl overflow-hidden">
              <Image
                src={
                  type === 'team'
                    ? '/assets/team_image.png'
                    : '/assets/citizen-default.png'
                }
                width={506}
                height={506}
                alt=""
                className="rounded-xl"
              />
            </div>

            <div className="flex flex-col p-6 justify-between w-full items-start">
              <div className="w-full flex-col space-y-6">
                <div className="md:rounded-2xl">
                  <h2 className={'mt-6 font-GoodTimes text-3xl text-white'}>
                    {label}
                  </h2>
                  <p className="text-slate-300 mt-3 leading-relaxed">
                    {description}
                  </p>

                  <div className="flex flex-col w-full mt-6">
                    <div className="flex flex-col pt-5 items-start">
                      <div className="flex flex-row items-center space-x-2">
                        <div className="flex flex-col items-start">
                          <div className="flex flex-col lg:flex-row lg:items-center gap-2">
                            <p className="text-xl md:text-2xl font-semibold text-white">
                              {`~$${Math.round(usdPrice)} / Year`}
                            </p>
                            <p className="text-sm text-slate-400">
                              ({price} Arbitrum ETH)
                            </p>
                          </div>
                        </div>
                      </div>
                      <p className="text-green-400 text-sm md:text-base font-medium mt-2">
                        ✓ 12 Month Passport
                      </p>
                    </div>
                  </div>
                </div>
              </div>
              {compact && (
                <div className="inline-block">
                  <div className="mt-6 rounded-2xl gradient-2 hover:scale-105 transition-transform">
                    <button className="py-3 px-6 font-medium text-white">
                      {buttoncta}
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
          <div className="mt-4 lg:mt-6">
            {!compact &&
              points.map((p, i) => {
                const [title, description] = p.split(': ')
                return (
                  <div
                    key={`${label}-tier-point-${i}`}
                    className="flex flex-row items-start pb-2 rounded-lg bg-black/20 backdrop-blur-sm border border-white/10 p-3 mb-2 space-x-3"
                  >
                    <Image
                      alt="Bullet Point"
                      src={iconStar}
                      width={24}
                      height={24}
                      className="mt-1 flex-shrink-0"
                    ></Image>
                    <p className="text-slate-300 leading-relaxed">
                      <strong className="text-white">{title}:</strong>{' '}
                      {description}
                    </p>
                  </div>
                )
              })}
            {tierDescription && (
              <p className="text-slate-300 mt-4">{tierDescription}</p>
            )}
          </div>

          {!compact && (
            <div className="inline-block mt-6">
              <div className="rounded-2xl gradient-2 hover:scale-105 transition-transform">
                <button className="py-3 px-6 font-medium text-white">
                  {buttoncta}
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </section>
  )
}
