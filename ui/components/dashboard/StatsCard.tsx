import Card from '@/components/layout/Card'
import React from 'react'

type StatsCardProps = {
  title: string
  value: string | number
  subtitle?: string
  icon?: React.ReactNode
  trend?: {
    value: string
    isPositive: boolean
  }
  className?: string
  children?: React.ReactNode
}

export default function StatsCard({
  title,
  value,
  subtitle,
  icon,
  trend,
  className = '',
}: StatsCardProps) {
  return (
    <Card
      variant="stats"
      layout="stats"
      header={title}
      icon={icon}
      stats={{
        value,
        subtitle,
        trend,
      }}
      className={className}
    />
  )
}
