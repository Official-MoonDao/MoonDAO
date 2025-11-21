import Card from '@/components/layout/Card'

type AchievementCardProps = {
  value: string | number
  label: string
  description: string
  icon: string
  gradientFrom: string
  gradientTo: string
}

export default function AchievementCard({
  value,
  label,
  description,
  icon,
  gradientFrom,
  gradientTo,
}: AchievementCardProps) {
  return (
    <Card
      variant="launchpad"
      layout="launchpad"
      icon={icon}
      header={`${value}\n${label}`}
      paragraph={description}
      stats={{ value, subtitle: label }}
      gradientFrom={gradientFrom}
      gradientTo={gradientTo}
    />
  )
}

