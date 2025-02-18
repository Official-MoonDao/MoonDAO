import StandardWideCard from '../layout/StandardWideCard'
import MissionStat from './MissionStat'

export type MissionWideCardProps = {
  name?: string
  tagline?: string
  deadline?: string
  fundingGoal?: number
  tradeable?: boolean
  description?: string
  logoUri?: string
  missionImage?: File
}

export default function MissionWideCard({
  name,
  tagline,
  deadline,
  fundingGoal,
  tradeable,
  description,
  logoUri,
  missionImage,
}: MissionWideCardProps) {
  return (
    <StandardWideCard
      title={name}
      subheader={tagline}
      stats={
        <div className="w-full flex flex-col lg:flex-row gap-4 justify-between">
          <MissionStat
            icon="/assets/clock.png"
            label="Deadline:"
            value={deadline}
          />
          <MissionStat
            icon="/assets/target.png"
            label="Goal:"
            value={fundingGoal || 0}
          />
          <MissionStat
            icon="/assets/token.png"
            label="Mission Token:"
            value={tradeable ? 'Yes' : 'No'}
          />
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
