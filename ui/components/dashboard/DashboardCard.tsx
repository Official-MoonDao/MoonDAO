import Card from '@/components/layout/Card'
import React from 'react'

type DashboardCardProps = {
  title: string
  icon?: React.ReactNode
  children: React.ReactNode
  actions?: React.ReactNode
  className?: string
}

export default function DashboardCard({
  title,
  icon,
  children,
  actions,
  className = '',
}: DashboardCardProps) {
  return (
    <Card
      variant="slateBorder"
      title={title}
      icon={icon}
      actions={actions}
      className={className}
    >
      {children}
    </Card>
  )
}
