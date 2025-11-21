import Card from './Card'
import React from 'react'

export default function MainCard({
  children,
  title,
  loading,
  gradientBg,
  maxWidthClassNames,
  className = '',
}: any) {
  return (
    <Card
      title={title}
      loading={loading}
      gradientBg={gradientBg}
      maxWidthClassNames={maxWidthClassNames}
      className={className}
    >
      {children}
    </Card>
  )
}
