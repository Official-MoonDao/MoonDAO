import gsap from 'gsap'
import { ScrollTrigger } from 'gsap/dist/ScrollTrigger'
import Image from 'next/image'
import { useEffect, useRef } from 'react'

export default function LaunchpadBenefit({
  title,
  description,
  icon,
  align = 'left',
  slideDirection = 'left',
}: {
  title: string
  description: string
  icon: string | React.ReactNode
  align: 'left' | 'right'
  slideDirection?: 'left' | 'right'
}) {
  const containerRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    gsap.registerPlugin(ScrollTrigger)

    if (containerRef.current) {
      const xOffset = slideDirection === 'left' ? -100 : 100

      gsap.fromTo(
        containerRef.current,
        {
          x: xOffset,
          opacity: 0,
        },
        {
          x: 0,
          opacity: 1,
          duration: 0.8,
          ease: 'power3.out',
          scrollTrigger: {
            trigger: containerRef.current,
            start: 'top center+=100', // Trigger when top of element reaches center+100px of viewport
            end: 'bottom center', // End when bottom of element passes center of viewport
            toggleActions: 'play none none reverse', // Play animation when entering, reverse when leaving
          },
        }
      )
    }

    return () => {
      ScrollTrigger.getAll().forEach((trigger) => trigger.kill())
    }
  }, [slideDirection])

  function Icon() {
    return (
      <div
        id="benefit-icon-container"
        className="w-[max(20vw,260px)] h-[max(20vw,260px)] pb-[5vw] md:pb-0 md:w-[max(25vw,250px)] md:h-[max(25vw,250px)] rounded-full flex items-center justify-center"
      >
        {typeof icon === 'string' ? (
          <Image
            id="benefit-icon-image"
            src={icon}
            alt="Icon"
            width={200}
            height={200}
            className="w-[60vw] h-[60vw] md:w-[max(20vw,200px)] md:h-[max(20vw,200px)]"
          />
        ) : (
          <div id="benefit-icon-custom" className="w-[35vw] md:w-[20vw]">
            {icon}
          </div>
        )}
      </div>
    )
  }

  return (
    <div
      id="benefit-container"
      ref={containerRef}
      className="w-full flex items-center"
    >
      <div
        id="benefit-content"
        className="flex flex-col md:flex-row items-center justify-center w-full"
      >
        <div className="block md:hidden">
          <Icon />
        </div>
        {align === 'left' && (
          <div className="hidden md:block">
            <Icon />
          </div>
        )}
        <div
          id="benefit-text"
          className={`flex flex-col items-center pb-[5vw] md:pb-0 ${
            align === 'left'
              ? 'md:items-start text-center md:text-left pl-[5vw] pr-[5vw] md:pl-[2vw] md:pr-0'
              : 'md:items-end text-center md:text-right pr-[5vw] pl-[5vw] md:pr-[2vw] md:pl-0'
          }`}
          >
          <h3
            id="benefit-title"
            className="text-[4vw] text-[5vw] md:text-[2vw] font-bold font-GoodTimes "
          >
            {title}
          </h3>
          <p
            id="benefit-description"
            className="md:max-w-[28vw] text-[3vw] md:text-[16px] 2xl:text-[18px]"
          >
            {description}
          </p>
        </div>
        {align === 'right' && (
          <div className="hidden md:block">
            <Icon />
          </div>
        )}
      </div>
    </div>
  )
}
