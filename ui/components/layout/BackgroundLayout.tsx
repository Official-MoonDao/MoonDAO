import { type ReactNode } from 'react'
import Starfield from '../layout/starfield'

export default function BackgroundLayout({ children }: { children: ReactNode }) {
  return (
    <div className="relative min-h-screen">
      <Starfield />
      <div className="relative z-10">
        {children}
      </div>
    </div>
  )
} 