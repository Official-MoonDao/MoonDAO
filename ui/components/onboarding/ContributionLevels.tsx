import Image from 'next/image'
import { useState } from 'react'

type ContributionLevelProps = {
  icon: string
  title: string
  levelPrice: number
  points: string[]
}

export function ContributionLevels({ selectedLevel, setSelectedLevel }: any) {
  function ContributionLevel({
    icon,
    title,
    levelPrice,
    points,
  }: ContributionLevelProps) {
    return (
      <div
        className={`w-[225px] text-black dark:text-white py-8 flex flex-col justify-center items-center gap-8 bg-background-light dark:bg-background-dark ${
          selectedLevel === levelPrice &&
          'dark:bg-moon-gold dark:text-black text-black bg-moon-gold'
        }`}
        onClick={() => setSelectedLevel(levelPrice)}
      >
        <Image src={icon} width={100} height={100} alt="" />
        <h1>{title}</h1>
        <p>{`Price : ${levelPrice.toLocaleString()}`}</p>
        <div className={`flex flex-col w-3/4 text-[80%]`}>
          {points.map((point, i) => (
            <p key={`contribution-level-${title}-desc-point-${i}`}>
              {'-- ' + point}
            </p>
          ))}
          <button>{'Get Started >'}</button>
        </div>
      </div>
    )
  }

  return (
    <div className="flex flex-col md:flex-row w-full divide-x-2">
      <ContributionLevel
        icon=""
        title="Initiate"
        levelPrice={0.001}
        points={[
          'Access to the community',
          'Be part of the DAO Governance',
          'You get to purchase things on the marketplace',
          '50,000.00 $MOONEY',
          '1000 voting power',
        ]}
      />
      <ContributionLevel
        icon=""
        title="Delegate"
        levelPrice={0.01}
        points={[
          'Access to the community',
          'Be part of the DAO Governance',
          'You get to purchase things on the marketplace',
          '50,000.00 $MOONEY',
          '1000 voting power',
        ]}
      />
      <ContributionLevel
        icon=""
        title="Advocate"
        levelPrice={0.1}
        points={[
          'Access to the community',
          'Be part of the DAO Governance',
          'You get to purchase things on the marketplace',
          '50,000.00 $MOONEY',
          '1000 voting power',
        ]}
      />
    </div>
  )
}
