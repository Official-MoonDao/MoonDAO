import React from 'react'
import { ScaleIcon } from '@heroicons/react/24/outline'

export interface QuadraticVotingCardProps {
  formula?: string
  examples?: Array<{ input: string; output: string }>
  description?: string
}

const DEFAULT_FORMULA = 'Voting Power = √(vMOONEY)'
const DEFAULT_EXAMPLES = [
  { input: '10,000 vMOONEY', output: '√10,000 = 100 voting power' },
  {
    input: '1,000,000 vMOONEY',
    output: '√1,000,000 = 1,000 voting power',
  },
]
const DEFAULT_DESCRIPTION =
  'Prevents whale dominance by limiting large holder influence. Ensures democratic participation in DAO governance.'

export default function QuadraticVotingCard({
  formula = DEFAULT_FORMULA,
  examples = DEFAULT_EXAMPLES,
  description = DEFAULT_DESCRIPTION,
}: QuadraticVotingCardProps) {
  return (
    <div className="bg-gradient-to-br from-gray-900/50 to-purple-900/20 rounded-xl p-6 border border-white/10">
      <h3 className="text-xl font-bold text-white mb-6 flex items-center gap-2">
        <ScaleIcon className="h-5 w-5 text-purple-400" />
        Quadratic Voting Formula
      </h3>
      <div className="space-y-4">
        <div className="bg-black/20 rounded-lg p-4">
          <h4 className="text-purple-300 font-semibold mb-2">
            Voting Power Calculation
          </h4>
          <div className="bg-purple-500/10 rounded p-3 border border-purple-400/20">
            <code className="text-purple-300 text-lg font-mono">
              {formula}
            </code>
          </div>
        </div>
        <div className="bg-black/20 rounded-lg p-4">
          <h4 className="text-blue-300 font-semibold mb-2">Example</h4>
          <div className="text-gray-300 text-sm space-y-1">
            {examples.map((example, index) => (
              <p key={index}>
                {example.input} = {example.output}
              </p>
            ))}
          </div>
        </div>
        <div className="bg-black/20 rounded-lg p-4">
          <h4 className="text-green-300 font-semibold mb-2">
            Fair Governance
          </h4>
          <div className="text-gray-300 text-sm">
            <p>{description}</p>
          </div>
        </div>
      </div>
    </div>
  )
}

