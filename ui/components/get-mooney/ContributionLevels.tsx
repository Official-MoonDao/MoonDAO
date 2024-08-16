import { useLogin, usePrivy } from '@privy-io/react-auth'
import Image from 'next/image'
import { Dispatch, useEffect, useState } from 'react'
import { calculateVMOONEY } from '@/lib/tokens/ve-token'
import { useLightMode } from '@/lib/utils/hooks'
import { ArrowSide } from '@/components/assets'

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
  isRecommended,
}: ContributionLevelProps) {
  const { user } = usePrivy()

  const { login } = useLogin({
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
      className={
        title !== 'Citizen'
          ? `w-[320px] min-[1300px]:min-h-[900px] group transition-all duration-150 rounded-[25px] text-black cursor-pointer dark:text-white pb-8 px-7 flex flex-col items-center border-[1px] border-black dark:border-white group hover:border-orange-500 font-RobotoMono ${
              selectedLevel?.price === mooneyValue
                ? 'border-moon-orange border-opacity-100'
                : 'border-opacity-60 dark:border-opacity-20'
            }`
          : `w-[320px] min-[1300px]:min-h-[900px] group transition-all duration-150 rounded-[25px] text-black cursor-pointer dark:text-white pb-8 px-7 flex flex-col items-center border-[2px] group hover:border-orange-500 font-RobotoMono border-moon-orange border-opacity-100`
      }
      onClick={() => {
        if (!user) login()
        setSelectedLevel({ price: mooneyValue, hasVotingPower })
      }}
    >
      <div className="h-full flex flex-col justify-between">
        <div className="flex flex-col justify-center items-center">
          {/*Logo*/}

          <div className="mt-8 h-[75px]">
            <Image
              alt={`Icon image for ${title}`}
              src={lightMode ? darkIcon : lightIcon}
              width={71}
              height={81.885}
            />
          </div>
          {/*Title*/}
          <h1
            className={`font-abel mt-[22px] text-3xl transition-all duration-150 ${
              selectedLevel.price === mooneyValue && 'text-moon-orange'
            }`}
          >
            {title}
          </h1>
          {/*Price, just switch "demoPriceProp" for "levelPrice" to return to normal */}

          <p className="mt-5 lg:mt-[5px] text-center">{`~$${
            usdQuote?.toFixed(0) || ''
          } USD*`}</p>

          <p className="mt-2 p-2 2xl:h-[120px] leading-[18.46px] font-normal">
            {intro}
          </p>

          <div
            className="mt-2 text-left text-sm"
            style={{ marginBottom: '30px' }}
          >
            {/*Perk List*/}

            <div className="p-2 mt-8 pr-2 2xl:h-[230px] mb-8">
              <ul className={`flex flex-col list-disc w-full gap-1`}>
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
        {isRecommended && (
          <div className="my-4 w-full flex justify-center">
            <button className="bg-moon-orange text-white py-1 px-2 rounded">
              Most Popular
            </button>
          </div>
        )}
        <button
          className={`py-12 px-20 mt-3 border flex justify-center items-center gap-3 ${
            selectedLevel.price === mooneyValue
              ? 'border-moon-orange'
              : 'border-white-500'
          } rounded-md group-hover:scale-105 group-hover:bg-moon-orange group-hover:border-moon-orange px-5 py-3 transition-all duration-150 ${
            selectedLevel.price === mooneyValue
              ? 'bg-moon-orange'
              : 'bg-transparent'
          }`}
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
  return (
    <div className="p-4 w-full flex flex-col min-[1300px]:flex-row max-[1300px]:items-center justify-between md:justify-center mt-6 lg:mt-8 gap-8">
      <ContributionLevel
        lightIcon="/onboarding-icons/explorer-white.svg"
        darkIcon="/onboarding-icons/explorer-black.svg"
        title="20k"
        intro="Take your first small step with MoonDAO and participate in governance. 
        "
        mooneyValue={20000}
        usdQuote={usdQuotes[0]}
        points={[
          '10,000 $MOONEY for personal use, like buying from the Marketplace',
          '10,000 $vMOONEY, locked for one year to vote and co-govern MoonDAO',
          'Retain full ownership of $MOONEY and locked voting $vMOONEY',
        ]}
        hasVotingPower
        selectedLevel={selectedLevel}
        setSelectedLevel={setSelectedLevel}
        selectedChain={selectedChain}
      />
      <ContributionLevel
        lightIcon="/onboarding-icons/citizen-white.svg"
        darkIcon="/onboarding-icons/citizen-black.svg"
        title="100k"
        intro="Engage more actively in building and governing MoonDAO."
        mooneyValue={100000}
        usdQuote={usdQuotes[1]}
        points={[
          '50,000 $MOONEY for personal use, like buying from the Marketplace',
          '50,000 $vMOONEY, locked for one year to vote and co-govern MoonDAO',
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
        title="500k"
        intro="For dedicated supporters of decentralized space access.
        "
        mooneyValue={500000}
        usdQuote={usdQuotes[2]}
        points={[
          '250,000 $MOONEY for personal use, like buying from the Marketplace',
          '250,000 $vMOONEY, locked for one year to vote and co-govern MoonDAO',
        ]}
        hasVotingPower
        selectedLevel={selectedLevel}
        setSelectedLevel={setSelectedLevel}
        selectedChain={selectedChain}
      />
    </div>
  )
}
