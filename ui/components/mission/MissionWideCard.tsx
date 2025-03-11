import { PencilIcon } from '@heroicons/react/24/outline'
import Link from 'next/link'
import { Line } from 'rc-progress'
import ProgressBar from '../layout/ProgressBar'
import StandardButton from '../layout/StandardButton'
import StandardWideCard from '../layout/StandardWideCard'
import MissionStat from './MissionStat'

export type MissionWideCardProps = {
  name?: string
  tagline?: string
  deadline?: string
  fundingGoal?: number
  tradeable?: boolean
  tokenAddress?: string
  tokenSymbol?: string
  volume?: number
  paymentsCount?: number
  description?: string
  logoUri?: string
  missionImage?: File
  contribute?: boolean
  projectId?: number
  editable?: boolean
}

export default function MissionWideCard({
  name,
  tagline,
  deadline,
  fundingGoal,
  tradeable,
  tokenAddress,
  tokenSymbol,
  volume,
  paymentsCount,
  description,
  logoUri,
  missionImage,
  contribute,
  projectId,
  editable,
}: MissionWideCardProps) {
  return (
    <StandardWideCard
      title={
        <div className="flex items-start justify-between gap-4">
          {name}
          {editable && (
            <button
              onClick={() => {
                //open modal, complete form, missionCreator.updateMissionMetadata()
              }}
            >
              <PencilIcon width={35} height={35} />
            </button>
          )}
        </div>
      }
      subheader={tagline}
      stats={
        <div>
          <div className="w-full grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4 justify-between">
            <MissionStat
              icon="/assets/launchpad/clock.svg"
              label="Deadline"
              value={deadline}
            />
            <MissionStat
              icon="/assets/target.png"
              label="Goal"
              value={`${fundingGoal || 0} ETH`}
            />
            {tradeable !== undefined && (
              <MissionStat
                icon="/assets/launchpad/token.svg"
                label="Mission Token"
                value={tradeable ? 'Yes' : 'No'}
              />
            )}
            {tokenAddress && (
              <Link
                href={`https://${
                  process.env.NEXT_PUBLIC_CHAIN === 'mainnet'
                    ? 'arbiscan.io'
                    : 'sepolia.etherscan.io'
                }/token/${tokenAddress}`}
                target="_blank"
                rel="noopener noreferrer"
              >
                <MissionStat
                  icon="/assets/launchpad/token.svg"
                  label="Token"
                  value={tokenSymbol}
                />
              </Link>
            )}
            {volume !== undefined && (
              <MissionStat label="VOLUME" value={'Ξ' + volume} />
            )}
            {paymentsCount !== undefined && (
              <MissionStat label="PAYMENTS" value={paymentsCount} />
            )}
            {contribute && projectId && (
              <StandardButton
                link={`https://sepolia.juicebox.money/v4/p/${projectId}`}
                target="_blank"
                className="gradient-2 rounded-full"
                hoverEffect={false}
              >
                Contribute
              </StandardButton>
            )}
          </div>
          <div className="mt-4 max-w-full">
            {volume && fundingGoal && (
              <ProgressBar
                label={`${5} ETH`}
                progress={(5 / fundingGoal) * 100}
                height="25px"
              />
            )}
          </div>
        </div>
      }
      paragraph={
        <div
          className="prose prose-invert max-w-none"
          dangerouslySetInnerHTML={{
            __html: description || '',
          }}
        />
      }
      image={missionImage ? URL.createObjectURL(missionImage) : logoUri}
    />
  )
}
