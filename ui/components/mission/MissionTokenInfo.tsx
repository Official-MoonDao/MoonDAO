import { InformationCircleIcon } from '@heroicons/react/24/outline'
import Image from 'next/image'
import Link from 'next/link'
import { missionTokenWeights } from '@/lib/mission/missionConfig'
import MissionFundingMilestoneChart from './MissionFundingMilestoneChart'

function FundingStage({
  stage,
  title,
  description,
}: {
  stage: number
  title: string
  description: string
}) {
  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center gap-2">
        <h2 className="font-GoodTimes text-xl lg:text-2xl text-moon-indigo">
          {`Stage ${stage} : `}
          <span className="text-white">{title}</span>
        </h2>
      </div>
      <p>{description}</p>
    </div>
  )
}

export default function MissionTokenInfo({
  mission,
  token,
  ruleset,
  subgraphData,
  fundingGoal,
}: {
  mission: any
  userMissionTokenBalance: string
  token: any
  ruleset: any
  subgraphData: any
  fundingGoal: number
}) {
  //TODO : Add real stage weights and durations
  const stage1Weight = ruleset?.[0].weight.toString() / 1e18
  const stage2Weight = stage1Weight / 2
  const stage3Weight = stage1Weight / 4

  const stage1Duration = ruleset?.[0].duration
  const stage2Duration = stage1Duration * 2
  const stage3Duration = stage1Duration * 4

  return (
    <div className="flex flex-col gap-4">
      {/* Funding Dynamics / Stages */}
      <h1 className="mt-4 text-2xl font-bold">Funding Dynamics</h1>
      <p>The token funding for this project works in stages.</p>
      <MissionFundingMilestoneChart
        fundingGoal={fundingGoal}
        subgraphData={subgraphData}
      />
      {/* <Image/> */}
      <FundingStage
        stage={1}
        title="Ignition"
        description={`During the ignition stage, you get ${missionTokenWeights[0].toLocaleString()} ${
          token?.tokenSymbol
        } per ETH contributed. You can redeem your full amount if the project doesn't raise the required minimum funds within the timeframe.`}
      />
      <FundingStage
        stage={2}
        title={'Ascent'}
        description={`If the mission reaches its minimum funding threshold, the project has launched and is ascending toward its goal. At this point you'll receive ${missionTokenWeights[1].toLocaleString()} ${
          token?.tokenSymbol
        } per ETH contributed up to the total goal amount, or until ${new Date(
          Date.now() + stage2Duration
        ).toLocaleDateString()}.`}
      />
      <FundingStage
        stage={3}
        title={'Orbit'}
        description={`Once the goal amount is reached, you can still continue to contribute until the deadline is reached, but at the rate of ${missionTokenWeights[2].toLocaleString()} ${
          token?.tokenSymbol
        } per ETH contributed.`}
      />
      <div className="flex items-center gap-2">
        <InformationCircleIcon className="w-16 h-16" />
        <p className="text-sm">{`Note: If no deadline is set, then the project owner can manually trigger the shut down of the project, going into effect 24 hours after the trigger is completed.`}</p>
      </div>

      {/* Tokenomics */}
      <h1 className="mt-4 text-2xl font-bold">Tokenomics</h1>
      <p>
        {`50% of the total tokens will go to the contributor when funding the project. The other 50% are locked for at least one year and allocated as follows:`}
      </p>
      <Image
        src="/assets/launchpad/mission-tokenomics-distribution.svg"
        alt="Tokenomics"
        width={350}
        height={350}
      />
      <p>{`If funding is completed successfully, the locked tokens are treated as follows: `}</p>
      {[
        '10% of the token is locked indefinitely on an AMM.',
        "10% of the token is locked for one year and vested for three years, to be held by MoonDAO's Treasury.",
        '30% of the token is locked for one year, and vested for three years, to be held by the Project Team to distribute how they see fit.',
      ].map((item: string, index: number) => (
        <p key={index} className="ml-1">{`● ${item}`}</p>
      ))}
      <p>{`If the project does not graduate (their minimum goal was not met), then redemptions are turned on and people can get their full contribution back.`}</p>

      {/* Locked Token Vesting Schedule */}
      <h1 className="mt-4 text-2xl font-bold">Locked Token Vesting Schedule</h1>
      <Image
        src="/assets/launchpad/mission-locked-token-vesting.svg"
        alt="Token Vesting Schedule"
        width={500}
        height={500}
      />

      {/* Auditing Resources */}
      <h1 className="mt-4 text-2xl font-bold">Auditing Resources</h1>

      <div className="flex items-center gap-2">
        <Image
          src="/assets/launchpad/star-icon-indigo.svg"
          alt="Star Icon"
          width={20}
          height={20}
        />
        <Link
          className="underline text-blue-500"
          href={`https://${
            process.env.NEXT_PUBLIC_CHAIN === 'mainnet'
              ? 'etherscan.io'
              : 'sepolia.etherscan.io'
          }/address/${token.tokenAddress}`}
          target="_blank"
          rel="noopener noreferrer"
        >
          {'Etherscan'}
        </Link>
      </div>
      <div className="flex items-center gap-2">
        <Image
          src="/assets/launchpad/star-icon-indigo.svg"
          alt="Star Icon"
          width={20}
          height={20}
        />
        <Link
          className="underline text-blue-500"
          href={`https://${
            process.env.NEXT_PUBLIC_CHAIN === 'mainnet'
              ? 'juicebox.money'
              : 'sepolia.juicebox.money'
          }/v4/p/${mission?.projectId}`}
          target="_blank"
          rel="noopener noreferrer"
        >
          {'Juicebox'}
        </Link>
      </div>
    </div>
  )
}
