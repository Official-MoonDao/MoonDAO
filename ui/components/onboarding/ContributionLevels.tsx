import { useLogin, usePrivy, useWallets } from '@privy-io/react-auth'
import Image from 'next/image'
import { Dispatch, useEffect, useState } from 'react'
import { calculateVMOONEY } from '../../lib/tokens/ve-token'
import { useLightMode } from '../../lib/utils/hooks'
import { ArrowSide } from '../assets'

type ContributionLevelProps = {
  lightIcon: string
  darkIcon: string
  title: string
  mooneyValue: number
  usdQuote: number
  intro: string
  points: string[]
  hasVotingPower?: boolean
  selectedLevel: any
  setSelectedLevel: Dispatch<any>
  selectedChain: any
  isRecommended?: boolean
}

function ContributionLevel({
  lightIcon,
  darkIcon,
  title,
  mooneyValue,
  usdQuote,
  intro,
  points,
  hasVotingPower,
  selectedLevel,
  setSelectedLevel,
  selectedChain,
  isRecommended
}: ContributionLevelProps) {
  const { user } = usePrivy()
  const { login } = useLogin({
    onComplete: () => {
      setSelectedLevel({ price: mooneyValue, hasVotingPower })
    },
    onError: (error) => {
      console.log(error)
    },
  })

  const [lightMode] = useLightMode()

  const [levelVotingPower, setLevelVotingPower] = useState<any>()

  useEffect(() => {
    if (hasVotingPower) {
      setLevelVotingPower(
        Math.sqrt(
          +calculateVMOONEY({
            MOONEYAmount: mooneyValue / 2,
            VMOONEYAmount: 0,
            time: Date.now() * 1000 * 60 * 60 * 24 * 365 * 1,
            lockTime: new Date(),
            max: Date.now() * 1000 * 60 * 60 * 24 * 365 * 4,
          })
        )
      )
    }
  }, [hasVotingPower, mooneyValue])

  return (
    <div
      className={title !== "Citizen" ? `w-[320px] group transition-all duration-150 rounded-[25px] text-black cursor-pointer dark:text-white pb-8 px-7 flex flex-col items-center border-[1px] border-black dark:border-white group hover:border-orange-500 font-RobotoMono ${selectedLevel?.price === mooneyValue
        ? 'border-moon-orange border-opacity-100'
        : 'border-opacity-60 dark:border-opacity-20'
        }` : `w-[320px] group transition-all duration-150 rounded-[25px] text-black cursor-pointer dark:text-white pb-8 px-7 flex flex-col items-center border-[2px] group hover:border-orange-500 font-RobotoMono border-moon-orange border-opacity-100`}
      onClick={() => {
        if (!user) login()
        else {
          setSelectedLevel({ price: mooneyValue, hasVotingPower })
        }
      }}
    >

      <div className="h-full flex flex-col justify-between">
        <div className="flex flex-col justify-center items-center">
          {/*Logo*/}

          <div className="mt-8">

            <Image
              alt={`Icon image for ${title}`}
              src={lightMode ? darkIcon : lightIcon}
              width={71}
              height={81.885}
            />
          </div>
          {/*Title*/}
          <h1
            className={`font-abel mt-[22px] text-3xl transition-all duration-150 ${selectedLevel.price === mooneyValue && 'text-moon-orange'
              }`}
          >
            {title}
          </h1>
          {/*Price, just switch "demoPriceProp" for "levelPrice" to return to normal */}

          <p className="mt-5 lg:mt-[5px] text-center">{`~ $${
            usdQuote?.toFixed(0) || ''
          } USD`}</p>

          <p className="py-4 2xl:h-[120px] leading-[18.46px] font-normal">
            {intro}
          </p>

          {isRecommended && (
            <div className=" top-0 right-0 mt-2 mr-2 bg-moon-orange text-white py-1 px-2 rounded">
              Most Popular
            </div>
          )}
          <div
            className="mt-4 text-left text-sm"
            style={{ marginBottom: '30px' }}
          >
            {/*Perk List*/}

            <div className="mt-[8px] pr-2 2xl:h-[230px] mb-8">
              <ul className={`mt-1  flex flex-col list-disc w-full gap-1`}>
                <div>
                  {
                    title === 'Explorer' && (
                      `✓ ${hasVotingPower
                        ? (mooneyValue / 2).toLocaleString()
                        : mooneyValue.toLocaleString()
                      } $MOONEY.`
                    )
                  }
                  {

                    (title === "Citizen" || title === "Pioneer") && (
                      `✓ ${hasVotingPower
                        ? (mooneyValue / 2).toLocaleString()
                        : mooneyValue.toLocaleString()
                      } $MOONEY to purchase up to (${title === "Citizen" ? 12 : 50}) Ticket to Space entries`
                    )
                  }
                </div>
                {
                  (title === "Citizen" || title === 'Pioneer') && (
                    `✓ ${hasVotingPower
                      ? (mooneyValue / 2).toLocaleString()
                      : mooneyValue.toLocaleString()
                    } $MOONEY staked for two years for co-governance of the MoonDAO treasury`
                  )
                }
                {points.map((point, i) => (
                  <div
                    key={`contribution-level-${title}-desc-point-${i}`}
                    className="text-sm"
                  >
                    {'✓ ' + point}
                  </div>
                ))}
              </ul>
            </div>
          </div>
        </div>
        <button
          className={`mt-3 border flex justify-center items-center gap-3 ${selectedLevel.price === mooneyValue
            ? 'border-moon-orange'
            : 'border-white-500'
            } rounded-md group-hover:scale-105 group-hover:bg-moon-orange group-hover:border-moon-orange px-5 py-3 transition-all duration-150 ${selectedLevel.price === mooneyValue
              ? 'bg-moon-orange'
              : 'bg-transparent'
            }`}
          style={{
            width: '261px',
            height: '50px',
            padding: '12px, 20px, 12px, 20px',
            textAlign: 'center',
          }}
        >
          {'Get Started'} <ArrowSide />
        </button>
      </div>
    </div>
  )
}

export function ContributionLevels({
  selectedLevel,
  setSelectedLevel,
  selectedChain,
  usdQuotes,
}: any) {
  {
    /*Card component */
  }
  console.log(usdQuotes)
  // ;('Everything in the Citizen Tier.Exclusive promotion opportunities. Access to talent to help design, build, test your space hardware. 1,000,000 Voting Power 1,000,000 MOONEY')
  return (
    <div className="flex flex-col min-[1400px]:flex-row justify-between mt-8 2xl:w-full 2xl:gap-[7.5%] lg:mt-12 gap-[18px] lg:gap-5">
      <ContributionLevel
        lightIcon="/onboarding-icons/explorer-white.svg"
        darkIcon="/onboarding-icons/explorer-black.svg"
        title="Explorer"
        intro="Want to go to space? You won't receive voting power or become a MoonDAO Member, but you'll have enough $MOONEY for two entries into our sweepstakes."
        mooneyValue={40000}
        usdQuote={usdQuotes[0]}
        points={[
          'Can purchase up to (2) Ticket to Space Entries',
          'MoonDAO Marketplace Access',
          'Exclusive MoonDAO Discord Access',
        ]}
        selectedLevel={selectedLevel}
        setSelectedLevel={setSelectedLevel}
        selectedChain={selectedChain}
      />
      <ContributionLevel
        lightIcon="/onboarding-icons/citizen-white.svg"
        darkIcon="/onboarding-icons/citizen-black.svg"
        title="Citizen"
        intro="Take an active seat in the construction of the largest network-state focused on becoming multi-planetary. Full voting power citizen."
        mooneyValue={500000}
        usdQuote={usdQuotes[1]}
        points={[
          'Everything in the Explorer Tier',
          'Submit Proposals for Projects',
          'Free Events Access',
        ]}
        hasVotingPower
        selectedLevel={selectedLevel}
        setSelectedLevel={setSelectedLevel}
        selectedChain={selectedChain}
        isRecommended
      />
      <ContributionLevel
        lightIcon="/onboarding-icons/industry-white.svg"
        darkIcon="/onboarding-icons/industry-black.svg"
        title="Pioneer"
        intro="For our biggest supporters, companies, and whales. If you want to deeply support what we’re doing, this is for you."
        mooneyValue={2000000}
        usdQuote={usdQuotes[2]}
        points={[
          'Everything in the Citizen Tier',
          'Exclusive promotion opportunities to MoonDAO community members',
          'Access to talent to help design, build, and test your space hardware',
        ]}
        hasVotingPower
        selectedLevel={selectedLevel}
        setSelectedLevel={setSelectedLevel}
        selectedChain={selectedChain}
      />
    </div>
  )
}
