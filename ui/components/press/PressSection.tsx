import React, { ReactNode } from 'react'

type PressSectionProps = {
  id: string
  title: string
  description?: string
  action?: ReactNode
  children: ReactNode
}

export default function PressSection({
  id,
  title,
  description,
  action,
  children,
}: PressSectionProps) {
  return (
    <section id={id} className="scroll-mt-24">
      <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h2 className="font-GoodTimes text-2xl text-white">{title}</h2>
          {description && (
            <p className="mt-2 max-w-3xl text-sm leading-relaxed text-slate-300">{description}</p>
          )}
        </div>
        {action}
      </div>
      {children}
    </section>
  )
}
