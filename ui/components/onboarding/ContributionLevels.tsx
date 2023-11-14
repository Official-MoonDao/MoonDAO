import { usePrivy } from '@privy-io/react-auth'
import { SwapRoute } from '@uniswap/smart-order-router'
import Image from 'next/image'
import { useEffect, useState } from 'react'
import toast from 'react-hot-toast'
import { calculateVMOONEY } from '../../lib/tokens/ve-token'
import { ETH, MOONEY, DAI } from '../../lib/uniswap/UniswapTokens'
import { useSwapRouter } from '../../lib/uniswap/hooks/useSwapRouter'

type ContributionLevelProps = {
  icon: string
  title: string
  prices: {
    price: number
    nativeQuote: number
    mooneyQuote: number
  }
  intro: string
  points: string[]
  hasVotingPower?: boolean
}

export function ContributionLevels({
  selectedLevel,
  setSelectedLevel,
  pregenSwapRoutes,
}: any) {
  {
    /*Card component */
  }
  function ContributionLevel({
    icon,
    title,
    prices,
    intro,
    points,
    hasVotingPower,
  }: ContributionLevelProps) {
    const { user } = usePrivy()

    const { price, nativeQuote, mooneyQuote } = prices

    const [levelVotingPower, setLevelVotingPower] = useState<any>()

    useEffect(() => {
      if (hasVotingPower) {
        setLevelVotingPower(
          calculateVMOONEY({
            MOONEYAmount: mooneyQuote / 2,
            VMOONEYAmount: 0,
            time: Date.now() * 1000 * 60 * 60 * 24 * 365 * 2,
            lockTime: new Date(),
            max: Date.now() * 1000 * 60 * 60 * 24 * 365 * 4,
          })
        )
      }
    }, [mooneyQuote])

    return (
      <div
        className={`w-[320px] group transition-all duration-150 text-black cursor-pointer dark:text-white pb-4 px-7 flex flex-col items-center border-[1px] border-white group hover:border-orange-500 font-RobotoMono ${
          selectedLevel?.price === nativeQuote
            ? 'border-moon-orange border-opacity-100'
            : 'border-opacity-20'
        }`}
        onClick={() => {
          if (!user) toast.error('Please connect a wallet to continue')
          else if (!nativeQuote)
            toast.error('Please wait for swap data to load.')
          else setSelectedLevel({ price: nativeQuote, hasVotingPower })
        }}
      >
        {/*Logo*/}
        <div className="mt-8">
          <Image
            alt={`Icon image for ${title}`}
            src={icon}
            width={71}
            height={81.885}
          />
        </div>
        {/*Title*/}
        <h1
          className={`font-abel mt-[22px] text-3xl transition-all duration-150 ${
            selectedLevel.price === nativeQuote && 'text-moon-orange'
          }`}
        >
          {title}
        </h1>
        {/*Price, just switch "demoPriceProp" for "levelPrice" to return to normal */}
        <p className="mt-5 lg:mt-[23px] text-center">
          {`$${price.toLocaleString()}/month (~ ${nativeQuote?.toFixed(
            2
          )} ETH)`}
          <br />
          Billed Annually
        </p>
        {/*Line*/}
        <div className="mt-[17px] bg-white opacity-[0.13] w-11/12 h-[1px]"></div>
        <div className="mt-4 text-left text-sm">
          {/*Intro*/}
          <p className="2xl:h-[120px]">{intro}</p>
          {/*Perk List*/}
          <div className="mt-[38px] pr-2 2xl:h-[210px]">
            <p>Perks:</p>
            <ul className={`mt-1 ml-6 flex flex-col list-disc w-full gap-1`}>
              {points.map((point, i) => (
                <li
                  key={`contribution-level-${title}-desc-point-${i}`}
                  className="text-sm"
                >
                  {'' + point}
                </li>
              ))}
              {hasVotingPower && (
                <li>{`Voting Power : ${
                  levelVotingPower ? levelVotingPower : '...loading'
                }`}</li>
              )}
              <li>
                {`$MOONEY : ${
                  mooneyQuote && hasVotingPower
                    ? Number(mooneyQuote / 2)?.toLocaleString()
                    : mooneyQuote
                    ? mooneyQuote?.toLocaleString()
                    : '...loading'
                }`}
              </li>
            </ul>
          </div>
        </div>
        <button
          className={`mt-10 bg-moon-orange group-hover:scale-105 px-5 py-3 transition-all duration-150 ${
            selectedLevel.price === nativeQuote && ''
          }`}
        >
          {'Get Started >'}
        </button>
      </div>
    )
  }
  // ;('Everything in the Citizen Tier.Exclusive promotion opportunities. Access to talent to help design, build, test your space hardware. 1,000,000 Voting Power 1,000,000 MOONEY')
  return (
    <div className="flex flex-col md:flex-row justify-evenly mt-8 2xl:w-full 2xl:gap-[7.5%] lg:mt-12 gap-[18px] lg:gap-7">
      <ContributionLevel
        icon="/explorer.png"
        title="Explorer"
        prices={pregenSwapRoutes[0]}
        intro="Perfect for those that want to dip their feet into the MoonDAO community."
        points={[
          'Participate in sweepstakes like Blue Origin Launch and Zero Gravity Flights.',
          'Access to the Special Channels in the Community Discord.',
          'Access to the MoonDAO Marketplace.',
        ]}
      />
      <ContributionLevel
        icon="/citizen.png"
        title="Citizen"
        prices={pregenSwapRoutes[1]}
        intro="Take an active seat in the construction of the largest network-state focused on becoming multi-planetary."
        points={[
          'Proposal Submission Power.',
          'Co-governance of the MoonDAO Treasury.',
          'Exclusive industry-focused networking opportunities.',
        ]}
        hasVotingPower
      />
      {/* <ContributionLevel
        icon="/industry.png"
        title="Industry"
        prices={pregenSwapRoutes[2]}
        intro="If you’re a company that would like to join the coalition of organizations supporting MoonDAO, or a Whale that loves what we’re doing, this is for you."
        points={[
          'Everything in the Citizen Tier.',
          'Exclusive promotion opportunities.',
          'Access to talent to help design, build, test your space hardware.',
        ]}
        hasVotingPower
      /> */}
    </div>
  )
}
