import { ReactNode } from 'react'
import { classNames } from '@/lib/utils/tailwind'

export interface SummaryData {
  primaryStats: { label: string; value: string; color?: string }[]
  visualIndicator?: ReactNode
  secondaryStats: { label: string; value: string }[]
}

export interface VotesProps {
  summarySection?: ReactNode
  voteItems: ReactNode[]
  footerSection?: ReactNode
  emptyStateMessage?: string
  isLoading?: boolean
  title?: string
  subtitle?: ReactNode
  onTitleClick?: () => void
  containerClassName?: string
  showContainer?: boolean
}

export default function Votes({
  summarySection,
  voteItems,
  footerSection,
  emptyStateMessage = 'No votes found.',
  isLoading = false,
  title,
  subtitle,
  onTitleClick,
  containerClassName = '',
  showContainer = false,
}: VotesProps) {
  const votesContent = (
    <div className="flex flex-col h-full">
      {summarySection && <div className="mb-4">{summarySection}</div>}
      {/* Controls Section */}
      <div className="h-full overflow-y-scroll max-h-[calc(100vh-25rem)] pr-2">
        {isLoading && <div className="text-center text-gray-500 py-8">Loading votes...</div>}

        {/* Votes List */}
        {!isLoading && voteItems.length > 0 && (
          <ul role="list" className="space-y-2">
            {voteItems.map((item, index) => (
              <li key={index}>{item}</li>
            ))}
          </ul>
        )}

        {/* Empty State */}
        {!isLoading && voteItems.length === 0 && (
          <div className="text-center text-gray-500 py-8">{emptyStateMessage}</div>
        )}
      </div>

      {footerSection && <div className="mr-0 md:mt-auto pt-4">{footerSection}</div>}
    </div>
  )

  if (!showContainer) {
    return votesContent
  }

  return (
    <div
      className={classNames(
        'py-8 h-fit px-4 bg-dark-cool lg:bg-darkest-cool rounded-[20px]',
        containerClassName
      )}
    >
      {(title || subtitle || onTitleClick) && (
        <button
          className={classNames(
            'w-full text-lg font-semibold leading-6 text-gray-900 dark:text-white',
            onTitleClick ? 'cursor-pointer' : 'cursor-default'
          )}
          onClick={onTitleClick}
          disabled={!onTitleClick}
        >
          <h3 className="font-GoodTimes pb-2 text-gray-400">{title}</h3>
          {subtitle && <span className="text-xs text-gray-300">{subtitle}</span>}
        </button>
      )}
      <div className="pb-5">{votesContent}</div>
    </div>
  )
}

export function VoteItem({
  children,
  className = '',
}: {
  children: ReactNode
  className?: string
}) {
  return <div className={classNames('flex flex-col', className)}>{children}</div>
}

export function VoteItemHeader({
  leftContent,
  rightContent,
}: {
  leftContent: ReactNode
  rightContent?: ReactNode
}) {
  return (
    <div className="flex justify-between text-sm">
      <div className="flex items-center">{leftContent}</div>
      {rightContent && <div>{rightContent}</div>}
    </div>
  )
}

export function VoteItemDetails({
  children,
  className = 'text-sm text-gray-600 mt-1',
}: {
  children: ReactNode
  className?: string
}) {
  return <div className={className}>{children}</div>
}
