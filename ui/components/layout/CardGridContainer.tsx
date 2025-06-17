import React from 'react'

interface CardGridContainerProps {
  children: React.ReactNode
  className?: string
  center?: boolean
  gap?: string
  columns?: number
}

export default function CardGridContainer({
  children,
  className = '',
  center = false,
  gap = 'gap-4',
  columns,
}: CardGridContainerProps) {
  return (
    <div
      className={`w-full grid items-start ${center ? 'justify-items-center' : ''} ${gap} ${className}`}
      style={{
        gridTemplateColumns: columns
          ? `repeat(${columns}, 1fr)`
          : 'repeat(auto-fit, minmax(200px, 1fr))',
      }}
    >
      {children}
    </div>
  )
}
