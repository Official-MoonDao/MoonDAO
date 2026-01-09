interface SkeletonLoaderProps {
  variant?: 'card' | 'text' | 'circle' | 'rectangle'
  width?: string
  height?: string
  className?: string
  count?: number
}

export default function SkeletonLoader({
  variant = 'rectangle',
  width = '100%',
  height = '20px',
  className = '',
  count = 1,
}: SkeletonLoaderProps) {
  const baseClasses = 'animate-pulse bg-gradient-to-r from-slate-800/50 to-slate-700/50 rounded'

  const variantClasses = {
    card: 'rounded-2xl',
    text: 'rounded',
    circle: 'rounded-full',
    rectangle: 'rounded-lg',
  }

  const skeletonElement = (
    <div
      className={`${baseClasses} ${variantClasses[variant]} ${className}`}
      style={{ width, height }}
    />
  )

  if (count === 1) {
    return skeletonElement
  }

  return (
    <div className="space-y-3">
      {Array.from({ length: count }).map((_, index) => (
        <div key={index}>{skeletonElement}</div>
      ))}
    </div>
  )
}

export function CardSkeleton() {
  return (
    <div className="bg-white/5 backdrop-blur-sm border border-white/10 rounded-2xl p-6 animate-pulse">
      <div className="flex items-center gap-4 mb-4">
        <SkeletonLoader variant="circle" width="48px" height="48px" />
        <div className="flex-1">
          <SkeletonLoader width="60%" height="24px" className="mb-2" />
          <SkeletonLoader width="40%" height="16px" />
        </div>
      </div>
      <SkeletonLoader width="100%" height="100px" className="mb-4" />
      <SkeletonLoader width="80%" height="16px" count={3} />
    </div>
  )
}

export function GlobeSkeleton() {
  return (
    <div className="flex items-center justify-center w-full h-full">
      <div className="relative">
        <div className="w-[300px] h-[300px] md:w-[400px] md:h-[400px] rounded-full bg-gradient-to-br from-blue-900/30 to-purple-900/30 animate-pulse" />
        <div className="absolute inset-0 flex items-center justify-center">
          <div className="text-white text-sm md:text-base opacity-70">Loading Globe...</div>
        </div>
      </div>
    </div>
  )
}

export function ListSkeleton({ count = 3 }: { count?: number }) {
  return (
    <div className="space-y-4">
      {Array.from({ length: count }).map((_, index) => (
        <div
          key={index}
          className="flex items-center gap-4 p-4 bg-white/5 rounded-xl animate-pulse"
        >
          <SkeletonLoader variant="circle" width="60px" height="60px" />
          <div className="flex-1">
            <SkeletonLoader width="70%" height="20px" className="mb-2" />
            <SkeletonLoader width="50%" height="16px" />
          </div>
        </div>
      ))}
    </div>
  )
}

export function MissionSkeleton() {
  return (
    <div className="bg-gradient-to-br from-blue-600/20 to-blue-800/20 border border-blue-500/20 rounded-2xl p-8 animate-pulse">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
        <div className="flex-1">
          <SkeletonLoader width="60%" height="32px" className="mb-2" />
          <SkeletonLoader width="80%" height="20px" />
        </div>
        <SkeletonLoader width="120px" height="40px" className="rounded-xl" />
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <SkeletonLoader width="100%" height="200px" className="rounded-xl" />
        <div className="space-y-4">
          <SkeletonLoader width="100%" height="24px" />
          <SkeletonLoader width="100%" height="80px" />
          <SkeletonLoader width="100%" height="40px" className="rounded-xl" />
        </div>
      </div>
    </div>
  )
}

export function SectionSkeleton({ minHeight }: { minHeight?: string }) {
  return (
    <div className={`w-full max-w-[1200px] mx-auto px-4 py-8 animate-pulse ${minHeight || ''}`}>
      <div className="mb-8">
        <SkeletonLoader width="300px" height="40px" className="mb-4" />
        <SkeletonLoader width="500px" height="24px" />
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {Array.from({ length: 6 }).map((_, index) => (
          <div key={index} className="bg-white/5 rounded-2xl p-6">
            <SkeletonLoader width="100%" height="150px" className="mb-4 rounded-xl" />
            <SkeletonLoader width="80%" height="24px" className="mb-2" />
            <SkeletonLoader width="100%" height="60px" />
          </div>
        ))}
      </div>
    </div>
  )
}
