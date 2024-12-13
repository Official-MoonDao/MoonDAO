import { usePrivy } from '@privy-io/react-auth'
import { useAddress } from '@thirdweb-dev/react'
import Image from 'next/image'
import toast from 'react-hot-toast'
import { LoadingSpinner } from '../layout/LoadingSpinner'

type TierProps = {
  label: string
  description: string
  points: any[]
  price: number
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
  onClick,
  hasCitizen = false,
  type,
  compact = false,
}: TierProps) {
  const address = useAddress()
  const { login, user, logout } = usePrivy()

  const iconStar = './assets/icon-star.svg'

  return (
    <section
      id="callout-card-container"
      className={`bg-darkest-cool md:bg-transparent z-[50] ${
        compact && 'max-w-[900px]'
      }`}
    >
      <div className="bg-[#020617]  md:rounded-[5vmax] p-5 md:rounded-tl-[20px]">
        <div
          className={`w-full transition-all duration-150 ${
            !compact && 'pb-10'
          } cursor-pointer text-white text-opacity-[80%]`}
          onClick={() => {
            if (!compact) {
              if (!address && user) logout()
              if (!address) return login()
              if (hasCitizen && process.env.NEXT_PUBLIC_CHAIN === 'mainnet')
                return toast.error('You have already registered as a citizen')

              onClick()
            }
          }}
        >
          <div className="w-full h-full flex flex-col lg:flex-row ">
            <div className="pt-5 md:pt-0 flex items-center rounded-[2vmax] rounded-tl-[20px] overflow-hidden">
              <Image
                src={
                  type === 'team'
                    ? '/assets/team_image.png'
                    : '/assets/citizen-default.png'
                }
                width={506}
                height={506}
                alt=""
              />
            </div>

            <div className="flex flex-col p-5 justify-between w-full items-start">
              <div className="w-full flex-col space-y-5">
                <div className="md:rounded-[5vmax] md:rounded-tl-[20px]">
                  <h2 className={'mt-6 font-GoodTimes text-3xl'}>{label}</h2>
                  <p className="opacity-80">{description}</p>

                  <div className="flex flex-col w-full">
                    <div className="flex flex-col pt-5 items-start">
                      <div className="flex flex-row items-center space-x-2">
                        <p className="text-lg md:text-2xl">{price} ETH</p>
                        <p className="text-sm">(Arbitrum) /Year</p>
                      </div>
                      <p className="text-[#753F73] text-sm md:text-lg">
                        &#10003; 12 Month Passport
                      </p>
                    </div>
                  </div>
                </div>
              </div>
              {compact && (
                <div className="inline-block ">
                  <div className="mt-5 rounded-tl-[10px] rounded-[2vmax] gradient-2">
                    <button className="py-2 px-5 hover:pl-7 ease-in-out duration-300">
                      {buttoncta}
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
          <div className="mt-2 lg:mt-5">
            {!compact &&
              points.map((p, i) => {
                const [title, description] = p.split(': ')
                return (
                  <div
                    key={`${label}-tier-point-${i}`}
                    className="flex flex-row bg-opacity-3 pb-2 rounded-sm space-x-2"
                  >
                    <Image
                      alt="Bullet Point"
                      src={iconStar}
                      width={30}
                      height={30}
                    ></Image>
                    <p>
                      <strong>{title}:</strong> {description}
                    </p>
                  </div>
                )
              })}
            <br></br>
            {tierDescription}
          </div>

          {!compact && (
            <div className="inline-block ">
              <div className="mt-5 rounded-tl-[10px] rounded-[2vmax] gradient-2">
                <button className="py-2 px-5 hover:pl-7 ease-in-out duration-300">
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
