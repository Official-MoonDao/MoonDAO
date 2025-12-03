import Card from '@/components/layout/Card'
import { ReactNode } from 'react'

export interface FeatureCardProps {
  icon: ReactNode
  title: string
  description: string
  badges?: string[]
  className?: string
}

export default function FeatureCard({
  icon,
  title,
  description,
  badges,
  className = '',
}: FeatureCardProps) {
  return (
    <Card
      variant="gradient"
      layout="feature"
      icon={icon}
      header={title}
      paragraph={description}
      badges={badges}
      className={className}
    />
  )
}
