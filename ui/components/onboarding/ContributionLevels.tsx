import { useAddress } from '@thirdweb-dev/react'
import { Ether, Token } from '@uniswap/sdk-core'
import { ethers } from 'ethers'
import Image from 'next/image'
import { useEffect, useState } from 'react'
import { calculateVMOONEY } from '../../lib/tokens/ve-token'
import { useSwapRouter } from '../../lib/uniswap/hooks/useSwapRouter'
import { MOONEY_ADDRESSES } from '../../const/config'

type ContributionLevelProps = {
  icon: string
  title: string
  levelPrice: number
  demoPriceProp: number
  intro: string
  points: string[]
  hasVotingPower?: boolean
}

const ETH: any = Ether.onChain(1)

const MATIC = new Token(
  137,
  '0x0000000000000000000000000000000000001010',
  18,
  'MATIC',
  'MATIC'
)

const MOONEY = new Token(
  1,
  MOONEY_ADDRESSES['ethereum'],
  18,
  'MOONEY',
  'MOONEY'
)

const DAI = new Token(
  1,
  '0x6B175474E89094C44Da98b954EedeAC495271d0F',
  18,
  'DAI',
  'DAI Stablecoin'
)

export function ContributionLevels({ selectedLevel, setSelectedLevel }: any) {
  {
    /*Card component */
  }
  function ContributionLevel({
    icon,
    title,
    levelPrice,
    demoPriceProp,
    intro,
    points,
    hasVotingPower,
  }: ContributionLevelProps) {
    const [mooneyQuote, setMooneyQuote] = useState<string | number>()
    const [nativeQuote, setNativeQuote] = useState<string | number>()
    const [levelVotingPower, setLevelVotingPower] = useState<any>()
    const { generateRoute: generateMooneyRoute } = useSwapRouter(
      levelPrice,
      ETH,
      MOONEY
    )
    const { generateRoute: generateNativeRoute } = useSwapRouter(
      demoPriceProp * 12,
      DAI,
      ETH
    )

    useEffect(() => {
      ;(async () => {
        const mooneyRoute = await generateMooneyRoute()
        setMooneyQuote(mooneyRoute?.route[0].rawQuote.toString() / 10 ** 18)
      })()
    }, [])

    useEffect(() => {
      ;(async () => {
        const nativeRoute = await generateNativeRoute()
        setNativeQuote(
          (nativeRoute?.route[0].rawQuote.toString() / 10 ** 18).toFixed(3)
        )
      })()
    }, [])

    useEffect(() => {
      if (hasVotingPower) {
        setLevelVotingPower(
          calculateVMOONEY({
            MOONEYAmount: mooneyQuote,
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
          selectedLevel === levelPrice
            ? 'border-moon-orange border-opacity-100'
            : 'border-opacity-20'
        }`}
        onClick={() => setSelectedLevel(levelPrice)}
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
            selectedLevel === levelPrice && 'text-moon-orange'
          }`}
        >
          {title}
        </h1>
        {/*Price, just switch "demoPriceProp" for "levelPrice" to return to normal */}
        <p className="mt-5 lg:mt-[23px] text-center">
          {`$${demoPriceProp.toLocaleString()}/month (${
            nativeQuote ? nativeQuote + ' ETH' : '...loading'
          })`}
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
                  mooneyQuote ? mooneyQuote?.toLocaleString() : '...loading'
                }`}
              </li>
            </ul>
          </div>
        </div>
        <button
          className={`mt-10 bg-moon-orange group-hover:scale-105 px-5 py-3 transition-all duration-150 ${
            selectedLevel === levelPrice && ''
          }`}
        >
          {'Get Started >'}
        </button>
      </div>
    )
  }
  ;('Everything in the Citizen Tier.Exclusive promotion opportunities. Access to talent to help design, build, test your space hardware. 1,000,000 Voting Power 1,000,000 MOONEY')
  return (
    <div className="mt-8 2xl:w-full 2xl:gap-[7.5%] lg:mt-12 grid grid-cols-1 xl:grid-cols-2 2xl:grid-cols-3 gap-[18px] lg:gap-7">
      <ContributionLevel
        icon="/explorer.png"
        title="Explorer"
        levelPrice={0.001}
        demoPriceProp={10}
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
        levelPrice={0.01}
        demoPriceProp={50}
        intro="Take an active seat in the construction of the largest network-state focused on becoming multi-planetary."
        points={[
          'Proposal Submission Power.',
          'Co-governance of the MoonDAO Treasury.',
          'Exclusive industry-focused networking opportunities.',
        ]}
        hasVotingPower
      />
      <ContributionLevel
        icon="/industry.png"
        title="Industry"
        levelPrice={0.1}
        demoPriceProp={200}
        intro="If you’re a company that would like to join the coalition of organizations supporting MoonDAO, or a Whale that loves what we’re doing, this is for you."
        points={[
          'Everything in the Citizen Tier.',
          'Exclusive promotion opportunities.',
          'Access to talent to help design, build, test your space hardware.',
        ]}
        hasVotingPower
      />
    </div>
  )
}
