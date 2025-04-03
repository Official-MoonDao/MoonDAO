import { useEffect, useState } from 'react'

export default function VerticalProgressScrollBar({
  sectionId,
}: {
  sectionId: string
}) {
  const [scrollProgress, setScrollProgress] = useState(0)

  useEffect(() => {
    const handleScroll = () => {
      const section = document.querySelector(`#${sectionId}`)
      if (!section) return

      const sectionRect = section.getBoundingClientRect()
      const sectionTop = sectionRect.top
      const sectionHeight = sectionRect.height
      const windowHeight = window.innerHeight
      const viewportMid = windowHeight / 2

      let progress = 0

      // Start filling when top of progress bar reaches viewport middle
      if (sectionTop < viewportMid) {
        // Calculate progress based on distance from viewport middle
        progress = ((viewportMid - sectionTop) / sectionHeight) * 1.5 * 100
        progress = Math.max(0, Math.min(100, progress))
      } else if (sectionTop <= -sectionHeight) {
        progress = 100
      }

      setScrollProgress(progress)
    }

    // Use requestAnimationFrame for smoother updates
    let ticking = false
    const scrollHandler = () => {
      if (!ticking) {
        window.requestAnimationFrame(() => {
          handleScroll()
          ticking = false
        })
        ticking = true
      }
    }

    window.addEventListener('scroll', scrollHandler, { passive: true })
    handleScroll()
    return () => window.removeEventListener('scroll', scrollHandler)
  }, [sectionId])

  return (
    <div className="w-[50px] h-full p-[5px] rounded-full bg-gradient-to-t from-[#425eeb] to-[#6d3f79]">
      <div className="w-full h-full rounded-full bg-[#FFFFFF] relative overflow-hidden">
        <div
          className="absolute top-0 w-full rounded-full bg-gradient-to-t from-[#425eeb] to-[#6d3f79] transition-transform duration-300 ease-out"
          style={{ height: `${scrollProgress}%` }}
        />
      </div>
    </div>
  )
}
