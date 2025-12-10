import React, { ReactNode } from 'react'
import FeatureCard from './FeatureCard'

export interface Feature {
  icon: ReactNode
  title: string
  description: string
  badges?: string[]
}

export interface GovernanceStep {
  number: number
  label: string
  color: string
}

export interface KeyFeaturesSectionProps {
  title?: string
  features: Feature[]
  governanceSteps: GovernanceStep[]
  formula: string
  formulaDescription: string
}

export default function KeyFeaturesSection({
  title = 'Key Features',
  features,
  governanceSteps,
  formula,
  formulaDescription,
}: KeyFeaturesSectionProps) {
  return (
    <section className="py-20 px-6 bg-gradient-to-br from-gray-900/50 to-blue-900/20 w-full">
      <div className="max-w-6xl mx-auto">
        <h2 className="text-3xl md:text-4xl font-bold font-GoodTimes text-center text-white mb-8">
          {title}
        </h2>
        <div className="grid md:grid-cols-3 gap-6 mb-8">
          {features.map((feature, index) => (
            <FeatureCard
              key={index}
              icon={feature.icon}
              title={feature.title}
              description={feature.description}
              badges={feature.badges}
            />
          ))}
        </div>

        <div className="bg-gradient-to-r from-black/40 via-blue-900/20 to-purple-900/20 rounded-2xl p-6 border border-white/10">
          <div className="grid md:grid-cols-4 gap-4 text-center">
            {governanceSteps.map((step) => (
              <div key={step.number} className="space-y-2">
                <div
                  className="w-10 h-10 rounded-full flex items-center justify-center mx-auto text-white font-bold"
                  style={{ backgroundColor: step.color }}
                >
                  {step.number}
                </div>
                <span
                  className="text-sm font-semibold"
                  style={{ color: step.color.replace('500', '300') }}
                >
                  {step.label}
                </span>
              </div>
            ))}
          </div>
          <div className="text-center mt-6">
            <code className="text-blue-300 font-mono text-lg">{formula}</code>
            <p className="text-gray-400 text-sm mt-1">{formulaDescription}</p>
          </div>
        </div>
      </div>
    </section>
  )
}

