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
    <div
      className={`bg-gradient-to-b from-slate-700/20 to-slate-800/30 rounded-2xl border border-slate-600/30 p-6 ${className}`}
    >
      <div className="flex flex-col lg:flex-row items-start lg:items-center justify-between gap-4 mb-6">
        <div className="flex items-center gap-4">
          {icon && <div className="opacity-70">{icon}</div>}
          <h2 className="font-GoodTimes text-2xl text-white">{title}</h2>
        </div>
        {actions && <div className="flex gap-3">{actions}</div>}
      </div>
      {children}
    </div>
  )
}
