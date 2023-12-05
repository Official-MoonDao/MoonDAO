import { useLogin, usePrivy, useWallets } from '@privy-io/react-auth'
import { TradeType } from '@uniswap/sdk-core'
import Image from 'next/image'
import { Dispatch, useContext, useEffect, useState } from 'react'
import toast from 'react-hot-toast'
import PrivyWalletContext from '../../lib/privy/privy-wallet-context'
import { calculateVMOONEY } from '../../lib/tokens/ve-token'
import { useUniswapTokens } from '../../lib/uniswap/UniswapTokens'
import { useUniversalRouter } from '../../lib/uniswap/hooks/useUniversalRouter'
import { useLightMode } from '../../lib/utils/hooks'
import { ArrowSide } from '../assets'
import { LoadingSpinner } from '../layout/LoadingSpinner'

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
}: ContributionLevelProps) {
  const { user } = usePrivy()
  const { login } = useLogin({
    onComplete: () => {
      // setSelectedLevel({ price: mooneyValue, hasVotingPower })
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
      className={`w-[320px] group transition-all duration-150 rounded-[25px] text-black cursor-pointer dark:text-white pb-8 px-7 flex flex-col items-center border-[1px] border-black dark:border-white group hover:border-orange-500 font-RobotoMono ${
        selectedLevel?.price === mooneyValue
          ? 'border-moon-orange border-opacity-100'
          : 'border-opacity-60 dark:border-opacity-20'
      }`}
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
            className={`font-abel mt-[22px] text-3xl transition-all duration-150 ${
              selectedLevel.price === mooneyValue && 'text-moon-orange'
            }`}
          >
            {title}
          </h1>
          {/*Price, just switch "demoPriceProp" for "levelPrice" to return to normal */}

          <p className="mt-5 lg:mt-[5px] text-center">{`~ ${usdQuote.toFixed(
            2
          )} USD`}</p>

          <p className="py-4 2xl:h-[120px] leading-[18.46px] font-normal">
            {intro}
          </p>

          <div
            className="mt-4 text-left text-sm"
            style={{ marginBottom: '20px' }}
          >
            {/*Perk List*/}

            <div className="mt-[8px] pr-2 2xl:h-[210px]">
              <ul className={`mt-1  flex flex-col list-disc w-full gap-1`}>
                <div>{`✓ ${
                  hasVotingPower
                    ? (mooneyValue / 2).toLocaleString()
                    : mooneyValue.toLocaleString()
                } $MOONEY`}</div>
                {hasVotingPower && (
                  <div className="text-sm">
                    {`✓ ${Math.floor(
                      levelVotingPower
                    ).toLocaleString()} Voting Power`}
                  </div>
                )}
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
          className={`mt-3 border flex justify-center items-center gap-3 ${
            selectedLevel.price === mooneyValue
              ? 'border-moon-orange'
              : 'border-white-500'
          } rounded-md group-hover:scale-105 group-hover:bg-moon-orange group-hover:border-moon-orange px-5 py-3 transition-all duration-150 ${
            selectedLevel.price === mooneyValue
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
  // ;('Everything in the Citizen Tier.Exclusive promotion opportunities. Access to talent to help design, build, test your space hardware. 1,000,000 Voting Power 1,000,000 MOONEY')
  return (
    <div className="flex flex-col min-[1400px]:flex-row justify-between mt-8 2xl:w-full 2xl:gap-[7.5%] lg:mt-12 gap-[18px] lg:gap-7">
      <ContributionLevel
        lightIcon="/onboarding-icons/explorer-white.svg"
        darkIcon="/onboarding-icons/explorer-black.svg"
        title="Explorer"
        intro="Perfect for those that want to dip their feet into the MoonDAO community."
        mooneyValue={100}
        usdQuote={usdQuotes[0]}
        points={[
          'Can purchase (2) Ticket to Space Entries',
          'MoonDAO Marketplace Access',
          'MoonDAO Community Discord Access',
          'MoonDAO Newsletter Updates',
        ]}
        selectedLevel={selectedLevel}
        setSelectedLevel={setSelectedLevel}
        selectedChain={selectedChain}
      />
      <ContributionLevel
        lightIcon="/onboarding-icons/citizen-white.svg"
        darkIcon="/onboarding-icons/citizen-black.svg"
        title="Citizen"
        intro="Take an active seat in the construction of the largest network-state focused on becoming multi-planetary."
        mooneyValue={50}
        usdQuote={usdQuotes[1]}
        points={[
          'Can purchase (12) Ticket To Space Entries',
          'Exclusive Discord Access',
          'MoonDAO Marketplace Access',
          'Co-governance of the MoonDAO Treasury',
          'Submit Proposals for Projects',
          'Free-Events Access',
        ]}
        hasVotingPower
        selectedLevel={selectedLevel}
        setSelectedLevel={setSelectedLevel}
        selectedChain={selectedChain}
      />
      <ContributionLevel
        lightIcon="/onboarding-icons/industry-white.svg"
        darkIcon="/onboarding-icons/industry-black.svg"
        title="Industry"
        intro="If you’re a company that would like to join the coalition of organizations supporting MoonDAO, or a Whale that loves what we’re doing, this is for you."
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
