import Skeleton from './Skeleton'

export function MissionSkeleton() {
  return <Skeleton variant="mission" />
}

export function SectionSkeleton({ minHeight = 'min-h-[400px]' }: { minHeight?: string }) {
  return <Skeleton variant="section" layout="grid" minHeight={minHeight} />
}
