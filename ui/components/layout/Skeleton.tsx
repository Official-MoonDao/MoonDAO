import { ReactNode } from 'react'

export type SkeletonVariant =
  | 'card'
  | 'section'
  | 'mission'
  | 'network'
  | 'asset'
  | 'proposal'
  | 'custom'
export type SkeletonLayout = 'grid' | 'list' | 'single'

export interface SkeletonProps {
  variant?: SkeletonVariant
  layout?: SkeletonLayout
  count?: number
  minHeight?: string
  className?: string
  children?: ReactNode
}

export default function Skeleton({
  variant = 'card',
  layout = 'single',
  count = 1,
  minHeight,
  className = '',
  children,
}: SkeletonProps) {
  const baseClasses = 'animate-pulse'

  const renderCardSkeleton = () => (
    <span
      id="link-frame"
      className={`card-container md:w-full flex lg:flex-col rounded-[20px] relative overflow-hidden ${className}`}
    >
      <span
        id="card-container"
        className={`animate-fadeIn flex flex-col relative bg-dark-cool w-full h-full ${
          minHeight || 'min-h-[520px]'
        } ${baseClasses}`}
      ></span>
    </span>
  )

  const renderSectionSkeleton = () => (
    <div
      className={`${
        minHeight || 'min-h-[400px]'
      } ${baseClasses} bg-white/5 rounded-2xl p-8 flex items-center justify-center ${className}`}
    >
      <div className="w-full max-w-4xl space-y-6">
        <div className="h-10 bg-white/10 rounded-lg max-w-md mx-auto"></div>
        <div className="h-6 bg-white/10 rounded-lg max-w-2xl mx-auto"></div>
        {layout === 'grid' && (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 mt-8">
            <div className="h-48 bg-white/10 rounded-xl"></div>
            <div className="h-48 bg-white/10 rounded-xl"></div>
            <div className="h-48 bg-white/10 rounded-xl"></div>
          </div>
        )}
      </div>
    </div>
  )

  const renderMissionSkeleton = () => (
    <section
      className={`relative ${
        minHeight || 'min-h-[600px] md:min-h-[700px] lg:min-h-[800px]'
      } overflow-hidden ${baseClasses} ${className}`}
    >
      <div className="absolute inset-0 bg-gradient-to-br from-[#010618]/80 via-[#1B1C4B]/60 to-[#010618]/80"></div>
      <div className="relative z-10 w-full max-w-7xl mx-auto px-4 sm:px-6 md:px-8 lg:px-12 py-16 md:py-24 lg:py-32">
        <div className="text-center mb-8 md:mb-12 lg:mb-16 xl:mb-20">
          <div className="h-12 md:h-16 bg-white/10 rounded-lg max-w-md mx-auto"></div>
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 md:gap-8 lg:gap-12 items-center">
          <div className="flex justify-center lg:justify-start order-1 lg:order-1 px-4 md:px-0">
            <div className="relative w-full max-w-md lg:max-w-lg xl:max-w-xl">
              <div className="relative rounded-3xl overflow-hidden shadow-2xl bg-white/10 aspect-square"></div>
            </div>
          </div>
          <div className="space-y-6 lg:space-y-8 order-2 lg:order-2">
            <div className="space-y-4">
              <div className="h-10 md:h-14 bg-white/10 rounded-lg"></div>
              <div className="h-6 md:h-8 bg-white/10 rounded-lg w-3/4"></div>
            </div>
            <div className="grid grid-cols-3 gap-4">
              <div className="bg-white/10 rounded-xl p-4 h-24"></div>
              <div className="bg-white/10 rounded-xl p-4 h-24"></div>
              <div className="bg-white/10 rounded-xl p-4 h-24"></div>
            </div>
            <div className="space-y-3">
              <div className="h-3 bg-white/10 rounded-full"></div>
            </div>
            <div className="h-12 bg-white/10 rounded-lg"></div>
          </div>
        </div>
      </div>
    </section>
  )

  const renderNetworkSkeleton = () => (
    <div className={`${baseClasses} bg-white/5 rounded-xl p-4 ${className}`}>
      <div className="flex items-center gap-4">
        <div className="w-12 h-12 bg-white/10 rounded-full"></div>
        <div className="flex-1 space-y-2">
          <div className="h-4 bg-white/10 rounded w-3/4"></div>
          <div className="h-3 bg-white/10 rounded w-1/2"></div>
        </div>
      </div>
    </div>
  )

  const renderAssetSkeleton = () => (
    <div className={`${baseClasses} bg-white/5 rounded-xl p-4 ${className}`}>
      <div className="space-y-3">
        <div className="h-6 bg-white/10 rounded w-2/3"></div>
        <div className="h-4 bg-white/10 rounded w-full"></div>
        <div className="h-4 bg-white/10 rounded w-5/6"></div>
      </div>
    </div>
  )

  const renderProposalSkeleton = () => (
    <div className={`${baseClasses} bg-white/5 rounded-xl p-6 ${className}`}>
      <div className="space-y-4">
        <div className="h-6 bg-white/10 rounded w-3/4"></div>
        <div className="h-4 bg-white/10 rounded w-full"></div>
        <div className="h-4 bg-white/10 rounded w-5/6"></div>
        <div className="flex gap-2 mt-4">
          <div className="h-8 bg-white/10 rounded w-20"></div>
          <div className="h-8 bg-white/10 rounded w-20"></div>
        </div>
      </div>
    </div>
  )

  const renderCustomSkeleton = () => (
    <div className={`${baseClasses} ${className}`}>
      {children || <div className="h-20 bg-white/10 rounded"></div>}
    </div>
  )

  const renderSkeleton = () => {
    switch (variant) {
      case 'card':
        return renderCardSkeleton()
      case 'section':
        return renderSectionSkeleton()
      case 'mission':
        return renderMissionSkeleton()
      case 'network':
        return renderNetworkSkeleton()
      case 'asset':
        return renderAssetSkeleton()
      case 'proposal':
        return renderProposalSkeleton()
      case 'custom':
        return renderCustomSkeleton()
      default:
        return renderCardSkeleton()
    }
  }

  if (count > 1) {
    if (layout === 'grid') {
      return (
        <div className={`grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 ${className}`}>
          {Array.from({ length: count }).map((_, index) => (
            <div key={index}>{renderSkeleton()}</div>
          ))}
        </div>
      )
    } else if (layout === 'list') {
      return (
        <div className={`space-y-4 ${className}`}>
          {Array.from({ length: count }).map((_, index) => (
            <div key={index}>{renderSkeleton()}</div>
          ))}
        </div>
      )
    }
  }

  return renderSkeleton()
}
