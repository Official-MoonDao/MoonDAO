import { ReactNode } from 'react'

interface PageHeaderProps {
  title?: ReactNode
  subHeader?: ReactNode
  description?: ReactNode
  toolbar?: ReactNode
  actions?: ReactNode
  back?: ReactNode
  align?: 'left' | 'center'
  className?: string
}

/**
 * Compact page title. One line of title, an optional short description,
 * and an optional toolbar (search, filters, tabs) so the thing the page
 * is for starts near the top of the viewport.
 */
export default function PageHeader({
  title,
  subHeader,
  description,
  toolbar,
  actions,
  back,
  align = 'left',
  className = '',
}: PageHeaderProps) {
  const centered = align === 'center'
  const hasTitle = title != null && title !== ''

  return (
    <div id="title-wrapper" className={`w-full min-w-0 pt-6 pb-4 md:pt-8 md:pb-5 ${className}`}>
      {back ? <div className="mb-2">{back}</div> : null}
      <div
        className={`flex gap-3 ${
          centered
            ? 'flex-col items-center text-center'
            : 'flex-col items-start sm:flex-row sm:items-start sm:justify-between'
        }`}
      >
        <div id="title-container" className="min-w-0 w-full">
          {hasTitle ? (
            <h1
              id="header-element"
              className="font-heading font-semibold text-2xl leading-tight text-white break-words [overflow-wrap:anywhere] md:text-3xl"
            >
              {title}
            </h1>
          ) : null}
          {subHeader ? (
            <div id="sub-header" className="sub-header mt-1 text-white/70">
              {subHeader}
            </div>
          ) : null}
          {description ? (
            typeof description === 'string' ? (
              <p
                className={`mt-2 max-w-3xl text-sm leading-relaxed text-white/60 line-clamp-2 md:text-base ${
                  centered ? 'mx-auto' : ''
                }`}
              >
                {description}
              </p>
            ) : (
              <div className="mt-3 w-full min-w-0">{description}</div>
            )
          ) : null}
        </div>
        {actions ? <div className="shrink-0">{actions}</div> : null}
      </div>
      {toolbar ? <div className="mt-4 w-full min-w-0">{toolbar}</div> : null}
    </div>
  )
}
