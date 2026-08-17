import { CheckIcon } from '@heroicons/react/24/outline'
import { ReactNode } from 'react'

type JobSectionProps = {
  id?: string
  header: string
  children: ReactNode
}

export default function JobSection({ id, header, children }: JobSectionProps) {
  return (
    <section id={id} className="mt-10">
      <h2 className="font-GoodTimes text-white text-lg md:text-xl mb-4">{header}</h2>
      {children}
    </section>
  )
}

export function JobBulletList({
  items,
  checkmarks = false,
}: {
  items: string[]
  checkmarks?: boolean
}) {
  return (
    <ul className={`flex flex-col gap-3 ${checkmarks ? '' : 'list-disc pl-5'}`}>
      {items.map((item, i) => (
        <li
          key={`${i}-${item.slice(0, 24)}`}
          className={`text-white/90 text-base leading-relaxed ${
            checkmarks ? 'flex items-start gap-3 list-none' : ''
          }`}
        >
          {checkmarks && <CheckIcon className="h-5 w-5 text-green-400 flex-shrink-0 mt-0.5" />}
          <span>{item}</span>
        </li>
      ))}
    </ul>
  )
}

export function JobStepList({ steps }: { steps: { label: string; detail?: string }[] }) {
  return (
    <ol className="flex flex-col gap-4">
      {steps.map((step, i) => (
        <li key={`${i}-${step.label}`} className="flex gap-4">
          <span className="flex-shrink-0 h-7 w-7 rounded-full bg-blue-500/20 border border-blue-500/30 text-blue-300 text-sm flex items-center justify-center">
            {i + 1}
          </span>
          <div className="min-w-0">
            <p className="text-white font-semibold">{step.label}</p>
            {step.detail && (
              <p className="text-white/80 text-sm mt-1 leading-relaxed">{step.detail}</p>
            )}
          </div>
        </li>
      ))}
    </ol>
  )
}
