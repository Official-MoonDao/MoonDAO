import Link from 'next/link'
import { Line } from 'rc-progress'
import ProgressLine from '../layout/ProgressLine'
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
}: MissionWideCardProps) {
  return (
    <StandardWideCard
      title={name}
      subheader={tagline}
      stats={
        <div>
          <div className="w-full grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4 justify-between">
            <MissionStat
              icon="/assets/clock.png"
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
                icon="/assets/token.png"
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
                  icon="/assets/token.png"
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
              <ProgressLine
                label={`${20} ETH`}
                progress={(20 / fundingGoal) * 100}
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
