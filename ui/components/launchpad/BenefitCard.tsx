import Card from '@/components/layout/Card'

type BenefitCardProps = {
  title: string
  description: string
  icon: string
  gradientFrom: string
  gradientTo: string
}

export default function BenefitCard({
  title,
  description,
  icon,
  gradientFrom,
  gradientTo,
}: BenefitCardProps) {
  return (
    <Card
      variant="launchpad"
      layout="launchpad"
      icon={icon}
      header={title}
      paragraph={description}
      gradientFrom={gradientFrom}
      gradientTo={gradientTo}
      className="h-full"
    />
  )
}

