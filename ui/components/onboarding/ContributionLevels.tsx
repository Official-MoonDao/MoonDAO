import InitiateLogo from './assets/InitiateLogo'

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
        className={`w-[320px] transition-all duration-150 text-black cursor-pointer dark:text-white py-6 px-7 flex flex-col items-center border-[2px] border-white group hover:border-orange-200 border-opacity-20 font-RobotoMono ${selectedLevel === levelPrice
          ? 'border-orange-600 border-opacity-100 hover:border-orange-600'
          : ''
          }`}
        onClick={() => setSelectedLevel(levelPrice)}
      >
        {/*Logo*/}
        <div className="mt-10">
          <InitiateLogo />
        </div>
        {/*Title*/}
        <h1 className={`font-GoodTimes mt-[22px] text-2xl transition-all duration-150 ${selectedLevel === levelPrice && "text-moon-orange"}`}>{title}</h1>
        <p className="mt-[23px]">{`Price : ${levelPrice.toLocaleString()}`}</p>
        {/*List*/}
        <ul
          className={`mt-[38px] flex flex-col gap-6 list-disc w-full pl-4 pr-`}
        >
          {points.map((point, i) => (
            <li
              key={`contribution-level-${title}-desc-point-${i}`}
              className="text-sm"
            >
              {'' + point}
            </li>
          ))}
        </ul>
        <button className={`mt-[52px] lg:bg-transparent px-5 py-3 transition-all duration-150 ${selectedLevel === levelPrice && 'lg:bg-moon-orange hover:scale-105'}`}>
          {'Get Started >'}
        </button>
      </div>
    )
  }

  return (
    <div className="mt-8 lg:mt-12 flex flex-col items-center lg:flex-row gap-[18px] lg:gap-7">
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
