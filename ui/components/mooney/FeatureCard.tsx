import React from 'react'
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
    <div
      className={`bg-gradient-to-br from-gray-900 via-blue-900/30 to-purple-900/20 rounded-xl p-6 border border-white/10 ${className}`}
    >
      <div className="mb-4">{icon}</div>
      <h3 className="text-lg font-bold text-white mb-2 font-GoodTimes">
        {title}
      </h3>
      <p className="text-gray-300 text-sm mb-3">{description}</p>
      {badges && badges.length > 0 && (
        <div className="flex gap-1 flex-wrap">
          {badges.map((badge, index) => (
            <span
              key={index}
              className="text-xs bg-green-500/20 text-green-300 px-2 py-1 rounded"
            >
              {badge}
            </span>
          ))}
        </div>
      )}
    </div>
  )
}

