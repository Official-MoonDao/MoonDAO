import { ArrowRightIcon } from '@heroicons/react/24/outline'
import Link from 'next/link'
import React from 'react'

export interface ActionButton {
  label: string
  href: string
  gradientFrom: string
  gradientTo: string
  hoverFrom?: string
  hoverTo?: string
  isExternal?: boolean
}

export interface CallToActionSectionProps {
  title?: string
  description?: string
  buttons?: ActionButton[]
}

const DEFAULT_BUTTONS: ActionButton[] = [
  {
    label: 'Get MOONEY',
    href: '#buy',
    gradientFrom: 'from-blue-500',
    gradientTo: 'to-purple-600',
    hoverFrom: 'hover:from-blue-600',
    hoverTo: 'hover:to-purple-700',
  },
  {
    label: 'Lock Tokens',
    href: '/lock',
    gradientFrom: 'from-purple-500',
    gradientTo: 'to-pink-600',
    hoverFrom: 'hover:from-purple-600',
    hoverTo: 'hover:to-pink-700',
  },
  {
    label: 'View Proposals',
    href: '/vote',
    gradientFrom: 'from-green-500',
    gradientTo: 'to-teal-600',
    hoverFrom: 'hover:from-green-600',
    hoverTo: 'hover:to-teal-700',
  },
]

export default function CallToActionSection({
  title = 'Ready to Join the Mission?',
  description = "Get MOONEY, lock for voting power, and help shape humanity's space future.",
  buttons = DEFAULT_BUTTONS,
}: CallToActionSectionProps) {
  return (
    <section className="py-16 px-6 bg-gradient-to-br from-purple-900/30 to-blue-900/30 w-full">
      <div className="max-w-4xl mx-auto text-center space-y-6">
        <h2 className="text-3xl md:text-4xl font-bold text-white font-GoodTimes">{title}</h2>
        <p className="text-lg text-gray-300 max-w-3xl mx-auto">{description}</p>
        <div className="flex flex-col sm:flex-row gap-4 justify-center">
          {buttons.map((button, index) => {
            if (button.isExternal || button.href.startsWith('#')) {
              return (
                <a
                  key={index}
                  href={button.href}
                  className={`bg-gradient-to-r ${button.gradientFrom} ${button.gradientTo} ${
                    button.hoverFrom || ''
                  } ${
                    button.hoverTo || ''
                  } text-white py-3 px-8 rounded-xl text-lg font-semibold transition-all duration-200 transform hover:scale-[1.02] shadow-lg flex items-center gap-2 justify-center`}
                >
                  {button.label} <ArrowRightIcon className="w-5 h-5" />
                </a>
              )
            }

            return (
              <Link
                key={index}
                href={button.href}
                className={`bg-gradient-to-r ${button.gradientFrom} ${button.gradientTo} ${
                  button.hoverFrom || ''
                } ${
                  button.hoverTo || ''
                } text-white py-3 px-8 rounded-xl text-lg font-semibold transition-all duration-200 transform hover:scale-[1.02] shadow-lg flex items-center gap-2 justify-center`}
              >
                {button.label} <ArrowRightIcon className="w-5 h-5" />
              </Link>
            )
          })}
        </div>
      </div>
    </section>
  )
}
