import { usePrivy } from '@privy-io/react-auth'
import Image from 'next/image'
import { useEffect, useState } from 'react'
import toast from 'react-hot-toast'
import { calculateVMOONEY } from '../../lib/tokens/ve-token'

type ContributionLevelProps = {
  icon: string
  title: string
  mooneyValue: number
  intro: string
  points: string[]
  hasVotingPower?: boolean
}

export function ContributionLevels({ selectedLevel, setSelectedLevel }: any) {
  {
    /*Card component */
  }
  function ContributionLevel({
    icon,
    title,
    mooneyValue,
    intro,
    points,
    hasVotingPower,
  }: ContributionLevelProps) {
    const { user } = usePrivy()

    const [levelVotingPower, setLevelVotingPower] = useState<any>()

    useEffect(() => {
      if (hasVotingPower) {
        setLevelVotingPower(
          Math.sqrt(
            +calculateVMOONEY({
              MOONEYAmount: mooneyValue / 2,
              VMOONEYAmount: 0,
              time: Date.now() * 1000 * 60 * 60 * 24 * 365 * 2,
              lockTime: new Date(),
              max: Date.now() * 1000 * 60 * 60 * 24 * 365 * 4,
            })
          )
        )
      }
    }, [])

    return (
      <div
        className={`w-[320px] group transition-all duration-150 text-black cursor-pointer dark:text-white pb-4 px-7 flex flex-col items-center border-[1px] border-white group hover:border-orange-500 font-RobotoMono ${selectedLevel?.price === mooneyValue
          ? 'border-moon-orange border-opacity-100'
          : 'border-opacity-60 dark:border-opacity-20'
          }`}
        onClick={() => {
          if (!user) toast.error('Please connect a wallet to continue')
          else setSelectedLevel({ price: mooneyValue, hasVotingPower })
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
          className={`font-abel mt-[22px] text-3xl transition-all duration-150 ${selectedLevel.price === mooneyValue && 'text-moon-orange'
            }`}
        >
          {title}
        </h1>
        {/*Price, just switch "demoPriceProp" for "levelPrice" to return to normal */}
        <p className="mt-5 lg:mt-[23px] text-center">
          {`${hasVotingPower
            ? (mooneyValue / 2).toLocaleString()
            : mooneyValue.toLocaleString()
            } $MOONEY`}
        </p>
        {hasVotingPower && (
          <p className="mt-5 lg:mt-[23px] text-center">
            {`${Math.floor(levelVotingPower).toLocaleString()} Voting Power`}
          </p>
        )}
        <button
          className={`mt-3 border ${selectedLevel.price === mooneyValue ? 'border-moon-orange' : 'border-white-500'} group-hover:scale-105 px-5 py-3 transition-all duration-150 ${selectedLevel.price === mooneyValue ? 'bg-moon-orange' : 'bg-transparent'}`
          }
          style={{ width: '261px', height: '44px', padding: '12px, 20px, 12px, 20px', textAlign: 'center' }}
        >
          {'Get Started >'}
        </button>

        <div className="mt-4 text-left text-sm" style={{ marginBottom: '20px' }}>
          {/*Intro*/}
          <p className="2xl:h-[120px] leading-[18.46px] font-normal">{intro}</p>
          {/*Perk List*/}
          <div className="mt-[8px] pr-2 2xl:h-[210px]">
            <ul className={`mt-1  flex flex-col list-disc w-full gap-1`}>

              {points.map((point, i) => (
                <div
                  key={`contribution-level-${title}-desc-point-${i}`}
                  className="text-sm"
                >
                  {'' + point}
                </div>
              ))}
            </ul>
          </div>
        </div>
      </div>
    )
  }
  // ;('Everything in the Citizen Tier.Exclusive promotion opportunities. Access to talent to help design, build, test your space hardware. 1,000,000 Voting Power 1,000,000 MOONEY')
  return (
    <div className="flex flex-col md:flex-row justify-evenly mt-8 2xl:w-full 2xl:gap-[7.5%] lg:mt-12 gap-[18px] lg:gap-7">
      <ContributionLevel
        icon="/explorer.png"
        title="Explorer"
        intro="Perfect for those that want to dip their feet into the MoonDAO community."
        mooneyValue={50000}
        points={[
          '✓ Can purchase two Ticket to Space Sweepstakes Entries',
          '✓ Community Discord Access',
          '✓ MoonDAO Marketplace Access',
        ]}
        hasVotingPower
      />
      <ContributionLevel
        icon="/citizen.png"
        title="Citizen"
        intro="Take an active seat in the construction of the largest network-state focused on becoming multi-planetary."
        mooneyValue={500000}
        points={[
          '✓ Can purhcase up to 12 Ticket To Space Entries',
          '✓ Exclusive Discord Access',
          '✓ MoonDAO Marketplace Access',
          '✓ Co-governance of the MoonDAO Treasury',
          '✓ Submit Proposals for Projects',
          '✓ Free-Events Access',
        ]}
        hasVotingPower
      />
      <ContributionLevel
        icon="/industry.png"
        title="Industry"
        intro="If you’re a company that would like to join the coalition of organizations supporting MoonDAO, or a Whale that loves what we’re doing, this is for you."
        mooneyValue={2000000}
        points={[
          '✓ Everything in the Citizen Tier',
          '✓ Exclusive promotion opportunities',
          '✓ Access to talent to help design, build, test your space hardware',
        ]}
        hasVotingPower
      />
    </div>
  )
}
