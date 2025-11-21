import Card from '@/components/layout/Card'

type FeatureCardProps = {
  title: string
  description: string
  icon: string
  gradientFrom: string
  gradientTo: string
}

export default function FeatureCard({
  title,
  description,
  icon,
  gradientFrom,
  gradientTo,
}: FeatureCardProps) {
  return (
    <Card
      variant="gradient"
      layout="launchpad"
      icon={icon}
      header={title}
      paragraph={description}
      gradientFrom={gradientFrom}
      gradientTo={gradientTo}
      className="h-64 md:h-72 lg:h-80 w-full"
    />
  )
}

