import Image from 'next/image'
import { useEffect, useState } from 'react'
import { useSwapRouter } from '../../lib/uniswap/hooks/useSwapRouter'

type ContributionLevelProps = {
  icon: string
  title: string
  levelPrice: number
  demoPriceProp: number
  intro: string
  points: string[]
}

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
  }: ContributionLevelProps) {
    const [quote, setQuote] = useState<number>()
    const { generateRoute } = useSwapRouter(levelPrice)

    useEffect(() => {
      ;(async () => {
        const route = await generateRoute()
        setQuote(route?.route[0].rawQuote.toString() / 10 ** 18)
      })()
    }, [])
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
          {`$${demoPriceProp.toLocaleString()}/month`}
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
              <li>
                {!quote ? '...loading' : quote?.toLocaleString() + ' $MOONEY'}
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
          '250,000 Voting Power.',
        ]}
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
          '1,000,000 Voting Power',
        ]}
      />
    </div>
  )
}
