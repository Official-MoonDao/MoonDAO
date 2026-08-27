import { useEffect, useState } from 'react'

export default function BlogScrollProgress() {
  const [progress, setProgress] = useState(0)

  useEffect(() => {
    function onScroll() {
      const scrolled = window.scrollY
      const height = document.documentElement.scrollHeight - window.innerHeight
      setProgress(height > 0 ? Math.min(1, scrolled / height) : 0)
    }
    onScroll()
    window.addEventListener('scroll', onScroll, { passive: true })
    return () => window.removeEventListener('scroll', onScroll)
  }, [])

  return (
    <div
      aria-hidden
      className="pointer-events-none fixed left-0 top-0 z-50 h-0.5 w-full bg-white/10"
    >
      <div
        className="h-full bg-gradient-to-r from-blue-400 to-purple-400"
        style={{ width: `${progress * 100}%` }}
      />
    </div>
  )
}
