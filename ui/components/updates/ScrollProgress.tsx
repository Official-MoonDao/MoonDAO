import { useEffect, useState } from 'react'

export default function ScrollProgress() {
  const [progress, setProgress] = useState(0)

  useEffect(() => {
    function onScroll() {
      const doc = document.documentElement
      const height = doc.scrollHeight - window.innerHeight
      setProgress(height > 0 ? Math.min(1, Math.max(0, window.scrollY / height)) : 0)
    }
    onScroll()
    window.addEventListener('scroll', onScroll, { passive: true })
    window.addEventListener('resize', onScroll)
    return () => {
      window.removeEventListener('scroll', onScroll)
      window.removeEventListener('resize', onScroll)
    }
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
